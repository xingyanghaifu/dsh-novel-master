/**
 * /novel (一键完本) and /novel-continue (续写): both write the project files,
 * then hand the long-running loop to DSH's goal service so the model keeps
 * writing round after round until the chapter target is reached.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chapterTarget, extractOptions } from './args.js'
import { NO_PROJECT, agentCwd, fail, ok, projectExists, resolveProject } from './context.js'
import { decodeText, splitChapters, writeImportedChapters } from './importer.js'
import { userMessage } from './message.js'
import { safeName } from './project.js'
import { finishObjective } from './prompts.js'
import { WORKFLOW_FILE, ensureProject, prepareRun, uniqueName } from './workflow.js'

/** Optional goal service; undefined when the host does not compose it. */
function goalsOf(ctx) {
  try {
    return ctx.get('goals')
  } catch {
    return undefined
  }
}

/** Refuse before touching files when this session already runs another goal. */
function goalConflict(ctx, invocation) {
  const current = goalsOf(ctx)?.get(invocation.agent)
  if (current === undefined || current.phase === 'complete') return undefined
  return fail(`这个会话已经有一个进行中的目标（${current.phase}）：\n${current.objective}\n\n先 /goal clear（或新开一个会话）再开始。`)
}

/** Start the writing loop through a goal, or fall back to a single queued task. */
function launch(ctx, invocation, name, target, done, receipt) {
  const goals = goalsOf(ctx)
  const attachments = invocation.attachments ?? []
  if (attachments.length > 0) {
    invocation.agent.followup(userMessage(`以上附件是《${name}》的参考资料（风格或设定），动笔前先看，要点记进项目文件。`, attachments))
  }
  if (goals !== undefined) {
    goals.create(invocation.agent, {
      objective: finishObjective(name, target),
      // At least one chapter per round, plus slack for planning and checks.
      maxGoalRounds: Math.max(1, target - done) + 10,
    })
    return ok(`${receipt}\n\n已启动目标：自动一轮轮写到第 ${target} 章。随时可以 /goal pause 暂停、/goal resume 继续。`)
  }
  invocation.agent.followup(userMessage(
    `请读取 novel_projects/${name}/${WORKFLOW_FILE} 并按它执行。当前环境没有目标服务：每次回复写 1-3 章，用户说"继续"再往下写。`,
  ))
  return ok(`${receipt}\n\n（当前环境没有目标服务，改为逐轮写作：每轮写完说"继续"。）`)
}

/** `/novel <脑洞> [60章|20万字] [--auto]` */
export function novelCommand(ctx) {
  return {
    name: 'novel',
    description: '一键完本：输入脑洞，自动规划并写完整本小说',
    input: { hint: '<脑洞> [60章|20万字] [--auto 自动分岔]', attachments: true },
    handler: (invocation) => {
      const cwd = agentCwd(invocation)
      const options = extractOptions(invocation.rawInput)
      if (options.rest.length === 0) {
        return fail('用法：/novel <脑洞> [60章|20万字] [--auto]\n例：/novel 网管发现网吧的电脑能修仙 80章')
      }
      const conflict = goalConflict(ctx, invocation)
      if (conflict !== undefined) return conflict
      const target = chapterTarget(options)
      const name = uniqueName(cwd, safeName(options.rest, 12) || '未命名小说')
      ensureProject(cwd, name, options.rest)
      const { done } = prepareRun(cwd, name, {
        mode: 'finish',
        target,
        branchMode: options.auto ? 'auto' : 'ask',
        idea: options.rest,
        note: '',
      })
      return launch(ctx, invocation, name, target, done,
        `新书已建好：novel_projects/${name}/\n目标 ${target} 章，分岔点${options.auto ? '自动决定' : '会问你选哪条路'}。`)
    },
  }
}

/** Leading file path (optionally quoted) that exists under cwd. */
function leadingFile(cwd, rest) {
  const match = rest.match(/^"([^"]+)"|^'([^']+)'|^(\S+)/u)
  if (match === null) return undefined
  const full = path.resolve(cwd, match[1] ?? match[2] ?? match[3])
  try {
    if (fs.statSync(full).isFile()) return { file: full, note: rest.slice(match[0].length).trim() }
  } catch { /* not a file */ }
  return undefined
}

/** `/novel-continue [项目名|小说文件] [N章] [--auto] [要求]` */
export function continueCommand(ctx) {
  return {
    name: 'novel-continue',
    description: '续写：接着已有项目或导入的小说文件往下写，可自动连写',
    input: { hint: '[项目名|小说.txt] [续写N章] [--auto] [要求]', attachments: true },
    handler: (invocation) => {
      const cwd = agentCwd(invocation)
      const options = extractOptions(invocation.rawInput)
      const conflict = goalConflict(ctx, invocation)
      if (conflict !== undefined) return conflict
      const add = chapterTarget(options, 10)
      let name
      let note
      let receipt
      const imported = leadingFile(cwd, options.rest)
      if (imported !== undefined) {
        const base = safeName(path.basename(imported.file, path.extname(imported.file)), 16) || '导入小说'
        name = uniqueName(cwd, base)
        const dir = ensureProject(cwd, name)
        const count = writeImportedChapters(dir, splitChapters(decodeText(fs.readFileSync(imported.file))))
        note = imported.note
        receipt = `已导入《${name}》共 ${count} 章到 novel_projects/${name}/正文/。`
      } else {
        const resolved = resolveProject(cwd, options.rest)
        if (!projectExists(cwd, resolved.project)) return fail(NO_PROJECT)
        name = resolved.project
        note = resolved.note
        ensureProject(cwd, name)
        receipt = `继续写《${name}》。`
      }
      const { done } = prepareRun(cwd, name, {
        mode: 'continue',
        branchMode: options.auto ? 'auto' : 'ask',
        note,
        target: 0,
      })
      const target = done + add
      prepareRun(cwd, name, { mode: 'continue', branchMode: options.auto ? 'auto' : 'ask', note, target })
      return launch(ctx, invocation, name, target, done,
        `${receipt}\n现有 ${done} 章，续写 ${add} 章，到第 ${target} 章。`)
    },
  }
}
