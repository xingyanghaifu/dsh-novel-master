/**
 * dsh-novel-master — 小说创作大师 slash commands for DeepSeek Harness.
 *
 * Every command registers through DSH's `commands` service, so it appears in
 * the composer's `/` menu. Long runs (/novel, /novel-continue) are driven by
 * DSH's `goals` service when it is composed; all durable state lives in
 * project files under `<cwd>/novel_projects/`.
 */
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

/** Cordis Config Schema — DSH 用它生成设置面板 */
export const Config = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      title: '启用插件',
      description: '关闭后所有命令都不会注册',
    },
    commands: {
      type: 'object',
      title: '命令开关',
      description: '选择要启用的命令（关闭的命令不会出现在 / 菜单里）',
      properties: {
        novel: { type: 'boolean', default: true, title: '一键完本 (/novel)' },
        continue: { type: 'boolean', default: true, title: '续写 (/novel-continue)' },
        study: { type: 'boolean', default: true, title: '拆书 (/novel-study)' },
        outline: { type: 'boolean', default: true, title: '大纲 (/novel-outline)' },
        cast: { type: 'boolean', default: true, title: '人设 (/novel-cast)' },
        rewrite: { type: 'boolean', default: true, title: '改写 (/novel-rewrite)' },
        review: { type: 'boolean', default: true, title: '审校 (/novel-review)' },
        idea: { type: 'boolean', default: true, title: '构思 (/novel-idea)' },
        spark: { type: 'boolean', default: true, title: '灵感 (/novel-spark)' },
        world: { type: 'boolean', default: true, title: '世界 (/novel-world)' },
        role: { type: 'boolean', default: true, title: '角色 (/novel-role)' },
        stats: { type: 'boolean', default: true, title: '统计 (/novel-stats)' },
        export: { type: 'boolean', default: true, title: '导出 (/novel-export)' },
        conflict: { type: 'boolean', default: true, title: '冲突分析 (/novel-conflict)' },
        pace: { type: 'boolean', default: true, title: '节奏分析 (/novel-pace)' },
        reader: { type: 'boolean', default: true, title: '虚拟读者 (/novel-reader)' },
        dialogue: { type: 'boolean', default: true, title: '对话增强 (/novel-dialogue)' },
        emotion: { type: 'boolean', default: true, title: '情感曲线 (/novel-emotion)' },
        market: { type: 'boolean', default: true, title: '市场分析 (/novel-market)' },
      },
    },
    projectsDir: {
      type: 'string',
      default: 'novel_projects',
      title: '项目目录',
      description: '小说项目存放的相对路径（相对于工作目录）',
    },
  },
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
  if (config.enabled === false) return

  let logger = ctx.logger
  try {
    if (typeof ctx.logger === 'function') logger = ctx.logger('novel-master') ?? ctx.logger
  } catch { /* fall back to the context logger */ }

  const commandConfig = config.commands ?? {}
  const disposers = []

  for (const { key, factory } of definitions(ctx)) {
    // 这个命令被禁用了，跳过注册
    if (commandConfig[key] === false) {
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
