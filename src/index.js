/**
 * dsh-novel-master — 小说创作大师 slash commands for DeepSeek Harness.
 *
 * Every command registers through DSH's `commands` service, so it appears in
 * the composer's `/` menu. Long runs (/novel, /novel-continue) are driven by
 * DSH's `goals` service when it is composed; all durable state lives in
 * project files under `<cwd>/novel_projects/`.
 */
import z from '@deepseek-ai/schemastery'
import fs from 'node:fs'
import path from 'node:path'
import { continueCommand, novelCommand } from './cmd-write.js'
import { studyCommand } from './cmd-study.js'
import {
  castCommand,
  exportCommand,
  ideaCommand,
  mapCommand,
  outlineCommand,
  reviewCommand,
  rewriteCommand,
  roleCommand,
  sparkCommand,
  statsCommand,
  worldCommand,
} from './cmd-tools.js'
import { readonlyTools } from './project-tools.js'
import {
  conflictCommand,
  dialogueCommand,
  emotionCommand,
  paceCommand,
  readerCommand,
} from './cmd-analysis.js'
import { marketCommand } from './cmd-market.js'
import { withProjectsDirectory } from './project.js'
import { buildAtlas } from './atlas.js'
import { buildPrompt, generateImage, imageStatus } from './artwork.js'
import { bindAsset, listAssets, unbindAsset } from './assets.js'
import { resolveImageConfig } from './image-config.js'
import { expandPrompt, listRemoteModels } from './llm-client.js'
import { EXTRA_COMMANDS } from './cmd-extra.js'
import { createUpdateTransport, installUpdater } from './updater.js'
import { selfReload } from './reload.js'
import { installIntelligence, INTELLIGENCE_KEYS, intelligenceDefinitions } from './intelligence.js'
import { researchCommand, trendAnalysisCommand } from './research.js'
import { batchCommand, batchTool } from './cmd-batch.js'
import { probeCommand, probeTool } from './cmd-probe.js'

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
  ['map', '地图 (/novel-map)'],
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
  ['research', '资料检索 (/novel-research)'],
  ['trends', '热点分析 (/novel-trends)'],
  ['batch', '批量写作 (/novel-batch)'],
  ['probe', '输出上限实测 (/novel-probe)'],
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
  guidance: z.object({
    enabled: live(z.boolean().default(false)).description('启用引导模型'),
    provider: live(z.string().default('')).description('引导模型 Provider').comment('引导模型负责任务拆解、上下文分析与详细大纲生成；启用后写作命令会先调用引导模型。'),
    model: live(z.string().default('')).description('引导模型 ID'),
    reasoningEffort: live(z.string().default('')).description('引导推理强度').comment('留空使用模型默认值；填写值须由该模型支持。'),
    writingProvider: live(z.string().default('')).description('写作模型 Provider').comment('写作模型接收引导模型的详细指令执行文字生成；全部留空使用会话主模型。'),
    writingModel: live(z.string().default('')).description('写作模型 ID'),
    writingReasoningEffort: live(z.string().default('')).description('写作推理强度').comment('留空使用模型默认值。'),
    guidanceStyle: live(z.string().default('detailed')).description('引导风格').comment('detailed=详细拆解；outline=简明大纲；creative=创意增强。'),
  }).description('引导-写作分离'),
  learning: z.object({
    enabled: live(z.boolean().default(false)).description('启用自主学习总结'),
    autoSummarize: live(z.boolean().default(true)).description('自动总结小说任务输出'),
    reuse: live(z.boolean().default(true)).description('复用同模型经验'),
    storageDir: live(z.string().default('novel_learning')).description('学习存储地址').comment('支持绝对地址或工作目录相对地址；按工作目录与实际 provider/model 隔离，变更后不自动迁移记录。'),
    summaryProvider: live(z.string().default('')).description('摘要模型 Provider').comment('和摘要模型一起填写；全部留空使用被总结输出的实际模型路由。'),
    summaryModel: live(z.string().default('')).description('摘要模型 ID'),
    summaryReasoningEffort: live(z.string().default('')).description('摘要模型思考/推理强度').comment('留空使用模型默认强度，可选 low / medium / high 等。'),
    maxInputChars: live(z.natural().min(1000).max(24000).default(12000)).description('总结输入字符上限'),
    maxRecords: live(z.natural().min(1).max(10000).default(500)).description('每个模型的记录上限').comment('达到上限停止追加，不删除旧记录。'),
    cooldownSeconds: live(z.natural().min(0).max(86400).default(60)).description('自动总结最小间隔（秒）'),
    topics: live(z.array(z.string()).default([])).description('总结学习重点维度').comment('留空为全维度分析；可勾选人设心流、叙事节奏、黄金钩子、文风修辞、冲突张力、世界观演化等。'),
  }).description('学习总结'),
  decision: z.object({
    enabled: live(z.boolean().default(false)).description('启用决策 AI'),
    provider: live(z.string().default('')).description('决策模型 Provider'),
    model: live(z.string().default('')).description('决策模型 ID'),
    reasoningEffort: live(z.string().default('')).description('决策推理强度').comment('留空使用模型默认值；填写值须由该模型支持。'),
    minConfidence: live(z.number().min(0).max(1).default(0.7)).description('人工复核置信度阈值'),
    timeoutMs: live(z.natural().min(1000).max(120000).default(30000)).description('决策超时（毫秒）'),
  }).description('决策 AI'),
  research: z.object({
    enabled: live(z.boolean().default(false)).description('启用资料检索').comment('默认关闭；打开后才注册 /novel-research，并允许访问宿主联网检索服务。'),
    provider: live(z.string().default('')).description('检索模型 Provider'),
    model: live(z.string().default('')).description('检索模型 ID'),
    reasoningEffort: live(z.string().default('')).description('检索推理强度'),
    storageDir: live(z.string().default('novel_research')).description('资料存储目录').comment('相对路径位于工作目录内；也可填写绝对路径。保存原始来源和模型报告。'),
    maxResults: live(z.natural().min(1).max(10).default(5)).description('最多来源数'),
    maxSourceChars: live(z.natural().min(1000).max(24000).default(12000)).description('单来源字符上限'),
    timeoutMs: live(z.natural().min(1000).max(120000).default(60000)).description('检索模型超时（毫秒）'),
  }).description('资料检索'),
  batch: z.object({
    provider: live(z.string().default('')).description('批量写作 Provider').comment('按次计费模型填这里；留空则使用本会话最近一次实际请求的路由。'),
    model: live(z.string().default('')).description('批量写作模型 ID'),
    reasoningEffort: live(z.string().default('')).description('批量写作推理强度').comment('留空使用模型默认值。'),
    // 37 is the measured hard ceiling (77525 chars in one request); asking for
    // more only risks a max-tokens cut that discards the whole batch.
    chaptersPerRequest: live(z.natural().min(1).max(37).default(20)).description('每次请求写几章').comment('实测单次上限约 37 章（77525 字）。按次计费时这是唯一影响花费的旋钮：章数越多，请求次数越少。建议 20。'),
  }).description('批量写作（一次请求写多章）'),
  updateProxy: live(z.string().default(''))
    .description('更新检查代理')
    .comment('可填 http://127.0.0.1:7897；留空使用 HTTPS_PROXY / HTTP_PROXY 环境变量或直连。只影响版本检查，安装沿用 DSH 插件管理器设置。'),
  llm: z.object({
    enabled: live(z.boolean().default(false)).description('启用对话模型')
      .comment('用于把一句话描述扩写成高质量生图提示词。'),
    baseURL: live(z.string().default('')).description('对话模型接口地址')
      .comment('兼容 OpenAI 规范的中转站，填到 /v1 为止，例如 https://api.example.com/v1。插件自动拼 /chat/completions。'),
    apiKey: live(z.string().default('')).description('对话模型密钥')
      .comment('随 DSH 插件配置保存在本机，不写入小说项目文件。'),
    model: live(z.string().default('')).description('对话模型名称')
      .comment('例如 gpt-4o、claude-3.5-sonnet、deepseek-chat。可点设置页「拉取模型列表」自动填充。'),
    temperature: live(z.number().default(0.8)).description('扩写创造性').comment('0~2；越高越发散，0.8 适合生图提示词。'),
  }).description('对话模型（提示词扩写）'),
  image: z.object({
    enabled: live(z.boolean().default(false)).description('启用 AI 生图')
      .comment('打开后可在生图工作台和设定树地图里生成插画。'),
    baseURL: live(z.string().default('')).description('生图接口地址')
      .comment('兼容 OpenAI 规范的中转站，填到 /v1 为止。插件自动拼 /images/generations。可与对话模型不同。'),
    apiKey: live(z.string().default('')).description('生图密钥')
      .comment('随 DSH 插件配置保存在本机，不写入小说项目文件。'),
    model: live(z.string().default('')).description('生图模型名称')
      .comment('例如 gpt-image-1、dall-e-3、flux-schnell。注意多数中转站的 /models 不列生图模型，可直接手填。'),
    size: live(z.string().default('1024x1024')).description('图片尺寸')
      .comment('常见 1024x1024、1024x1536、1536x1024。'),
    quality: live(z.string().default('')).description('画质')
      .comment('留空或填 standard / hd（取决于中转站支持）。'),
  }).description('生图模型（AI 生图）'),
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
export function definitions(ctx, intelligence, config) {
  return [
    { key: 'novel', factory: () => novelCommand(ctx) },
    { key: 'continue', factory: () => continueCommand(ctx) },
    { key: 'study', factory: studyCommand },
    { key: 'outline', factory: outlineCommand },
    { key: 'cast', factory: castCommand },
    { key: 'map', factory: mapCommand },
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
    { key: 'research', factory: () => researchCommand(ctx, config?.research) },
    { key: 'trends', factory: () => trendAnalysisCommand(ctx, config?.research) },
    { key: 'batch', factory: () => batchCommand(ctx, readField(config, 'batch')) },
    { key: 'probe', factory: () => probeCommand(ctx, readField(config, 'batch')) },
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
          intelligence.run(invocation, () => definition.handler({ ...invocation, config })))
      } catch (error) {
        logger?.warn?.(`[novel-master] /${definition.name} failed: ${error?.stack ?? error}`)
        return { kind: 'error', text: `/${definition.name} 出错了：${error?.message ?? String(error)}` }
      }
    },
  }
}

/** 项目根目录：配置为绝对路径就用它，否则相对会话工作目录。 */
function resolveProjectsRoot(cwd, configured) {
  const root = String(configured ?? '').replace(/\\/gu, '/')
  if (/^(?:[a-zA-Z]:\/|\/)/u.test(root)) return path.resolve(root)
  const base = String(cwd ?? '').replace(/\\/gu, '/')
  if (!base) throw new Error('无法解析项目目录：会话工作目录不可用')
  return path.resolve(base, root)
}

/** 单个项目目录，拒绝任何穿越路径的项目名。 */
function resolveProjectDir(cwd, configured, name) {
  const clean = String(name ?? '').trim()
  if (!clean || clean.includes('..') || /[\\/]/u.test(clean)) throw new Error('项目名不合法')
  const root = resolveProjectsRoot(cwd, configured)
  const dir = path.join(root, clean)
  if (!dir.startsWith(root)) throw new Error('项目名不合法')
  return dir
}

export function apply(ctx, config = {}) {
  let logger = ctx.logger
  try {
    if (typeof ctx.logger === 'function') logger = ctx.logger('novel-master') ?? ctx.logger
  } catch { /* fall back to the context logger */ }

  const registered = new Map()
  const intelligence = installIntelligence(ctx, config)
  const entries = definitions(ctx, intelligence, config)
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
      const wanted = readField(config, 'enabled') !== false && readField(config.commands, key) !== false && (key !== 'research' || readField(config.research, 'enabled') === true)
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

  // The probe is also reachable as a tool, so a measurement does not require the
  // user to type a slash command. Registered separately from the command list:
  // tools and commands are different registries.
  let disposeProbe
  let disposeBatch
  let disposeReadonly = []
  try {
    const tools = ctx.get('tools')
    if (tools && typeof tools.register === 'function') {
      // Pass the config VALUE, not a thunk: probeTool's second parameter is the
      // batch config itself. Passing a function made every route lookup empty.
      disposeProbe = tools.register(probeTool(ctx, readField(config, 'batch')))
      // Batch as a tool too: it reuses the command's own runBatchWrite, so the
      // request shape is identical to the path already proven to work.
      disposeBatch = tools.register(batchTool(ctx, readField(config, 'batch')))
      // 只读工具：让模型和别的插件能查项目进度、取设定、读章节，
      // 而不是只能靠用户手打斜杠命令。刻意排除会写文件的命令。
      disposeReadonly = readonlyTools().map((definition) => tools.register(definition))
    }
  } catch (error) {
    logger?.warn?.(`[novel-master] 探测/批量工具注册失败：${error?.message ?? error}`)
  }
  const updateTransport = createUpdateTransport(() => readField(config, 'updateProxy'))
  ctx.on('dispose', () => updateTransport.dispose())
  installUpdater(ctx, {
    fetch: updateTransport.fetch,
    intelligence,
    // 设定树数据：只读扫描 novel_projects，给 Web 端右侧面板提供树状结构。
    atlas: (searchParams) => buildAtlas({
      cwd: searchParams?.get?.('cwd') ?? '',
      projectsDirectory: readField(config, 'projectsDir') ?? 'novel_projects',
    }),
    imageStatus: () => imageStatus(config),
    // 对话模型：把一句话描述扩写成生图提示词（宿主侧发请求，无 CORS）
    llmExpand: (body) => expandPrompt({
      config,
      brief: body?.brief,
      kind: body?.kind,
      style: body?.style,
    }),
    llmModels: (channel) => listRemoteModels({ config, channel }),
    generateImage: async (body) => {
      const { cwd, project, prompt, name, prefix, region, projectTitle, reference, model } = body ?? {}
      if (!project) throw new Error('缺少项目名')
      const dir = resolveProjectDir(cwd ?? '', readField(config, 'projectsDir') ?? 'novel_projects', project)
      // 工作台直接给 prompt；设定树地图走旧的地区数据自动拼提示词。
      const finalPrompt = prompt || buildPrompt(region, { title: projectTitle ?? project })
      // 工作台可以为本次生成临时覆盖模型与构图参数，不影响保存的默认值。
      const entry = resolveImageConfig(config)
      if (model) entry.model = String(model)
      // 每次请求可覆盖构图：宽高比 / 分辨率档位 / 张数 / 透明背景
      if (body?.aspect) entry.aspect = String(body.aspect)
      if (body?.tier) entry.tier = String(body.tier)
      if (body?.count !== undefined) entry.count = Math.max(1, Math.min(4, Number(body.count) || 1))
      if (body?.transparent !== undefined) entry.transparent = body.transparent === true
      return generateImage({
        entry,
        projectDir: dir,
        prompt: finalPrompt,
        name: name ?? region?.name ?? project,
        prefix: prefix ?? (region ? 'region' : 'art'),
        reference: reference?.dataUrl ? reference : undefined,
      })
    },
    imageFile: (name) => {
      // 只允许读项目 插图/ 下的图片，拒绝任何穿越路径
      const clean = String(name).replace(/\\/gu, '/')
      if (clean.includes('..') || clean.startsWith('/') || !/^[^/]+\/插图\//u.test(clean)) return null
      const root = resolveProjectsRoot('', readField(config, 'projectsDir') ?? 'novel_projects')
      const full = path.join(root, clean)
      if (!full.startsWith(root)) return null
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null
      const ext = path.extname(full).toLowerCase()
      const type = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png'
      return { buffer: fs.readFileSync(full), type }
    },
    // 资产台账：图片 ↔ 角色名/地名 的绑定关系，存放在项目 插图/资产.json
    assets: async (op, body) => {
      const { cwd, project } = body ?? {}
      if (!project) throw new Error('缺少项目名')
      const dir = resolveProjectDir(cwd ?? '', readField(config, 'projectsDir') ?? 'novel_projects', project)
      if (op === 'bind') return bindAsset({ projectDir: dir, ...body })
      if (op === 'unbind') return unbindAsset({ projectDir: dir, ...body })
      if (op === 'list') return listAssets({ projectDir: dir, kind: body?.kind })
      throw new Error(`未知资产操作：${op}`)
    },
    reload: async () => { const result = await selfReload(ctx); return { ...result, application: result.status } },
  })

  ctx.on('dispose', () => {
    disposed = true
    intelligence.dispose()
    try { disposeProbe?.() } catch { /* tool cleanup cannot block unload */ }
    try { disposeBatch?.() } catch { /* tool cleanup cannot block unload */ }
    // Each readonly tool registered separately; unregister every one of them.
    for (const off of disposeReadonly) {
      try { off?.() } catch { /* tool cleanup cannot block unload */ }
    }
    offSettings?.()
    offReload?.()
    for (const key of [...registered.keys()]) remove(key)
  })
  reconcile()
  logger?.info?.(`[novel-master] 已加载 ${registered.size} 个创作命令；配置热更新已启用`)
}
