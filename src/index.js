/**
 * dsh-novel-master — 小说创作大师 slash commands for DeepSeek Harness.
 *
 * Every command registers through DSH's `commands` service, so it appears in
 * the composer's `/` menu. Long runs (/novel, /novel-continue) are driven by
 * DSH's `goals` service when it is composed; all durable state lives in
 * project files under `<cwd>/novel_projects/`.
 */
import z from '@deepseek-ai/schemastery'
import { continueCommand, novelCommand } from './cmd-write.js'
import { studyCommand } from './cmd-study.js'
import {
  castCommand,
  exportCommand,
  ideaCommand,
  outlineCommand,
  reviewCommand,
  rewriteCommand,
  roleCommand,
  sparkCommand,
  statsCommand,
  worldCommand,
} from './cmd-tools.js'
import {
  conflictCommand,
  dialogueCommand,
  emotionCommand,
  paceCommand,
  readerCommand,
} from './cmd-analysis.js'
import { marketCommand } from './cmd-market.js'

export const name = 'novel-master'

/** `goals` is optional: without it the writing commands fall back to turn-by-turn mode. */
export const inject = ['commands']

/** Stable namespace for definition ids. */
const DEFINITION_PREFIX = 'dsh-novel-master'

/**
 * Every command's config key, in menu order.
 *
 * Declared once so the schema below and the registration loop cannot drift.
 */
const COMMAND_KEYS = [
  ['novel', '一键完本 (/novel)'],
  ['continue', '续写 (/novel-continue)'],
  ['study', '拆书 (/novel-study)'],
  ['outline', '大纲 (/novel-outline)'],
  ['cast', '人设 (/novel-cast)'],
  ['rewrite', '改写 (/novel-rewrite)'],
  ['review', '审校 (/novel-review)'],
  ['idea', '构思 (/novel-idea)'],
  ['spark', '灵感 (/novel-spark)'],
  ['world', '世界 (/novel-world)'],
  ['role', '角色 (/novel-role)'],
  ['stats', '统计 (/novel-stats)'],
  ['export', '导出 (/novel-export)'],
  ['conflict', '冲突分析 (/novel-conflict)'],
  ['pace', '节奏分析 (/novel-pace)'],
  ['reader', '虚拟读者 (/novel-reader)'],
  ['dialogue', '对话增强 (/novel-dialogue)'],
  ['emotion', '情感曲线 (/novel-emotion)'],
  ['market', '市场分析 (/novel-market)'],
]

/**
 * Whether the resolved schemastery can mark a field live-editable.
 *
 * `.volatile()` is what makes `dsh-settings` project a field into the settings
 * form; without it the field still works, it is just not editable from the UI.
 * The kernel's bundled copy (3.18.4) has the method, but a plugin that resolves
 * an older copy would throw while this module is being evaluated — which would
 * take every command down with it. So the method is probed once and the schema
 * degrades to non-volatile when absent.
 */
const LIVE_CAPABLE = typeof z.boolean().volatile === 'function'

/** Mark one Config leaf live-editable, where the schema library allows it. */
function live(schema) {
  return LIVE_CAPABLE ? schema.volatile() : schema
}

/**
 * Cordis Config Schema — DSH uses it to generate the settings panel.
 *
 * This must be a schemastery schema instance, not a plain object: cordis calls
 * `Config['~standard'].validate(raw)` before `apply`, and a plain object has no
 * such property (`TypeError: Cannot read properties of undefined (reading
 * 'validate')`).
 *
 * `.volatile()` is applied to leaves only. Marking the enclosing `commands`
 * object volatile is rejected by schemastery ("volatile fields require a fixed
 * object path without an enclosing volatile field"), so the container stays a
 * plain object and each command flag is volatile on its own.
 */
export const Config = z.object({
  enabled: live(z.boolean().default(true))
    .description('启用插件')
    .comment('关闭后所有命令都不会注册'),
  commands: z.object(
    Object.fromEntries(
      COMMAND_KEYS.map(([key, title]) => [key, live(z.boolean().default(true)).description(title)]),
    ),
  ).description('命令开关'),
  projectsDir: live(z.string().default('novel_projects'))
    .description('项目目录')
    .comment('小说项目存放的相对路径（相对于工作目录）'),
})

/**
 * Well-known key cosmokit puts on a live config reference.
 *
 * A volatile field does not resolve to its value: it resolves to a stable
 * reference whose `get()` answers the current immutable snapshot. Reading
 * `config.enabled` directly would therefore see an object, not a boolean.
 */
const VOLATILE_REF = Symbol.for('cosmokit.volatile.write')

/** Whether a config value is a live reference rather than a plain snapshot. */
function isLive(value) {
  return typeof value === 'object' && value !== null && VOLATILE_REF in value
}

/**
 * Read one applied-config field, unwrapping a live reference when present.
 * @param config - the applied config, possibly undefined.
 * @param key - field name.
 * @returns the current value, or undefined when the field is absent.
 */
function readField(config, key) {
  const value = config?.[key]
  return isLive(value) && typeof value.get === 'function' ? value.get() : value
}

/** Every command definition with its config key, in menu order. */
export function definitions(ctx) {
  return [
    { key: 'novel', factory: () => novelCommand(ctx) },
    { key: 'continue', factory: () => continueCommand(ctx) },
    { key: 'study', factory: studyCommand },
    { key: 'outline', factory: outlineCommand },
    { key: 'cast', factory: castCommand },
    { key: 'rewrite', factory: rewriteCommand },
    { key: 'review', factory: reviewCommand },
    { key: 'idea', factory: ideaCommand },
    { key: 'spark', factory: sparkCommand },
    { key: 'world', factory: worldCommand },
    { key: 'role', factory: roleCommand },
    { key: 'stats', factory: statsCommand },
    { key: 'export', factory: exportCommand },
    { key: 'conflict', factory: conflictCommand },
    { key: 'pace', factory: paceCommand },
    { key: 'reader', factory: readerCommand },
    { key: 'dialogue', factory: dialogueCommand },
    { key: 'emotion', factory: emotionCommand },
    { key: 'market', factory: marketCommand },
  ]
}

/** Wrap a handler so unexpected failures become a readable error, not a crash. */
function guarded(definition, logger) {
  return {
    ...definition,
    definitionId: `${DEFINITION_PREFIX}/${definition.name}`,
    handler: async (invocation) => {
      try {
        return await definition.handler(invocation)
      } catch (error) {
        logger?.warn?.(`[novel-master] /${definition.name} failed: ${error?.stack ?? error}`)
        return { kind: 'error', text: `/${definition.name} 出错了：${error?.message ?? String(error)}` }
      }
    },
  }
}

export function apply(ctx, config = {}) {
  // 整个插件被禁用
  if (readField(config, 'enabled') === false) return

  let logger = ctx.logger
  try {
    if (typeof ctx.logger === 'function') logger = ctx.logger('novel-master') ?? ctx.logger
  } catch { /* fall back to the context logger */ }

  const commandsConfig = config?.commands ?? {}
  const disposers = []

  for (const { key, factory } of definitions(ctx)) {
    // 这个命令被禁用了，跳过注册
    if (readField(commandsConfig, key) === false) {
      logger?.info?.(`[novel-master] 命令已禁用: /${key}`)
      continue
    }

    try {
      const definition = factory()
      const disposer = ctx.commands.register(guarded(definition, logger))
      disposers.push(disposer)
      logger?.info?.(`[novel-master] 命令已注册: /${definition.name}`)
    } catch (error) {
      logger?.warn?.(`[novel-master] 命令注册失败 ${key}: ${error?.message ?? error}`)
    }
  }

  // 插件卸载时自动注销所有命令
  ctx.on('dispose', () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch { /* ignore cleanup errors */ }
    }
  })

  logger?.info?.(`[novel-master] 已加载 ${disposers.length} 个命令`)
}
