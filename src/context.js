/**
 * Shared helpers for command handlers: cwd, project resolution, results.
 */
import { latestProject, listProjects, projectDir } from './project.js'
import { splitProject } from './args.js'
import { userMessage } from './message.js'
import { enhanceTaskPrompt } from './task-intelligence.js'
import { formatError, formatSuccess } from './validators.js'
import fs from 'node:fs'

/**
 * Working directory of the receiving agent's session.
 *
 * The documented `Agent` interface is only `{ id }`, and a real command
 * invocation carries no `cwd`, so this has to probe the shapes the runtime
 * actually exposes. Falling straight through to `process.cwd()` is dangerous:
 * under the desktop app that is the installation directory, not the user's
 * workspace, which would scatter projects outside the workspace.
 */
export function agentCwd(invocation) {
  return invocation?.cwd
    ?? invocation?.agent?.session?.header?.cwd
    ?? invocation?.agent?.session?.cwd
    ?? invocation?.agent?.ctx?.get?.('workingDirectory')?.defaultDirectory
    ?? process.cwd()
}

export const ok = (text) => ({ kind: 'success', text })
export const fail = (text) => ({ kind: 'error', text })

/**
 * Resolve which project a command targets: a leading existing project name,
 * otherwise the most recently touched project.
 * @returns {{ project?: string, note: string }}
 */
export function resolveProject(cwd, rest) {
  const split = splitProject(rest, listProjects(cwd))
  if (split.project !== undefined) return split
  return { project: latestProject(cwd), note: split.note }
}

/** Error text used when a command needs a project and none exists. */
export const NO_PROJECT = formatError(
  '还没有小说项目',
  [
    '/novel 网管发现网吧电脑能修仙 80章',
    '/novel-continue 小说.txt 20章'
  ]
)

/**
 * Queue a model task on the agent and return a short receipt.
 *
 * `followup` is not part of the documented `Agent` interface (which is only
 * `{ readonly id }`), so it is probed rather than assumed: calling it unguarded
 * made four commands (/novel-continue, /novel-outline, /novel-cast,
 * /novel-spark) throw "Cannot read properties of undefined (reading
 * 'followup')" instead of returning anything. When no hand-off exists the
 * command returns the task text so it is never silently lost.
 * @param {object} invocation
 * @param {string} prompt - full task for the model.
 * @param {string} receipt - text shown to the user.
 */
export function queueTask(invocation, prompt, receipt) {
  const enqueue = text => {
    invocation.signal?.throwIfAborted()
    const agent = invocation.agent
    if (!agent || typeof agent.followup !== 'function') {
      // No hand-off channel: return the task itself so it is not silently lost.
      return fail(formatError('当前环境无法把任务交回模型继续执行', [
        '这个命令依赖「把任务排队给会话模型」的能力，当前宿主没有提供该入口',
        '可以直接把下面的提示词复制给模型，效果相同：',
        '',
        String(text).slice(0, 1200),
      ]))
    }
    agent.followup(userMessage(text, invocation.attachments ?? []))
    return ok(receipt)
  }
  const enhanced = enhanceTaskPrompt(invocation, prompt)
  return typeof enhanced?.then === 'function' ? enhanced.then(enqueue) : enqueue(enhanced)
}

/** True when the project directory exists. */
export function projectExists(cwd, name) {
  return name !== undefined && fs.existsSync(projectDir(cwd, name))
}
