import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProbe, buildProbePrompt, probeRoute } from '../src/cmd-probe.js'

test('prompt names the exact separator and forbids commentary', () => {
  const prompt = buildProbePrompt(50)
  assert.match(prompt, /50 章/u)
  assert.match(prompt, /===第\{\{N\}\}章===/u)
  assert.match(prompt, /不要输出任何解释/u)
})

test('counts every chapter and measures each body', () => {
  const reply = [
    '===第1章===', '# 第1章 起', 'a'.repeat(2000),
    '===第2章===', '# 第2章 承', 'b'.repeat(1900),
  ].join('\n')
  const m = analyzeProbe(reply, 2)
  assert.equal(m.chapters, 2)
  assert.deepEqual(m.numbers, [1, 2])
  assert.equal(m.complete, true)
  assert.equal(m.truncated, false)
  assert.ok(m.averageChars > 1800)
})

test('a short full reply is complete but not "truncated"', () => {
  const m = analyzeProbe('===第1章===\n# 第1章\n短文', 1)
  assert.equal(m.chapters, 1)
  assert.equal(m.complete, true)
  // Cannot judge truncation from a single chapter.
  assert.equal(m.truncated, false)
})

test('detects a cut-off final chapter', () => {
  const reply = [
    '===第1章===', 'x'.repeat(2000),
    '===第2章===', 'y'.repeat(2000),
    '===第3章===', 'z'.repeat(100),
  ].join('\n')
  const m = analyzeProbe(reply, 10)
  assert.equal(m.chapters, 3)
  assert.equal(m.complete, false)
  assert.equal(m.truncated, true)
  assert.equal(m.lastChapterChars, 100)
})

test('reports zero chapters for an empty or failed reply', () => {
  const m = analyzeProbe('', 50)
  assert.equal(m.chapters, 0)
  assert.equal(m.complete, false)
  assert.equal(m.averageChars, 0)
  assert.equal(m.truncated, false)
})

test('the separator regex does not carry state between calls', () => {
  const one = '===第1章===\n正文'
  assert.equal(analyzeProbe(one, 1).chapters, 1)
  assert.equal(analyzeProbe(one, 1).chapters, 1)
  assert.equal(analyzeProbe(one, 1).chapters, 1)
})

/**
 * Regression: an unreadable config used to fall back to the session's own route,
 * which spent a billable request on a model the user never named.
 */
test('an unreadable config refuses instead of borrowing the session route', () => {
  const empty = probeRoute(undefined)
  assert.equal(empty.route, undefined)
  assert.equal(empty.source, 'config-missing')
  assert.equal(probeRoute({}).route, undefined)
  assert.equal(probeRoute({ provider: 'p' }).route, undefined)
  assert.equal(probeRoute({ model: 'm' }).route, undefined)
})

test('a complete config yields exactly that route, effort only when set', () => {
  const route = probeRoute({ provider: 'gemini-c', model: 'gemini-3.8-flash-high-c' })
  assert.deepEqual(route.route, { provider: 'gemini-c', model: 'gemini-3.8-flash-high-c' })
  // Empty effort must be omitted, not sent as "".
  const withEffort = probeRoute({ provider: 'p', model: 'm', reasoningEffort: 'high' })
  assert.deepEqual(withEffort.route, { provider: 'p', model: 'm', reasoningEffort: 'high' })
  assert.equal('reasoningEffort' in probeRoute({ provider: 'p', model: 'm', reasoningEffort: '' }).route, false)
})

test('volatile config references are unwrapped for the route', () => {
  const live = value => ({ get: () => value })
  const route = probeRoute({ provider: live('gemini-c'), model: live('gemini-3.8-flash-high-c'), reasoningEffort: live('') })
  assert.equal(route.route.provider, 'gemini-c')
  assert.equal(route.route.model, 'gemini-3.8-flash-high-c')
  assert.equal('reasoningEffort' in route.route, false)
})
