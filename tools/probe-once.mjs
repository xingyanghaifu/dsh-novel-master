/**
 * One-shot capacity probe, run as a host script.
 *
 * Sends EXACTLY ONE llm.stream request to the configured route and writes only
 * statistics to stdout — the prose itself never enters an agent context, so a
 * 100k-character reply costs nothing in tokens here.
 *
 * Usage (from the plugin directory, so `ctx.get('llm')` resolves):
 *   node tools/probe-once.mjs
 *
 * Refuses to run twice: a marker file records that a probe already happened, so
 * a retry cannot silently spend a second billable request.
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PROVIDER = process.env.PROBE_PROVIDER || 'gemini-c'
const MODEL = process.env.PROBE_MODEL || 'gemini-3.8-flash-high-c'
const CHAPTERS = Number(process.env.PROBE_CHAPTERS || 50)
const MAX_TOKENS = Number(process.env.PROBE_MAX_TOKENS || 128000)
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 1800000)
const MARKER = join(process.env.TEMP || '.', 'dsh-probe-once.marker')

if (existsSync(MARKER)) {
  console.log(JSON.stringify({
    ok: false,
    refused: true,
    reason: '已经跑过一次探测（marker 存在）。为避免再次计费，拒绝重复执行。确认要再测请手动删除：' + MARKER,
  }, null, 2))
  process.exit(0)
}

export function buildPrompt(count) {
  return [
    `请连续写出 ${count} 章的网文正文。`,
    '',
    '【绝对硬性要求】',
    '1. 只输出正文，不要任何解释、前言、总结、说明，不要用代码块包裹。',
    '2. 章与章之间单独一行输出分隔标记，格式严格为 ===第N章=== ，N 是章号，例如第一处是 ===第1章===',
    '3. 每章第一行是「# 第N章 标题」，下面直接是正文。',
    '4. 每章正文约 2000 字，剧情连贯。',
    `5. 从第 1 章写到第 ${count} 章，中间不要跳号。`,
    '',
    '直接开始。尽你所能写长；如果写到输出极限被迫中断，就在中断处停止。',
  ].join('\n')
}

/** Pure analysis, exported so it can be unit-tested without a model call. */
export function analyze(text, requested) {
  const source = String(text ?? '')
  const marks = [...source.matchAll(/^[ \t]*===第(\d{1,4})章===[ \t]*$/gmu)]
  const numbers = marks.map(m => Number(m[1]))
  const bodies = []
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index + marks[i][0].length
    const end = i + 1 < marks.length ? marks[i + 1].index : source.length
    bodies.push(source.slice(start, end).trim().length)
  }
  const total = bodies.reduce((a, b) => a + b, 0)
  const average = bodies.length === 0 ? 0 : Math.round(total / bodies.length)
  const last = bodies.length === 0 ? 0 : bodies[bodies.length - 1]
  return {
    requested,
    chapters: marks.length,
    firstNumbers: numbers.slice(0, 5),
    lastNumbers: numbers.slice(-5),
    hasGap: numbers.length > 1 && numbers.some((n, i) => i > 0 && n !== numbers[i - 1] + 1),
    totalChars: source.length,
    bodyChars: total,
    averageChars: average,
    lastChapterChars: last,
    truncated: bodies.length > 1 && last < average * 0.6,
    complete: marks.length >= requested,
    head: source.slice(0, 100),
    tail: source.slice(-100),
  }
}

/** Called by the Cordis runner, which supplies a real host `ctx`. */
export async function run(ctx) {
  const llm = ctx.get('llm')
  if (!llm?.stream) throw new Error('宿主没有 llm 服务')

  const providers = await llm.listProviders()
  if (!providers.some(p => p.id === PROVIDER)) {
    throw new Error(`provider 未注册：${PROVIDER}；可用：${providers.map(p => p.id).join(', ')}`)
  }
  const info = await llm.resolveModelInfo(PROVIDER, MODEL)
  console.log(JSON.stringify({
    stage: 'route',
    provider: PROVIDER,
    model: MODEL,
    contextWindow: info?.context?.contextWindow ?? null,
    defaultMaxTokens: info?.defaultMaxTokens ?? null,
    efforts: Array.isArray(info?.reasoning?.efforts) ? info.reasoning.efforts.map(e => e.id) : [],
  }))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('超时')), TIMEOUT_MS)

  let text = ''
  let finish = 'none'
  let failure = ''
  let usage
  let firstChunkAt = 0
  const startedAt = Date.now()

  try {
    mkdirSync(join(process.env.TEMP || '.', 'dsh-probe'), { recursive: true })
    writeFileSync(MARKER, new Date().toISOString())
    const stream = llm.stream({
      provider: PROVIDER,
      model: MODEL,
      system: '你是职业网文作者。只按要求连续输出正文，不解释，不使用工具。',
      messages: [{ role: 'user', content: [{ type: 'text', text: buildPrompt(CHAPTERS) }] }],
      tools: [],
      maxTokens: MAX_TOKENS,
      signal: controller.signal,
    })
    for await (const chunk of stream) {
      if (!firstChunkAt) firstChunkAt = Date.now()
      if (chunk?.type === 'finish') {
        finish = chunk.reason?.kind ?? 'unknown'
        failure = chunk.reason?.failure?.message ?? ''
        break
      }
      if (chunk?.type === 'usage') usage = chunk.usage
      else if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
      else if (chunk?.type === 'block-end' && chunk.block?.type === 'text' && !text) text += chunk.block.text
    }
  } catch (error) {
    finish = 'threw'
    failure = error?.message ?? String(error)
  } finally {
    clearTimeout(timer)
  }

  const elapsedMs = Date.now() - startedAt
  const result = {
    ok: finish === 'stop',
    provider: PROVIDER,
    model: MODEL,
    maxTokens: MAX_TOKENS,
    finish,
    failure,
    usage,
    elapsedMs,
    timeToFirstChunkMs: firstChunkAt ? firstChunkAt - startedAt : null,
    ...analyze(text, CHAPTERS),
  }
  console.log(JSON.stringify(result, null, 2))
  return result
}

export default run
