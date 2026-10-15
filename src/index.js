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
import { withProjectsDirectory } from './project.js'
import { EXTRA_COMMANDS } from './cmd-extra.js'
import { createUpdateTransport, installUpdater } from './updater.js'
import { selfReload } from './reload.js'
import { installIntelligence, INTELLIGENCE_KEYS, intelligenceDefinitions } from './intelligence.js'

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
  ...EXTRA_COMMANDS.map(({ key, title }) => [key, title]),
  ...INTELLIGENCE_KEYS,
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
    .comment('关闭后移除创作命令；配置页和更新入口仍可用'),
  commands: z.object(
    Object.fromEntries(
      COMMAND_KEYS.map(([key, title]) => [key, live(z.boolean().default(true)).description(title)]),
    ),
  ).description('命令开关'),
  learning: z.object({
    enabled: live(z.boolean().default(false)).description('启用自主学习总结'),
    autoSummarize: live(z.boolean().default(true)).description('自动总结小说任务输出'),
    reuse: live(z.boolean().default(true)).description('复用同模型经验'),
    storageDir: live(z.string().default('novel_learning')).description('学习存储地址').comment('支持绝对地址或工作目录相对地址；按工作目录与实际 provider/model 隔离，变更后不自动迁移记录。'),
    summaryProvider: live(z.string().default('')).description('摘要模型 Provider').comment('和摘要模型一起填写；全部留空使用被总结输出的实际模型路由。'),
    summaryModel: live(z.string().default('')).description('摘要模型 ID'),
    maxInputChars: live(z.natural().min(1000).max(24000).default(12000)).description('总结输入字符上限'),
    maxRecords: live(z.natural().min(1).max(10000).default(500)).description('每个模型的记录上限').comment('达到上限停止追加，不删除旧记录。'),
    cooldownSeconds: live(z.natural().min(0).max(86400).default(60)).description('自动总结最小间隔（秒）'),
  }).description('学习总结'),
  decision: z.object({
    enabled: live(z.boolean().default(false)).description('启用决策 AI'),
    provider: live(z.string().default('')).description('决策模型 Provider'),
    model: live(z.string().default('')).description('决策模型 ID'),
    reasoningEffort: live(z.string().default('')).description('决策推理强度').comment('留空使用模型默认值；填写值须由该模型支持。'),
    minConfidence: live(z.number().min(0).max(1).default(0.7)).description('人工复核置信度阈值'),
    timeoutMs: live(z.natural().min(1000).max(120000).default(30000)).description('决策超时（毫秒）'),
  }).description('决策 AI'),
  updateProxy: live(z.string().default(''))
    .description('更新检查代理')
    .comment('可填 http://127.0.0.1:7897；留空使用 HTTPS_PROXY / HTTP_PROXY 环境变量或直连。只影响版本检查，安装沿用 DSH 插件管理器设置。'),
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
export function definitions(ctx, intelligence) {
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
    ...EXTRA_COMMANDS,
    ...intelligenceDefinitions(intelligence),
  ]
}

/** Wrap a handler so unexpected failures become a readable error, not a crash. */
function guarded(definition, logger, config, intelligence) {
  return {
    ...definition,
    definitionId: `${DEFINITION_PREFIX}/${definition.name}`,
    handler: async (invocation) => {
      try {
        return await withProjectsDirectory(readField(config, 'projectsDir') ?? 'novel_projects', () =>
          intelligence.run(invocation, () => definition.handler(invocation)))
      } catch (error) {
        logger?.warn?.(`[novel-master] /${definition.name} failed: ${error?.stack ?? error}`)
        return { kind: 'error', text: `/${definition.name} 出错了：${error?.message ?? String(error)}` }
      }
    },
  }
}

export function apply(ctx, config = {}) {
  let logger = ctx.logger
  try {
    if (typeof ctx.logger === 'function') logger = ctx.logger('novel-master') ?? ctx.logger
  } catch { /* fall back to the context logger */ }

  const registered = new Map()
  const intelligence = installIntelligence(ctx, config)
  const entries = definitions(ctx, intelligence)
  let disposed = false
  const remove = (key) => {
    const dispose = registered.get(key)
    if (!dispose) return
    registered.delete(key)
    try { dispose() } catch (error) {
      logger?.warn?.(`[novel-master] 命令清理失败 ${key}: ${error?.message ?? error}`)
    }
  }
  const reconcile = () => {
    if (disposed) return
    intelligence.reconcile()
    for (const { key, factory } of entries) {
      const wanted = readField(config, 'enabled') !== false && readField(config.commands, key) !== false
      if (!wanted) { remove(key); continue }
      if (registered.has(key)) continue
      try {
        registered.set(key, ctx.commands.register(guarded(factory(), logger, config, intelligence)))
      } catch (error) {
        logger?.warn?.(`[novel-master] 命令注册失败 ${key}: ${error?.message ?? error}`)
      }
    }
  }

  // Volatile references update in place; apply() is not rerun for those edits.
  const offSettings = ctx.on('settings/document-updated', reconcile)
  const offReload = ctx.on('app-boot/config-reload', reconcile)
  const updateTransport = createUpdateTransport(() => readField(config, 'updateProxy'))
  ctx.on('dispose', () => updateTransport.dispose())
  installUpdater(ctx, {
    fetch: updateTransport.fetch,
    intelligence,
    reload: async () => { const result = await selfReload(ctx); return { ...result, application: result.status } },
  })
  ctx.on('dispose', () => {
    disposed = true
    intelligence.dispose()
    offSettings?.()
    offReload?.()
    for (const key of [...registered.keys()]) remove(key)
  })
  reconcile()
  logger?.info?.(`[novel-master] 已加载 ${registered.size} 个创作命令；配置热更新已启用`)
}
