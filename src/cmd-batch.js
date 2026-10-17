/**
 * /novel-batch — write several chapters in ONE billed model request.
 *
 * Per-request billing makes the request count the cost, so this command never
 * hands work to the goal driver (one request per tool turn). It inlines the
 * context, asks for N chapters separated by a marker, and writes the files
 * itself. `--auto` repeats the same shape in the background until the chapter
 * target is reached, which costs one request per batch and nothing else.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chapterTarget, extractOptions } from './args.js'
import { NO_PROJECT, agentCwd, fail, ok, projectExists, resolveProject } from './context.js'
import { runBatchWrite } from './batch-write.js'
import { actualModelOf } from './model-intelligence.js'
import { listChapters, latestProject, projectDir, projectRelativeDir } from './project.js'
import { formatError, formatSuccess } from './validators.js'

const STATUS_FILE = '批量写作状态.json'
const DEFAULT_BATCH = 6
const MAX_SINGLE_BATCH = 30

/**
 * Unwrap a live (volatile) config reference. The settings schema marks each
 * field volatile, so the applied object holds `{ get() }` wrappers rather than
 * plain values; reading one directly would stringify to "[object Object]".
 */
const read = (value, fallback) => {
  if (value && typeof value === 'object' && typeof value.get === 'function') return value.get() ?? fallback
  return value ?? fallback
}

/** `--每批X章` / `--batch N` — how many chapters one request should produce. */
function batchSizeOf(raw, config) {
  const text = ` ${String(raw ?? '')} `
  const match = text.match(/\s(?:--batch|--每批)\s*(\d{1,3})\s*章?(?=\s)/u)
  const explicit = match !== null ? Number(match[1]) : undefined
  const fallback = Number(read(config?.chaptersPerRequest, DEFAULT_BATCH))
  const size = explicit ?? (Number.isInteger(fallback) && fallback > 0 ? fallback : DEFAULT_BATCH)
  return Math.min(MAX_SINGLE_BATCH, Math.max(1, Math.trunc(size)))
}

function writeStatus(cwd, name, patch) {
  const file = path.join(projectDir(cwd, name), STATUS_FILE)
  let previous = {}
  try { previous = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* first run */ }
  const next = { ...previous, ...patch, updatedAt: new Date().toISOString() }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

/** Model route for batch writing: explicit config first, else the session's observed route. */
async function routeConfig(ctx, invocation, config) {
  const provider = String(read(config?.provider, '')).trim()
  const model = String(read(config?.model, '')).trim()
  if (provider && model) return { provider, model, reasoningEffort: String(read(config?.reasoningEffort, '')).trim() || undefined }
  const observed = await actualModelOf(invocation.agent, ctx)
  if (!observed?.known) return undefined
  return { provider: observed.provider, model: observed.model, reasoningEffort: observed.reasoningEffort }
}

function summary(written) {
  const first = written.at(0)
  const last = written.at(-1)
  return first.number === last.number ? `第${first.number}章` : `第${first.number}–${last.number}章`
}

/**
 * Repeat single-request batches until the target is met.
 *
 * This runs inside the command handler on purpose. `invocation.signal` belongs
 * to the UI request, so a detached background loop would keep billing after the
 * command settled and could not be cancelled; awaiting here keeps every request
 * cancellable and makes the receipt describe work that actually happened.
 */
async function runLoop(ctx, invocation, { name, target, size, requirement, config }) {
  const cwd = invocation.cwd ?? agentCwd(invocation)
  const batches = []
  for (;;) {
    if (invocation.signal?.aborted) {
      writeStatus(cwd, name, { phase: 'aborted', lastError: '' })
      return { batches, aborted: true }
    }
    const done = listChapters(cwd, name).length
    if (done >= target) {
      writeStatus(cwd, name, { phase: 'complete', done, target, lastError: '' })
      return { batches, aborted: false, done }
    }
    const count = Math.min(size, target - done)
    writeStatus(cwd, name, { phase: 'running', done, target, requestSize: count })
    try {
      const result = await runBatchWrite(ctx, invocation, { name, count, requirement, config })
      batches.push(result)
      writeStatus(cwd, name, { phase: 'running', done: result.done, target, lastBatch: summary(result.written), lastError: '' })
    } catch (error) {
      writeStatus(cwd, name, { phase: 'error', lastError: error?.message ?? String(error) })
      return { batches, aborted: false, error }
    }
  }
}

/** `/novel-batch [项目名] [N章] [--每批X章] [--auto] [要求]` */
export function batchCommand(ctx, config) {
  return {
    name: 'novel-batch',
    description: '批量写作：一次模型请求连续写多章（按次计费模型最省请求）',
    input: { hint: '[项目名] [N章] [--每批6章] [--auto] [要求]', attachments: false },
    handler: async (invocation) => {
      const cwd = invocation.cwd ?? agentCwd(invocation)
      const options = extractOptions(invocation.rawInput)
      const resolved = resolveProject(cwd, options.rest)
      if (!projectExists(cwd, resolved.project)) return fail(NO_PROJECT)
      const name = resolved.project
      const size = batchSizeOf(invocation.rawInput, config)
      const done = listChapters(cwd, name).length
      const target = chapterTarget(options, done + size)
      const requirement = resolved.note

      const route = await routeConfig(ctx, invocation, config)
      if (route === undefined) {
        return fail(formatError(
          '批量写作不知道该调用哪个模型',
          [
            '在插件设置 → 批量写作里填 Provider 和模型 ID',
            '或者先在会话里正常发送一条消息，让插件读到实际路由',
            '本命令不会猜测模型，避免把内容发到别的模型上计费'
          ]
        ))
      }

      if (!options.auto) {
        const count = Math.min(size, Math.max(1, target - done))
        try {
          const result = await runBatchWrite(ctx, invocation, { name, count, requirement, config: route })
          return ok(formatSuccess(`批量写作完成：${summary(result.written)}`, {
            '📁 项目路径': `${result.project}/正文/`,
            '📝 本次写入': `${result.written.length} 章`,
            '📊 累计章数': `${result.done} 章`,
            '✍️ 字数': `${result.chars} 字`,
            '💳 本次请求': '1 次'
          }))
        } catch (error) {
          return fail(`批量写作失败：${error?.message ?? String(error)}`)
        }
      }

      if (done >= target) return ok(`《${name}》已有 ${done} 章，已达到目标 ${target} 章。`)
      writeStatus(cwd, name, { phase: 'running', done, target, requestSize: size, lastError: '' })
      const outcome = await runLoop(ctx, invocation, { name, target, size, requirement, config: route })
      const written = outcome.batches.reduce((sum, batch) => sum + batch.written.length, 0)
      const latest = outcome.batches.at(-1)
      const receipt = {
        '📁 项目路径': `${projectRelativeDir(name)}/`,
        '📚 起始章数': `${done} 章`,
        '🎯 目标章数': `${target} 章`,
        '📝 本次写入': `${written} 章`,
        '💳 实际请求': `${outcome.batches.length} 次`,
      }
      if (latest) receipt['📊 当前章数'] = `${latest.done} 章`
      receipt['📄 进度文件'] = `${projectRelativeDir(name)}/${STATUS_FILE}`

      if (outcome.error) {
        return fail(formatError(`批量写作中断：${outcome.error.message ?? outcome.error}`, [
          `已写入 ${written} 章，终止于第 ${written === 0 ? done : latest?.done ?? done} 章之后`,
          '修复配置或调小「每次请求章数」后重新执行，已存在的章节不会被覆盖',
          `详细错误见 ${projectRelativeDir(name)}/${STATUS_FILE}`
        ]))
      }
      if (outcome.aborted) return ok(formatSuccess(`批量写作已取消（已完成 ${written} 章）`, receipt))
      return ok(formatSuccess(`批量写作完成「${name}」`, receipt))
    },
  }
}

/**
 * Tool entry for the same one-request batch, so a batch does not require a slash
 * command. It reuses `runBatchWrite` verbatim instead of reimplementing the
 * request shape: the command path is the one that is known to be accepted by the
 * per-request channel, and a second implementation would drift from it.
 */
export function batchTool(ctx, config) {
  return {
    name: 'novel_batch',
    description: '批量写作：一次模型请求连续写多章并直接落盘。不重试，单次调用只发一次请求。',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: '项目名，留空使用最近修改的项目' },
        chapters: { type: 'integer', description: '本次请求写几章（1-30），默认取插件配置' },
        requirement: { type: 'string', description: '本次的额外写作要求' },
      },
      required: [],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          written: { type: 'integer' },
          done: { type: 'integer' },
          chars: { type: 'integer' },
          firstChapter: { type: 'integer' },
          lastChapter: { type: 'integer' },
          requestsMade: { type: 'integer' },
          error: { type: 'string' },
          verdict: { type: 'string' },
        },
        required: ['project', 'written', 'done', 'chars', 'requestsMade', 'verdict'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: async (args, exec) => {
      const invocation = { agent: exec.agent, signal: exec.signal }
      const cwd = agentCwd(invocation)
      const requested = String(args?.project ?? '').trim()
      const name = requested || latestProject(cwd)
      if (!name || !projectExists(cwd, name)) {
        return {
          project: name || '', written: 0, done: 0, chars: 0, requestsMade: 0,
          error: '找不到项目',
          verdict: `项目「${name || '(未指定)'}」不存在，先用 /novel 创建`,
        }
      }
      const route = await routeConfig(ctx, invocation, config)
      if (route === undefined) {
        return {
          project: name, written: 0, done: 0, chars: 0, requestsMade: 0,
          error: 'no-route',
          verdict: '不知道调用哪个模型：请在插件设置 → 批量写作里填 Provider 和模型 ID',
        }
      }
      const count = Math.max(1, Math.min(MAX_SINGLE_BATCH, Math.trunc(Number(args?.chapters) || batchSizeOf('', config))))
      try {
        // One call, one request. Validation happens inside before any file write.
        const result = await runBatchWrite(ctx, invocation, { name, count, requirement: String(args?.requirement ?? ''), config: route })
        const first = result.written.at(0)
        const last = result.written.at(-1)
        return {
          project: name,
          written: result.written.length,
          done: result.done,
          chars: result.chars,
          firstChapter: first?.number,
          lastChapter: last?.number,
          requestsMade: 1,
          error: '',
          verdict: `一次请求写入 ${result.written.length} 章（第${first?.number}–${last?.number}章），累计 ${result.done} 章`,
        }
      } catch (error) {
        return {
          project: name, written: 0, done: listChapters(cwd, name).length, chars: 0, requestsMade: 1,
          error: `${error?.code ?? ''} ${error?.message ?? String(error)}`.trim(),
          verdict: '请求已发出但失败，未写入任何文件（不会重试）',
        }
      }
    },
  }
}
