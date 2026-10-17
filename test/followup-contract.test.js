import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { queueTask, agentCwd } from '../src/context.js'
import { continueCommand } from '../src/cmd-write.js'
import { outlineCommand, castCommand, sparkCommand } from '../src/cmd-tools.js'

/**
 * Regression: the host `Agent` exposes only `{ id }`. `followup` exists on the
 * test double but not on the real object, so calling it unguarded made these
 * commands throw "Cannot read properties of undefined (reading 'followup')"
 * instead of returning a receipt. A command must never crash the turn.
 */
const bareInvocation = (cwd) => ({
  cwd,
  // Exactly what the host provides: no followup, no chat.
  agent: { id: 'session-1' },
  signal: new AbortController().signal,
  rawInput: '',
  attachments: [],
})

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'novel-followup-'))
}

test('queueTask degrades instead of throwing when the agent has no followup', async () => {
  const value = queueTask(bareInvocation(tempRoot()), '请写第一章。', '已排队')
  const resolved = typeof value?.then === 'function' ? await value : value
  // It must report why it could not hand off, and stay actionable.
  assert.equal(resolved.kind, 'error')
  assert.match(resolved.text, /无法把任务交回模型/u)
  assert.match(resolved.text, /请写第一章/u)
})

test('queueTask still delivers when a followup channel exists', async () => {
  const sent = []
  const invocation = {
    ...bareInvocation(tempRoot()),
    agent: { id: 'session-1', followup: (message) => sent.push(message) },
  }
  const resolved = await queueTask(invocation, '任务正文', '已排队')
  assert.equal(resolved.kind, 'success')
  assert.equal(sent.length, 1)
})

test('commands that queue model work return a receipt rather than crashing', async () => {
  const cwd = tempRoot()
  const project = join(cwd, 'novel_projects', '测试书')
  mkdirSync(join(project, '正文'), { recursive: true })
  writeFileSync(join(project, '项目.json'), JSON.stringify({ title: '测试书' }), 'utf8')
  writeFileSync(join(project, '大纲.md'), '第1章 开场\n', 'utf8')

  const invocation = { ...bareInvocation(cwd), rawInput: '测试书' }
  for (const factory of [continueCommand, outlineCommand, castCommand, sparkCommand]) {
    let value
    // The point is "does not throw"; the receipt may legitimately be an error.
    assert.doesNotThrow(() => { value = factory({}).handler(invocation) })
    const resolved = typeof value?.then === 'function' ? await value : value
    assert.ok(resolved && typeof resolved.kind === 'string', 'must return a receipt')
  }
})

/**
 * Regression: the host invocation is `{ commandId, agent, rawInput,
 * attachments, signal }`. It carries no cwd, and the documented Agent interface
 * is `{ readonly id }`. Preferring process.cwd() silently pointed the commands at
 * the installation directory instead of the user's workspace, so projects were
 * read from (and written to) the wrong place.
 */
test('agentCwd resolves the session directory before falling back', () => {
  // Explicit cwd wins.
  assert.equal(agentCwd({ cwd: '/work/one', agent: { id: 'a' } }), '/work/one')
  // The session header is the normal source.
  assert.equal(agentCwd({ agent: { session: { header: { cwd: '/work/two' } } } }), '/work/two')
  // The working-directory service is the last non-process resort.
  assert.equal(
    agentCwd({ agent: { ctx: { get: () => ({ defaultDirectory: '/work/three' }) } } }),
    '/work/three',
  )
  // Only a truly bare invocation reaches process.cwd().
  assert.equal(agentCwd({ agent: { id: 'a' } }), process.cwd())
})
