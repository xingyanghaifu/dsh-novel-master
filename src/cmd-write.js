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
import { enhanceTaskPrompt, bindNovelGoal } from './task-intelligence.js'
import { safeName, projectRelativeDir } from './project.js'
import { finishObjective } from './prompts.js'
import { WORKFLOW_FILE, ensureProject, prepareRun, uniqueName } from './workflow.js'
import { validateChapterTarget, validateProjectName, formatError, formatSuccess } from './validators.js'
import { builtinPersona, loadPersona, savePersona, takePersonaOption, writePersonaToRules } from './author-persona.js'

/**
 * Resolve the persona a write command should use, and persist it.
 *
 * A `--persona <id>` on this call wins and is written to the project, so the
 * fingerprint survives the goal loop and later sessions. Without the flag an
 * already-saved persona is reused, which is what makes "set once, keep writing"
 * work. Either way the section is written into 写作规范.md rather than only the
 * receipt: 完本/续写 runs many rounds and the context is compacted between them,
 * so a style that lives only in this turn's prompt would evaporate.
 *
 * @returns {{ persona?: object, error?: string }}
 */
function applyPersona(cwd, name, personaId) {
  if (personaId !== undefined) {
    const persona = builtinPersona(personaId)
    if (persona === undefined) return { error: `没有内置风格「${personaId}」` }
    savePersona(cwd, name, { ...persona, source: `builtin:${personaId}` })
    writePersonaToRules(cwd, name, persona)
    return { persona }
  }
  const saved = loadPersona(cwd, name)
  if (saved === undefined) return {}
  writePersonaToRules(cwd, name, saved)
  return { persona: saved }
}

/** 命中了人格时，回执里多一行，让用户知道风格确实生效了。 */
function personaReceipt(persona) {
  return persona === undefined ? {} : { '🎨 作者风格': persona.name }
}

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
  return fail(formatError(
    `这个会话已经有进行中的目标（${current.phase}）`,
    [
      '/goal pause   # 暂停当前目标',
      '/goal clear   # 清除并开始新目标',
      '或者新开一个会话'
    ]
  ))
}

/** Start the writing loop through a goal, or fall back to a single queued task. */
function launch(ctx, invocation, name, target, done, receipt) {
  const goals = goalsOf(ctx)
  const base = goals !== undefined ? finishObjective(name, target)
    : `请读取 ${projectRelativeDir(name)}/${WORKFLOW_FILE} 并按它执行。当前环境没有目标服务：每次回复写 1-3 章，用户说"继续"再往下写。`
  const start = prompt => {
    invocation.signal?.throwIfAborted()
    const attachments = invocation.attachments ?? []
    // `followup` is not part of the documented Agent interface (`{ readonly id }`),
    // so it must be probed rather than assumed: a missing one used to throw
    // "Cannot read properties of undefined (reading 'followup')".
    const canFollowup = typeof invocation.agent?.followup === 'function'
    if (attachments.length > 0 && canFollowup) {
      invocation.agent.followup(userMessage(`以上附件是《${name}》的参考资料（风格或设定），动笔前先看，要点记进项目文件。`, attachments))
    }
    if (goals !== undefined) {
      const goal = goals.create(invocation.agent, { objective: prompt, maxGoalRounds: Math.max(1, target - done) + 10 })
      bindNovelGoal({ ...invocation, novelProject: name }, goal)
      return ok(formatSuccess(receipt, {
        '📝 进度': `${done}/${target} 章`, '🎯 剩余': `${target - done} 章`, '🔄 模式': '自动多轮（目标驱动）',
      }) + '\n\n💡 提示：可用 /goal pause 暂停、/goal resume 继续')
    }
    if (!canFollowup) {
      return fail(formatError('当前环境无法把任务交回模型继续执行', [
        '这个命令依赖「把任务排队给会话模型」的能力，当前宿主没有提供该入口',
        `项目已就绪：${projectRelativeDir(name)}/`,
        '可以直接对我说「继续写《' + name + '》」，或把下面的提示词交给模型：',
        '',
        String(prompt).slice(0, 1200),
      ]))
    }
    invocation.agent.followup(userMessage(prompt))
    return ok(`${receipt}\n\n⚠️ 当前环境没有目标服务，改为手动模式：\n  每轮写完说"继续"才会接着写下一轮`)
  }
  const enhanced = enhanceTaskPrompt({ ...invocation, novelProject: name }, base)
  return typeof enhanced?.then === 'function' ? enhanced.then(start) : start(enhanced)
}

/** `/novel <脑洞> [60章|20万字] [--auto]` */
export function novelCommand(ctx) {
  return {
    name: 'novel',
    description: '一键完本：输入脑洞，自动规划并写完整本小说',
    input: { hint: '<脑洞> [60章|20万字] [--auto 自动分岔] [--persona 风格id]', attachments: true },
    handler: (invocation) => {
      const cwd = agentCwd(invocation)
      // Strip --persona before option parsing so the id cannot leak into the
      // project name ("网管修仙--persona-wangyu-classic").
      const personaOption = takePersonaOption(invocation.rawInput)
      if (personaOption.error !== undefined) return fail(formatError(personaOption.error))
      const options = extractOptions(personaOption.rest)
      if (options.rest.length === 0) {
        return fail(formatError(
          '缺少必需参数：脑洞',
          [
            '/novel 网管发现网吧的电脑能修仙 80章',
            '/novel 末日求生：我有一座避难所 60章 --auto'
          ]
        ))
      }
      const conflict = goalConflict(ctx, invocation)
      if (conflict !== undefined) return conflict
      const target = chapterTarget(options)
      const name = uniqueName(cwd, safeName(options.rest, 12) || '未命名小说')
      ensureProject(cwd, name, options.rest)
      const applied = applyPersona(cwd, name, personaOption.personaId)
      if (applied.error !== undefined) return fail(formatError(applied.error))
      const { done } = prepareRun(cwd, name, {
        mode: 'finish',
        target,
        branchMode: options.auto ? 'auto' : 'ask',
        idea: options.rest,
        note: '',
      })
      return launch(ctx, invocation, name, target, done,
        formatSuccess(`新书「${name}」创建成功`, {
          '📁 项目路径': `${projectRelativeDir(name)}/`,
          '📝 目标章数': `${target} 章`,
          '🎯 分岔模式': options.auto ? '自动决策' : '手动选择',
          ...personaReceipt(applied.persona),
        }))
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
    input: { hint: '[项目名|小说.txt] [续写N章] [--auto] [--persona 风格id] [要求]', attachments: true },
    handler: (invocation) => {
      const cwd = agentCwd(invocation)
      const personaOption = takePersonaOption(invocation.rawInput)
      if (personaOption.error !== undefined) return fail(formatError(personaOption.error))
      const options = extractOptions(personaOption.rest)
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
        receipt = `已导入《${name}》共 ${count} 章到 ${projectRelativeDir(name)}/正文/。`
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
      const applied = applyPersona(cwd, name, personaOption.personaId)
      if (applied.error !== undefined) return fail(formatError(applied.error))
      const target = done + add
      prepareRun(cwd, name, { mode: 'continue', branchMode: options.auto ? 'auto' : 'ask', note, target })
      return launch(ctx, invocation, name, target, done,
        formatSuccess(`继续写作「${name}」`, {
          '📚 已完成': `${done} 章`,
          '📝 续写目标': `+${add} 章 → ${target} 章`,
          '🎯 分岔模式': options.auto ? '自动决策' : '手动选择',
          ...personaReceipt(applied.persona),
        }))
    },
  }
}
