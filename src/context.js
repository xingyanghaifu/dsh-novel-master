/**
 * Shared helpers for command handlers: cwd, project resolution, results.
 */
import { latestProject, listProjects, projectDir } from './project.js'
import { splitProject } from './args.js'
import { userMessage } from './message.js'
import { enhanceTaskPrompt } from './task-intelligence.js'
import { formatError, formatSuccess } from './validators.js'
import fs from 'node:fs'

/** Working directory of the receiving agent's session. */
export function agentCwd(invocation) {
  return invocation.agent?.session?.header?.cwd ?? process.cwd()
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
 * @param {object} invocation
 * @param {string} prompt - full task for the model.
 * @param {string} receipt - text shown to the user.
 */
export function queueTask(invocation, prompt, receipt) {
  const enqueue = text => {
    invocation.signal?.throwIfAborted()
    invocation.agent.followup(userMessage(text, invocation.attachments ?? []))
    return ok(receipt)
  }
  const enhanced = enhanceTaskPrompt(invocation, prompt)
  return typeof enhanced?.then === 'function' ? enhanced.then(enqueue) : enqueue(enhanced)
}

/** True when the project directory exists. */
export function projectExists(cwd, name) {
  return name !== undefined && fs.existsSync(projectDir(cwd, name))
}
