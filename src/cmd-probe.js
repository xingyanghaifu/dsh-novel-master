/**
 * /novel-probe — measure how much one model request can actually return.
 *
 * The plugin's own caps (maxTokens, output chars, chapters per request) are
 * guesses, not model facts. This probe pushes them out of the way and reports
 * where the MODEL stops: how many chapters came back, the per-chapter sizes, the
 * real finish reason, and whether the tail looks cut off.
 *
 * Exactly one request. No retry, no second call, and nothing is written to a
 * project — a probe must not pollute real prose.
 *
 * Two entry points share this implementation: the `/novel-probe` slash command
 * (user-facing) and the `novel_probe` tool (agent-facing), so the same measurement
 * is reachable from either side.
 */
import { callTextReporting, PROBE_LIMITS } from './model-intelligence.js'
import { ok, fail } from './context.js'
import { formatError, formatSuccess } from './validators.js'

const SEPARATOR = '===第{{N}}章==='
const MARKER_RE = /^[ \t]*===第(\d{1,4})章===[ \t]*$/gmu

const read = (value, fallback) => {
  if (value && typeof value === 'object' && typeof value.get === 'function') return value.get() ?? fallback
  return value ?? fallback
}

/** Ask for N chapters with an explicit, parseable separator. */
export function buildProbePrompt(count) {
  const sample = SEPARATOR.replace('{{N}}', '1')
  return `请连续写出 ${count} 章的网文正文。

【硬性要求】
- 章与章之间单独一行输出分隔标记，格式严格为 ${SEPARATOR}，把 N 换成章号，例如第一处是 ${sample}。
- 每章第一行是「# 第N章 标题」，下面直接是正文。
- 不要输出任何解释、前言、总结、写作说明。
- 每章正文约 2000 字，剧情连贯。

现在是第 1 章到第 ${count} 章，直接开始。`
}

/**
 * Measure a reply. `complete` means the model produced every requested chapter;
 * a short or cut-off reply is the interesting result, not an error.
 */
export function analyzeProbe(text, requested) {
  const source = String(text ?? '')
  const marks = [...source.matchAll(MARKER_RE)]
  const numbers = marks.map(match => Number(match[1]))
  const chapters = []
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index + marks[i][0].length
    const end = i + 1 < marks.length ? marks[i + 1].index : source.length
    chapters.push({ number: Number(marks[i][1]), chars: source.slice(start, end).trim().length })
  }
  const last = chapters.at(-1)
  const average = chapters.length === 0 ? 0 : Math.round(chapters.reduce((sum, chapter) => sum + chapter.chars, 0) / chapters.length)
  return {
    requested,
    chapters: chapters.length,
    numbers,
    totalChars: source.length,
    bodyChars: chapters.reduce((sum, chapter) => sum + chapter.chars, 0),
    averageChars: average,
    lastChapterChars: last?.chars ?? 0,
    complete: chapters.length >= requested,
    // A final chapter far below average is the signature of a hard cut-off.
    truncated: chapters.length > 1 && (last?.chars ?? 0) < average * 0.6,
    tail: source.slice(-160),
  }
}

/**
 * Resolve which model to probe. Explicit config ONLY — there is deliberately no
 * fallback to the session's own route.
 *
 * That fallback was a real bug: when the config route was unreadable the probe
 * silently borrowed the route of whatever model the current turn was running on,
 * spent one request, and measured a model the user never asked about. A probe
 * must never guess a billing target, so an unreadable config now refuses and
 * reports exactly what it did read.
 */
export function probeRoute(config) {
  const provider = String(read(config?.provider, '') ?? '').trim()
  const model = String(read(config?.model, '') ?? '').trim()
  const effort = String(read(config?.reasoningEffort, '') ?? '').trim()
  if (!provider || !model) return { route: undefined, source: 'config-missing', seen: { provider, model, effort } }
  return { route: { provider, model, ...(effort ? { reasoningEffort: effort } : {}) }, source: 'config' }
}

export const NO_ROUTE = formatError('没有可用的探测模型路由，未发送任何请求', [
  '在插件设置 → 批量写作里填 Provider 和模型 ID',
  '不会借用当前会话的模型：那会把请求发给用户没有指定的计费对象'
])

/**
 * Run exactly one probe request and return the measured facts.
 * Never retries: a second call would be a second billable request.
 */
export async function runProbe(ctx, { invocation, config, chapters, maxTokens, timeoutSec } = {}) {
  const requested = Math.max(1, Math.min(200, Math.trunc(Number(chapters) || 50)))
  const tokens = Math.min(PROBE_LIMITS.maxTokens, Math.max(1024, Math.trunc(Number(maxTokens) || PROBE_LIMITS.maxTokens)))
  const timeoutMs = Math.min(PROBE_LIMITS.timeoutMs, Math.max(30000, Math.trunc(Number(timeoutSec) || 900) * 1000))
  const { route, source, seen } = probeRoute(config)
  if (!route) return { kind: 'no-route', source, seen, requested, tokens, timeoutMs }
  const result = await callTextReporting(ctx, {
    ...route,
    limits: 'probe',
    system: '你是职业网文作者。只按要求连续输出正文，不解释，不使用工具。',
    prompt: buildProbePrompt(requested),
    signal: invocation?.signal,
    timeoutMs,
    maxTokens: tokens,
    maxOutputChars: PROBE_LIMITS.outputChars,
  })
  return { kind: 'measured', source, route, result, measure: analyzeProbe(result.text, requested), requested, tokens, timeoutMs }
}

/** Render a measurement as a receipt. */
export function probeReceipt(measured) {
  if (measured.kind === 'no-route') {
    const seen = measured.seen ?? {}
    return fail(formatError('没有可用的探测模型路由，未发送任何请求', [
      `读到的 provider：${seen.provider || '(空)'}`,
      `读到的 model：${seen.model || '(空)'}`,
      `读到的 reasoningEffort：${seen.effort || '(空)'}`,
      '在插件设置 → 批量写作里填 Provider 和模型 ID',
      '不会借用当前会话的模型：那会把请求发给没有指定的计费对象'
    ]))
  }
  const { route, result, measure: m, requested, tokens, timeoutMs, source } = measured
  const verdict = m.complete
    ? `一次请求完整返回 ${m.chapters} 章（未触顶）`
    : m.truncated
      ? `模型在 ${m.chapters} 章处被截断（要求 ${requested} 章）`
      : `模型只返回 ${m.chapters} 章（要求 ${requested} 章）`
  return ok(formatSuccess(`单次输出实测：${m.chapters} 章`, {
    '🤖 模型': `${route.provider} / ${route.model}${route.reasoningEffort ? ` · ${route.reasoningEffort}` : ''}`,
    '🧭 路由来源': source,
    '💳 请求次数': '1 次',
    '📥 要求章数': `${requested} 章`,
    '📤 实际章数': `${m.chapters} 章`,
    '✍️ 正文总字数': `${m.bodyChars} 字`,
    '📏 平均每章': `${m.averageChars} 字`,
    '📐 末章字数': `${m.lastChapterChars} 字${m.truncated ? '（疑似被截断）' : ''}`,
    '🔚 结束原因': `${result.finish}${result.failure ? `：${result.failure}` : ''}`,
    '🧮 请求上限': `${tokens} tokens / 超时 ${Math.round(timeoutMs / 1000)} 秒`,
    '📊 结论': verdict,
  }))
}

/** `/novel-probe [章数] [--tokens N] [--timeout 秒]` */
export function probeCommand(ctx, config) {
  return {
    name: 'novel-probe',
    description: '单次输出上限实测：只发一次请求，报告模型实际返回多少章、在哪断',
    input: { hint: '[章数=50] [--tokens 上限] [--timeout 秒]', attachments: false },
    handler: async (invocation) => {
      const raw = ` ${String(invocation.rawInput ?? '')} `
      const countMatch = raw.match(/(\d{1,3})\s*章?/u)
      const tokenMatch = raw.match(/--tokens\s+(\d{1,6})/u)
      const timeoutMatch = raw.match(/--timeout\s+(\d{1,5})/u)
      try {
        const measured = await runProbe(ctx, {
          invocation, config,
          chapters: countMatch?.[1],
          maxTokens: tokenMatch?.[1],
          timeoutSec: timeoutMatch?.[1],
        })
        return probeReceipt(measured)
      } catch (error) {
        return fail(formatError(`探测失败：${error?.message ?? String(error)}`, [
          `code：${error?.code ?? '(无)'}`,
          '这次请求已经发出并计费，重试会产生新的一次请求',
          '若提示 unsupported-effort，请在批量写作设置里清空 reasoningEffort',
        ]))
      }
    },
  }
}

/**
 * Agent-facing twin of the command. Registered as a tool so the same single
 * measurement is reachable without the user typing a slash command.
 */
export function probeTool(ctx, config, invocationOf) {
  return {
    name: 'novel_probe',
    description: '单次输出上限实测：只发一次请求，测量指定模型一次能返回多少章、是否被截断。不重试、不写任何项目文件。',
    parameters: {
      type: 'object',
      properties: {
        chapters: { type: 'integer', description: '要求一次输出多少章（1-200），默认 50' },
        maxTokens: { type: 'integer', description: '本次请求的 maxTokens 上限，默认取插件上限' },
        timeoutSec: { type: 'integer', description: '超时秒数，默认 900' },
      },
      required: [],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          provider: { type: 'string' }, model: { type: 'string' },
          requested: { type: 'integer' }, chapters: { type: 'integer' },
          bodyChars: { type: 'integer' }, averageChars: { type: 'integer' },
          lastChapterChars: { type: 'integer' }, complete: { type: 'boolean' },
          truncated: { type: 'boolean' }, finish: { type: 'string' },
          failure: { type: 'string' }, requestsMade: { type: 'integer' },
          verdict: { type: 'string' },
        },
        required: ['provider', 'model', 'requested', 'chapters', 'bodyChars', 'averageChars', 'lastChapterChars', 'complete', 'truncated', 'finish', 'failure', 'requestsMade', 'verdict'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: async (args, exec) => {
      let measured
      try {
        measured = await runProbe(ctx, {
          invocation: { agent: exec.agent, signal: exec.signal, ...(invocationOf?.() ?? {}) },
          config,
          chapters: args?.chapters,
          maxTokens: args?.maxTokens,
          timeoutSec: args?.timeoutSec,
        })
      } catch (error) {
        // Report the code instead of retrying: a retry is another request.
        return {
          provider: String(read(config?.provider, '')),
          model: String(read(config?.model, '')),
          requested: Math.trunc(Number(args?.chapters) || 50),
          chapters: 0, bodyChars: 0, averageChars: 0, lastChapterChars: 0,
          complete: false, truncated: false,
          finish: 'error', failure: `${error?.code ?? ''} ${error?.message ?? String(error)}`.trim(),
          requestsMade: 1,
          verdict: '请求失败，未得到测量结果',
        }
      }
      if (measured.kind === 'no-route') {
        const seen = measured.seen ?? {}
        return {
          provider: seen.provider || '', model: seen.model || '',
          requested: measured.requested, chapters: 0, bodyChars: 0, averageChars: 0, lastChapterChars: 0,
          complete: false, truncated: false, finish: 'no-route',
          failure: `配置未读到模型路由：provider=${seen.provider || '(空)'} model=${seen.model || '(空)'}`,
          requestsMade: 0, verdict: '未发请求：没有可用路由',
        }
      }
      const m = measured.measure
      return {
        provider: measured.route.provider,
        model: measured.route.model,
        requested: measured.requested,
        chapters: m.chapters,
        bodyChars: m.bodyChars,
        averageChars: m.averageChars,
        lastChapterChars: m.lastChapterChars,
        complete: m.complete,
        truncated: m.truncated,
        finish: measured.result.finish,
        failure: measured.result.failure ?? '',
        requestsMade: 1,
        verdict: m.complete
          ? `完整返回 ${m.chapters} 章，未触顶`
          : m.truncated
            ? `在 ${m.chapters} 章处被截断`
            : `只返回 ${m.chapters} 章`,
      }
    },
  }
}
