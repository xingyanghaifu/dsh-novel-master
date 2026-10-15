import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { installIntelligence, intelligenceDefinitions } from '../src/intelligence.js'
import { createLearningStore } from '../src/learning-store.js'
import { withTaskIntelligence, enhanceTaskPrompt, bindNovelGoal } from '../src/task-intelligence.js'
import { withProjectsDirectory } from '../src/project.js'
import { callText } from '../src/model-intelligence.js'
import { queueTask } from '../src/context.js'

let cwd
beforeEach(() => { cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-intelligence-')) })
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }) })
const signal = () => new AbortController().signal
const owner = { known: true, provider: 'writer', model: 'a' }
const WRITE = Symbol.for('cosmokit.volatile.write')
const live = value => ({ get: () => value, [WRITE]: next => { value = next } })
function harness({ learning = {}, decision = {}, identity = owner, summarize, choose, dependencies = {}, page, rootEnabled = true, commands = {} } = {}) {
  const listeners = new Map(), tools = new Map(), calls = []
  const agent = { id: 'session-a', session: { header: { cwd } } }
  let initiator = agent
  let actual = identity
  let currentGoal, seq = 0, revision = 0
  const pages = new Map(), pageCalls = []
  const config = { enabled: rootEnabled, commands, learning: { enabled: true, autoSummarize: true, reuse: true, storageDir: 'novel_learning', cooldownSeconds: 0, ...learning }, decision: { enabled: true, provider: 'judge', model: 'j', minConfidence: .7, timeoutMs: 1000, ...decision } }
  const ctx = {
    logger: { warn() {} },
    on(name, fn) { const list = listeners.get(name) ?? new Set(); listeners.set(name, list); list.add(fn); return () => list.delete(fn) },
    get(name) {
      if (name === 'goals') return { get: () => currentGoal }
      if (name === 'sessionController') return { page: async (request, signal) => { pageCalls.push(request); return page ? page(request, signal) : { records: [pages.get(request.throughSeq)] } } }
      if (name === 'agents') return { currentInitiator: () => initiator }
      if (name === 'tools') return { register(def) { assert.equal(tools.has(def.name), false); tools.set(def.name, def); return () => tools.delete(def.name) } }
      return undefined
    },
  }
  const runtime = installIntelligence(ctx, config, { actualModelOf: async () => actual,
    callText: summarize ?? (async (_ctx, input) => { calls.push(input); return '经验：开头以具体行动带出冲突。' }),
    decide: choose ?? (async (_ctx, input) => { calls.push(input); return { choice: input.options[0].id, reason: '与已知角色目标一致', confidence: .8, needsHumanReview: false } }),
    ...dependencies,
  })
  const invocation = { agent, rawInput: '', signal: signal() }
  const emit = (event, ...args) => { for (const fn of [...(listeners.get(event) ?? [])]) fn(...args) }
  const chunks = (text = '完成小说第一章。', finish = 'stop') => [{ type: 'block-start', index: 0, blockType: 'text' }, { type: 'text-delta', index: 0, text }, { type: 'block-end', index: 0, block: { type: 'text', text } }, { type: 'finish', reason: { kind: finish } }]
  async function stream(options = Object.freeze({ provider: 'writer', model: 'a', sessionId: agent.id }), values = chunks()) {
    const attemptId = `attempt-${++revision}`
    const sourceAgent = options.agent ?? (options.sessionId === agent.id ? agent : { id: options.sessionId })
    const frame = value => emit('agent/assistant-stream', { agent: sourceAgent, frame: { attemptId, revision, ...value } })
    frame({ type: 'start', turn: 1, step: revision })
    values.forEach((chunk, index) => frame({ type: 'chunk', index, time: Date.now(), chunk }))
    const text = values.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join('') || values.filter(chunk => chunk.type === 'block-end' && chunk.block.type === 'text').map(chunk => chunk.block.text).join('')
    const committed = ++seq
    pages.set(committed, { type: 'event', event: { type: 'assistant/message', seq: committed, data: { turn: 1, step: revision, message: { role: 'assistant', source: { kind: 'model', provider: options.provider, model: options.model }, content: [{ type: 'text', text }] } } } })
    frame({ type: 'end', index: values.length, outcome: { kind: 'committed', eventType: 'assistant/message', seq: committed } })
    return values
  }
  const queue = () => runtime.run(invocation, () => enhanceTaskPrompt(invocation, '写下一章'))
  const records = (provider = 'writer', model = 'a') => createLearningStore({ cwd, directory: 'novel_learning', provider, model }).list()
  return { ctx, runtime, config, agent, invocation, calls, tools, emit, stream, chunks, queue, records, pages, pageCalls, setGoal: value => { currentGoal = value }, setIdentity: value => { actual = value }, setInitiator: value => { initiator = value } }
}
function book(name = '甲', directory = 'novel_projects') {
  const dir = path.join(cwd, directory, name, '正文')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '第1章 起点.md'), '主角转身走进雨里。')
  return dir
}

test('cancelling while loading experience prevents enqueue and revokes task ownership', async () => {
  let release, queued = 0
  const blocked = new Promise(resolve => { release = resolve })
  const h = harness({ dependencies: { actualModelOf: async () => { await blocked; return owner } } })
  h.agent.followup = () => { queued++ }
  const controller = new AbortController()
  const invocation = { ...h.invocation, signal: controller.signal }
  const pending = h.runtime.run(invocation, () => queueTask(invocation, 'novel task', 'queued'))
  controller.abort(new Error('cancel-enqueue')); release()
  await assert.rejects(pending, /cancel-enqueue/)
  assert.equal(queued, 0)
  assert.equal(h.runtime.status().trackedSessions, 0)
  await h.stream(); await h.runtime.drain()
  assert.equal(h.pageCalls.length, 0)
  h.runtime.dispose()
})

test('global intelligence concurrency is bounded and reusable after settlement', async () => {
  let release
  const blocked = new Promise(resolve => { release = resolve })
  const h = harness({ choose: async (_ctx, input) => { await blocked; return { choice: input.options[0].id, reason: '依据', confidence: .9, needsHumanReview: false } } })
  const request = { ...h.invocation, rawInput: '问题 | 甲 | 乙' }
  const first = Array.from({ length: 4 }, () => h.runtime.decide(request))
  assert.match((await h.runtime.decide(request)).text, /繁忙/)
  release()
  assert.ok((await Promise.all(first)).every(row => row.kind === 'success'))
  assert.equal((await h.runtime.decide(request)).kind, 'success')
  h.runtime.dispose()
})

test('abandoned one-shot cannot authorize a subsequent unrelated turn', async () => {
  const h = harness()
  await h.queue()
  h.emit('agent/assistant-stream', { agent: h.agent, frame: { type: 'start', attemptId: 'aborted', revision: 0, turn: 1, step: 1 } })
  h.emit('agent/assistant-stream', { agent: h.agent, frame: { type: 'end', attemptId: 'aborted', revision: 0, index: 0, outcome: { kind: 'abandoned' } } })
  h.emit('agent/assistant-stream', { agent: h.agent, frame: { type: 'start', attemptId: 'unrelated', revision: 0, turn: 2, step: 1 } })
  h.emit('agent/assistant-stream', { agent: h.agent, frame: { type: 'chunk', attemptId: 'unrelated', revision: 0, index: 0, chunk: { type: 'finish', reason: { kind: 'stop' } } } })
  h.emit('agent/assistant-stream', { agent: h.agent, frame: { type: 'end', attemptId: 'unrelated', revision: 0, index: 1, outcome: { kind: 'committed', eventType: 'assistant/message', seq: 1 } } })
  await h.runtime.drain()
  assert.equal(h.pageCalls.length, 0)
  assert.equal(h.calls.length, 0)
  h.runtime.dispose()
})

test('manual project memory survives newer records from other projects', async () => {
  const h = harness()
  book('甲'); book('乙')
  const store = createLearningStore({ cwd, provider: 'writer', model: 'a' })
  store.append({ type: 'learning', summary: '甲专属经验', source: { project: '甲' } })
  for (let i = 0; i < 22; i++) store.append({ type: 'learning', summary: `乙经验${i}`, source: { project: '乙' } })
  const answer = await h.runtime.memory({ ...h.invocation, rawInput: '甲' })
  assert.equal(answer.kind, 'success')
  assert.match(answer.text, /甲专属经验/)
  assert.doesNotMatch(answer.text, /乙经验/)
  h.runtime.dispose()
})

test('task enrichment uses isolated async scopes and leaves unenriched tasks unchanged', async () => {
  assert.equal(await enhanceTaskPrompt({}, '原任务'), '原任务')
  const values = await Promise.all([
    withTaskIntelligence(async (_inv, prompt) => `A:${prompt}`, async () => { await Promise.resolve(); return enhanceTaskPrompt({}, '一') }),
    withTaskIntelligence(async (_inv, prompt) => `B:${prompt}`, async () => enhanceTaskPrompt({}, '二')),
  ])
  assert.deepEqual(values, ['A:一', 'B:二'])
  assert.equal(intelligenceDefinitions().length, 3)
  assert.equal(intelligenceDefinitions()[0].factory().handler({}).kind, 'error')
})

test('auto learning only captures a queued novel response and owns exact observed route', async () => {
  const h = harness({ learning: { summaryProvider: 'summarizer', summaryModel: 's' } })
  await h.stream()
  assert.equal(h.calls.length, 0)
  await h.queue()
  const chunks = h.chunks('小说完成的明确信息。')
  chunks.unshift({ type: 'reasoning-delta', index: 2, text: '不能保存的推理' }, { type: 'tool-call-delta', index: 3, argumentsDelta: '不能保存的工具参数' })
  const options = Object.freeze({ provider: 'routed-provider', model: 'routed-model', sessionId: h.agent.id, messages: Object.freeze([]) })
  const output = await h.stream(options, chunks)
  assert.deepEqual(output, chunks)
  assert.equal(h.calls.length, 0, 'summary starts outside stream critical path')
  await h.runtime.drain()
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].provider, 'summarizer')
  assert.equal(h.calls[0].model, 's')
  assert.equal(h.calls[0].prompt, '小说完成的明确信息。')
  const records = h.records('routed-provider', 'routed-model')
  assert.equal(records.length, 1)
  assert.deepEqual(records[0].generator, { provider: 'summarizer', model: 's' })
  assert.equal(h.records().length, 0)
  await h.stream()
  await h.runtime.drain()
  assert.equal(h.calls.length, 1, 'later arbitrary chat is not harvested')
  h.runtime.dispose()
})

test('untracked agent identity, failed finishes and cancelled streams never learn', async () => {
  const h = harness()
  await h.queue()
  await h.stream({ agent: { id: h.agent.id }, provider: 'writer', model: 'a', sessionId: h.agent.id })
  await h.stream(undefined, h.chunks('失败的部分', 'error'))
  await h.runtime.drain()
  assert.equal(h.calls.length, 0)
  h.runtime.dispose()
})

test('helper LLM calls emit no assistant frames and do not consume novel ownership', async () => {
  const h = harness()
  const original = h.ctx.get
  h.ctx.get = name => name === 'llm' ? {
    listProviders: () => [{ id: 'summary' }],
    resolveModelInfo: (provider, model) => ({ provider, id: model }),
    stream: options => (async function* () { for (const chunk of h.chunks('辅助总结输出')) yield chunk })(),
  } : original(name)
  await h.queue()
  const text = await callText(h.ctx, { provider: 'summary', model: 'm', prompt: '总结', signal: signal() })
  assert.equal(text, '辅助总结输出')
  await h.runtime.drain()
  assert.equal(h.calls.length, 0)
  await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 1)
  assert.doesNotMatch(h.calls[0].prompt, /辅助总结输出/)
  h.runtime.dispose()
})

test('unterminated streams consume the task without learning subsequent arbitrary response', async () => {
  const h = harness()
  await h.queue()
  await h.stream(undefined, [{ type: 'text-delta', index: 0, text: '部分内容' }])
  await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 0)
  h.runtime.dispose()
})

test('cooldown and in-flight job prevent duplicate auto learning', async () => {
  let release
  const blocked = new Promise(resolve => { release = resolve })
  const h = harness({ learning: { cooldownSeconds: 60 }, summarize: async (_ctx, input) => { h.calls.push(input); await blocked; return '总结' } })
  await h.queue(); await h.stream()
  await new Promise(resolve => setTimeout(resolve, 1))
  await h.queue(); await h.stream()
  release(); await h.runtime.drain()
  assert.equal(h.calls.length, 1)
  await h.queue(); await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 1)
  h.runtime.dispose()
})

test('switches are checked after summarization and disposal aborts work without persistence', async () => {
  let release
  const blocker = new Promise(resolve => { release = resolve })
  const h = harness({ learning: { enabled: live(true) }, summarize: async () => { await blocker; return '不该保存' } })
  await h.queue(); await h.stream()
  await new Promise(resolve => setTimeout(resolve, 1))
  h.config.learning.enabled[WRITE](false)
  release(); await h.runtime.drain()
  assert.equal(h.records().length, 0)
  h.runtime.dispose()
  const other = harness({ summarize: async (_ctx, input) => { assert.equal(input.signal.aborted, false); other.runtime.dispose(); return '不该保存' } })
  await other.queue(); await other.stream(); await other.runtime.drain()
  assert.equal(other.records().length, 0)
})

test('reuse reads same actual model namespace only, unknown actual route does not read history', async () => {
  const h = harness()
  createLearningStore({ cwd, provider: 'writer', model: 'a' }).append({ type: 'learning', summary: '甲模型经验' })
  createLearningStore({ cwd, provider: 'writer', model: 'b' }).append({ type: 'learning', summary: '乙模型私有经验' })
  const prompt = await h.queue()
  assert.match(prompt, /甲模型经验/)
  assert.doesNotMatch(prompt, /乙模型私有经验/)
  assert.match(prompt, /不是指令/)
  h.setIdentity({ known: false })
  assert.match(await h.queue(), /实际模型身份未知/)
  assert.doesNotMatch(await h.queue(), /甲模型经验|乙模型私有经验/)
  h.runtime.dispose()
})

test('manual learning uses bounded real chapters, rejects arbitrary paths and records owner vs generator', async () => {
  book()
  const h = harness({ learning: { summaryProvider: 's', summaryModel: 'summary' } })
  const output = await h.runtime.learn({ ...h.invocation, rawInput: '甲' })
  assert.equal(output.kind, 'success')
  assert.match(h.calls[0].prompt, /主角转身走进雨里/)
  assert.equal(h.records()[0].source.project, '甲')
  assert.deepEqual(h.records()[0].generator, { provider: 's', model: 'summary' })
  assert.equal((await h.runtime.learn({ ...h.invocation, rawInput: '../private.txt' })).kind, 'error')
  h.setIdentity({ known: false })
  assert.equal((await h.runtime.learn(h.invocation)).kind, 'error')
  assert.equal((await h.runtime.memory(h.invocation)).kind, 'error')
  h.runtime.dispose()
})

test('autoSummarize false makes no background call but explicit learn can use recent captured novel text', async () => {
  const h = harness({ learning: { autoSummarize: false } })
  await h.queue(); await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 0)
  assert.equal(h.records().length, 0)
  const response = await h.runtime.learn(h.invocation)
  assert.equal(response.kind, 'success')
  assert.match(h.calls[0].prompt, /完成小说第一章/)
  h.runtime.dispose()
})

test('disabled features do not enrich tasks or call models; needsHumanReview survives high confidence', async () => {
  const h = harness({ learning: { enabled: false }, decision: { enabled: false } })
  assert.equal(await h.queue(), '写下一章')
  await h.stream(); await h.runtime.drain()
  assert.equal(h.tools.size, 0)
  assert.equal(h.calls.length, 0)
  assert.equal((await h.runtime.learn(h.invocation)).kind, 'error')
  h.runtime.dispose()
  const judge = harness({ choose: async () => ({ choice: 'option-1', reason: '用户应决定', confidence: .99, needsHumanReview: true }) })
  const response = await judge.runtime.decide({ ...judge.invocation, rawInput: '选择？ | A | B' })
  assert.match(response.text, /"humanRequired": true/)
  judge.runtime.dispose()
})

test('manual learning honors project directory request snapshots', async () => {
  book('乙', 'books')
  const h = harness()
  const response = await withProjectsDirectory('books', () => h.runtime.run({ ...h.invocation, rawInput: '乙' }, () => h.runtime.learn({ ...h.invocation, rawInput: '乙' })))
  assert.equal(response.kind, 'success')
  assert.equal(h.records()[0].source.project, '乙')
  h.runtime.dispose()
})

test('decision tool is opt-in, hot removable and makes actual advisory calls with audit', async () => {
  const h = harness({ decision: { enabled: live(false) } })
  assert.equal(h.tools.size, 0)
  h.config.decision.enabled[WRITE](true); h.emit('settings/document-updated')
  assert.equal(h.tools.size, 1)
  await h.queue()
  const tool = h.tools.get('novel_decide')
  assert.ok(tool.output.schema)
  const input = { question: '让谁发现秘密？', options: [{ id: 'a', label: '主角' }, { id: 'b', label: '对手' }], kind: 'plot' }
  const output = await tool.execute(input, h.invocation)
  assert.equal(output.choice, 'a')
  assert.equal(output.advisoryOnly, true)
  assert.equal(output.humanRequired, false)
  assert.equal(h.calls[0].route.provider, 'judge')
  assert.equal(h.records()[0].type, 'decision')
  assert.deepEqual(h.records()[0].generator, { provider: 'judge', model: 'j' })
  assert.match(tool.output.render(input, output)[0].text, /advisoryOnly/)
  h.config.decision.enabled[WRITE](false); h.runtime.reconcile()
  assert.equal(h.tools.size, 0)
  await assert.rejects(tool.execute(input, h.invocation), /未启用/)
  h.runtime.dispose()
})

test('low-confidence, human-review and source-unknown decisions never grant authorization', async () => {
  const h = harness({ identity: { known: false }, choose: async () => ({ choice: 'option-2', reason: '资料不全', confidence: .4, needsHumanReview: false }) })
  const output = await h.runtime.decide({ ...h.invocation, rawInput: '路线？ | 分支A | 分支B' })
  assert.equal(output.kind, 'success')
  assert.match(output.text, /"humanRequired": true/)
  const record = h.records('judge', 'j')[0]
  assert.match(record.summary, /源模型身份未知/)
  assert.match(record.reference, /不代表会话模型/)
  assert.equal(h.records().length, 0)
  h.config.decision.provider = ''
  assert.equal((await h.runtime.decide({ ...h.invocation, rawInput: '问题 | A | B' })).kind, 'error')
  h.runtime.dispose()
})

test('automatic failures are contained and tool cannot harvest arbitrary agent sessions', async () => {
  const h = harness({ summarize: async () => { throw new Error('模型暂不可用') } })
  await h.queue(); await h.stream(); await h.runtime.drain()
  assert.match(h.runtime.status().lastError, /模型暂不可用/)
  await assert.rejects(h.tools.get('novel_decide').execute({ question: 'x', options: [], kind: 'plot' }, { agent: { id: 'other' }, signal: signal() }), /仅用于/)
  h.runtime.dispose()
  assert.equal(h.tools.size, 0)
})

test('tracking expires and ignores unfinished or duplicate text captures', async () => {
  let time = 1000
  const h = harness({ dependencies: { now: () => time, trackingTtlMs: 50 } })
  await h.queue(); time += 51; await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 0)
  await h.queue()
  await h.stream(undefined, [{ type: 'block-end', index: 0, block: { type: 'text', text: '没有delta的正文' } }, { type: 'finish', reason: { kind: 'stop' } }])
  await h.runtime.drain()
  assert.equal(h.calls[0].prompt, '没有delta的正文')
  h.runtime.dispose()
})


test('no-hook task prompt and bindGoal remain synchronous', () => {
  assert.equal(enhanceTaskPrompt({}, 'direct'), 'direct')
  assert.equal(bindNovelGoal({}, { id: 'unowned' }), undefined)
  let bound
  const enhancer = (_inv, text) => text
  enhancer.bindGoal = (inv, goal) => { bound = { inv, goal } }
  const inv = {}, goal = { id: 'goal-1' }
  withTaskIntelligence(enhancer, () => bindNovelGoal(inv, goal))
  assert.deepEqual(bound, { inv, goal })
})

test('arbitrary LLM calls, titles and compaction do not harvest or consume pending novel response', async () => {
  const h = harness()
  await h.queue()
  for (const purpose of ['title', 'compaction', 'child', 'handbuilt']) {
    h.emit('llm/stream', { provider: 'writer', model: 'a', sessionId: h.agent.id, purpose }, async function* () { yield { type: 'finish', reason: { kind: 'stop' } } })
  }
  await h.runtime.drain()
  assert.equal(h.calls.length, 0)
  assert.equal(h.pageCalls.length, 0)
  await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 1)
  assert.deepEqual(Object.keys(h.pageCalls[0]).sort(), ['address', 'maxMessages', 'throughSeq'])
  assert.deepEqual(h.pageCalls[0].address, { kind: 'session', sessionId: h.agent.id })
  assert.equal(h.pageCalls[0].maxMessages, 1)
  h.runtime.dispose()
})

test('only committed source text blocks are learned, not transient chunks or reasoning', async () => {
  const h = harness({ page: async request => ({ records: [{ type: 'event', event: { type: 'assistant/message', seq: request.throughSeq, data: { turn: 1, step: 1, message: { role: 'assistant', source: { kind: 'model', provider: 'durable', model: 'real' }, content: [{ type: 'reasoning', text: 'private' }, { type: 'text', text: 'committed only' }, { type: 'tool-call', arguments: 'secret' }] } } } }] }) })
  await h.queue(); await h.stream(undefined, h.chunks('uncommitted draft')); await h.runtime.drain()
  assert.equal(h.calls[0].prompt, 'committed only')
  assert.equal(h.records('durable', 'real').length, 1)
  assert.equal(h.records().length, 0)
  h.runtime.dispose()
})

test('missing identity, interrupted and wrong durable events never fallback to observed/current route', async () => {
  for (const defect of ['missing-source', 'interrupted', 'wrong-seq', 'wrong-type', 'wrong-turn', 'wrong-step', 'missing-record']) {
    const h = harness({ page: async request => {
      const data = { turn: 1, step: 1, message: { role: 'assistant', source: { kind: 'model', provider: 'writer', model: 'a' }, content: [{ type: 'text', text: 'forbidden' }] } }
      if (defect === 'missing-source') delete data.message.source
      if (defect === 'interrupted') data.interrupted = true
      if (defect === 'wrong-turn') data.turn = 2
      if (defect === 'wrong-step') data.step = 2
      return { records: defect === 'missing-record' ? [] : [{ type: 'event', event: { type: defect === 'wrong-type' ? 'assistant/attempt' : 'assistant/message', seq: request.throughSeq + (defect === 'wrong-seq' ? 1 : 0), data } }] }
    } })
    await h.queue(); await h.stream(); await h.runtime.drain()
    assert.equal(h.calls.length, 0, defect)
    assert.equal(h.records().length, 0, defect)
    assert.ok(h.runtime.status().lastError, defect)
    h.runtime.dispose()
  }
})

function frames(h, { revision = 1, attemptId = 'attempt', seq = 1, end = {}, finish = 'stop' } = {}) {
  const publish = frame => h.emit('agent/assistant-stream', { agent: h.agent, frame: { revision, attemptId, ...frame } })
  return {
    start: () => publish({ type: 'start', turn: 1, step: revision }),
    finish: () => publish({ type: 'chunk', index: 0, time: 1, chunk: { type: 'finish', reason: { kind: finish } } }),
    end: () => publish({ type: 'end', index: 1, outcome: { kind: 'committed', eventType: 'assistant/message', seq, ...end } }),
    publish,
  }
}

test('wrong attempt/revision, stale sequence and duplicate end frames cannot authorize page reads', async () => {
  const h = harness()
  await h.queue()
  const f = frames(h)
  f.start()
  f.publish({ type: 'chunk', attemptId: 'other', index: 0, chunk: { type: 'finish', reason: { kind: 'stop' } } })
  f.publish({ type: 'end', revision: 0, index: 1, outcome: { kind: 'committed', eventType: 'assistant/message', seq: 1 } })
  assert.equal(h.pageCalls.length, 0)
  f.finish(); f.end(); f.end()
  await h.runtime.drain()
  assert.equal(h.pageCalls.length, 1)
  await h.queue()
  const stale = frames(h, { revision: 2, attemptId: 'new', seq: 1 })
  stale.start(); stale.finish(); stale.end()
  await h.runtime.drain()
  assert.equal(h.pageCalls.length, 1)
  h.runtime.dispose()
})

test('abandoned or assistant-attempt ends are ignored, tool finish preserves pending task', async () => {
  for (const end of [{ kind: 'abandoned' }, { eventType: 'assistant/attempt' }]) {
    const h = harness()
    await h.queue()
    const f = frames(h, { end })
    f.start(); f.finish(); f.end()
    await h.runtime.drain()
    assert.equal(h.pageCalls.length, 0)
    h.runtime.dispose()
  }
  const h = harness()
  await h.queue(); await h.stream(undefined, h.chunks('tool step', 'tool-calls'))
  assert.equal(h.pageCalls.length, 0)
  await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 1)
  h.runtime.dispose()
})

test('page read has bounded deadline even if host ignores abort', async () => {
  let requestSignal
  const h = harness({ page: async (_request, signal) => { requestSignal = signal; return new Promise(() => {}) }, dependencies: { pageTimeoutMs: 10 } })
  const hold = setTimeout(() => {}, 100)
  try {
    await h.queue(); await h.stream(); await h.runtime.drain()
    assert.equal(requestSignal.aborted, true)
    assert.equal(h.calls.length, 0)
    assert.ok(h.runtime.status().lastError)
  } finally { clearTimeout(hold); h.runtime.dispose() }
})

async function ownGoal(h, goal = { id: 'novel-goal', phase: 'active', activation: 'armed' }) {
  h.setGoal(goal)
  await h.runtime.run(h.invocation, async () => {
    await enhanceTaskPrompt(h.invocation, 'novel goal')
    bindNovelGoal(h.invocation, goal)
  })
  return goal
}

test('exact owned goal permits multiple auto rounds and tools only while active and armed', async () => {
  const h = harness()
  const goal = await ownGoal(h)
  await h.stream(); await h.runtime.drain()
  await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 2)
  const advice = await h.tools.get('novel_decide').execute({ question: 'continue?', options: [{ id: 'yes', label: 'yes' }], kind: 'plot' }, { agent: h.agent, signal: signal() })
  assert.equal(advice.advisoryOnly, true)
  h.setGoal({ ...goal, phase: 'paused', activation: 'disarmed' })
  await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 3)
  await assert.rejects(h.tools.get('novel_decide').execute({}, { agent: h.agent, signal: signal() }), /仅用于/)
  h.runtime.dispose()
})

test('paused, disarmed, completed and replaced goals revoke ownership without objective heuristics', async () => {
  for (const change of [{ phase: 'paused' }, { activation: 'disarmed' }, { phase: 'complete' }, { id: 'unrelated-goal', objective: 'novel' }]) {
    const h = harness()
    const goal = await ownGoal(h)
    h.setGoal({ ...goal, ...change })
    await h.stream(); await h.runtime.drain()
    assert.equal(h.calls.length, 0)
    assert.equal(h.pageCalls.length, 0)
    h.runtime.dispose()
  }
})

test('goal idle TTL is refreshed by its responses but expires without activity', async () => {
  let time = 1000
  const h = harness({ dependencies: { now: () => time, trackingTtlMs: 50 } })
  await ownGoal(h)
  time += 40; await h.stream(); await h.runtime.drain()
  time += 40; await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 2)
  time += 51; await h.stream(); await h.runtime.drain()
  assert.equal(h.calls.length, 2)
  h.runtime.dispose()
})

test('explicit newly created project is captured at durable boundary, never raw substring matched', async () => {
  book('Old')
  const h = harness()
  const inv = { ...h.invocation, rawInput: 'a plot mentioning Old inside a sentence' }
  await h.runtime.run(inv, async () => {
    book('New')
    inv.novelProject = 'New'
    await enhanceTaskPrompt(inv, 'write newly created project')
  })
  await h.stream(); await h.runtime.drain()
  assert.equal(h.records()[0].source.project, 'New')
  h.runtime.dispose()
})

test('root and decide command gates remove tool, block calls/directives and recover after reenabling', async () => {
  const h = harness({ rootEnabled: live(false), commands: { decide: live(true) } })
  assert.equal(h.tools.size, 0)
  assert.equal(await h.queue(), '写下一章')
  assert.equal((await h.runtime.decide(h.invocation)).kind, 'error')
  h.config.enabled[WRITE](true); h.emit('settings/document-updated')
  assert.equal(h.tools.size, 1)
  assert.match(await h.queue(), /必须先咨询 novel_decide/)
  h.config.commands.decide[WRITE](false); h.emit('settings/document-updated')
  assert.equal(h.tools.size, 0)
  assert.doesNotMatch(await h.queue(), /novel_decide/)
  assert.equal((await h.runtime.decide(h.invocation)).kind, 'error')
  h.config.commands.decide[WRITE](true); h.emit('settings/document-updated')
  assert.equal(h.tools.size, 1)
  h.runtime.dispose()
})

test('disable and reenable cancels old summary before persistence while allowing future work', async () => {
  let release, started
  const begun = new Promise(resolve => { started = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  let count = 0, observed
  const h = harness({ rootEnabled: live(true), summarize: async (_ctx, input) => { count++; if (count === 1) { observed = input.signal; started(); await blocked } return 'summary' } })
  await h.queue(); await h.stream(); await begun
  h.config.enabled[WRITE](false); h.emit('settings/document-updated')
  assert.equal(observed.aborted, true)
  h.config.enabled[WRITE](true); h.emit('settings/document-updated')
  release(); await h.runtime.drain()
  assert.equal(h.records().length, 0)
  await h.queue(); await h.stream(); await h.runtime.drain()
  assert.equal(h.records().length, 1)
  const status = h.runtime.status()
  assert.equal(status.storageDir, 'novel_learning')
  assert.equal(status.activeJobs, 0)
  assert.equal(status.recordsWrittenThisRun, 1)
  h.runtime.dispose()
})


test('manual learn/memory switches are independent from automatic learning', async () => {
  book()
  const h = harness({ commands: { learn: live(false), memory: live(false) } })
  assert.equal((await h.runtime.learn(h.invocation)).kind, 'error')
  assert.equal((await h.runtime.memory(h.invocation)).kind, 'error')
  await h.queue(); await h.stream(); await h.runtime.drain()
  assert.equal(h.records().length, 1, 'manual command switch must not disable automatic summary')
  h.config.commands.memory[WRITE](true)
  h.config.learning.enabled = false
  h.emit('settings/document-updated')
  assert.equal((await h.runtime.memory(h.invocation)).kind, 'success', 'saved memory may still be read when automatic learning is off')
  h.runtime.dispose()
})

test('decision disabled during call aborts work and prevents audit writes after reenabling', async () => {
  let started, release, observed
  const begin = new Promise(resolve => { started = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  const h = harness({ commands: { decide: live(true) }, choose: async (_ctx, input) => { observed = input.signal; started(); await blocked; return { choice: 'option-1', reason: 'x', confidence: .9, needsHumanReview: false } } })
  const work = h.runtime.decide({ ...h.invocation, rawInput: 'question | A | B' })
  await begin
  assert.equal(h.runtime.status().activeJobs, 1)
  h.config.commands.decide[WRITE](false); h.emit('settings/document-updated')
  assert.equal(observed.aborted, true)
  h.config.commands.decide[WRITE](true); h.emit('settings/document-updated')
  release()
  assert.equal((await work).kind, 'error')
  assert.equal(h.records().length, 0)
  h.runtime.dispose()
})

test('goal replacement while committed page is pending suppresses processing', async () => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const h = harness({ page: async request => { await pending; return { records: [{ type: 'event', event: { type: 'assistant/message', seq: request.throughSeq, data: { turn: 1, step: 1, message: { role: 'assistant', source: { kind: 'model', provider: 'writer', model: 'a' }, content: [{ type: 'text', text: 'old goal' }] } } } }] } } })
  await ownGoal(h)
  await h.stream()
  h.setGoal({ id: 'different', phase: 'active', activation: 'armed' })
  release(); await h.runtime.drain()
  assert.equal(h.calls.length, 0)
  h.runtime.dispose()
})

test('abandoned and assistant-attempt retry can later produce one committed novel response', async () => {
  for (const end of [{ kind: 'abandoned' }, { eventType: 'assistant/attempt' }]) {
    const h = harness()
    await h.queue()
    const f = frames(h, { end, revision: 0 })
    f.start(); f.finish(); f.end()
    await h.stream(); await h.runtime.drain()
    assert.equal(h.calls.length, 1)
    h.runtime.dispose()
  }
})

test('disposing aborts a pending committed-page read and does not learn afterward', async () => {
  let observed
  const h = harness({ page: async (_request, signal) => { observed = signal; return new Promise(() => {}) } })
  await h.queue(); await h.stream()
  h.runtime.dispose()
  await h.runtime.drain()
  assert.equal(observed.aborted, true)
  assert.equal(h.calls.length, 0)
  assert.equal(h.runtime.status().activeJobs, 0)
})


test('distinct attempts may reuse revision numbers while repeated attempt revisions are rejected', async () => {
  const h = harness()
  await ownGoal(h)
  const first = frames(h, { revision: 0, attemptId: 'first', seq: 1, end: { eventType: 'assistant/attempt' } })
  first.start(); first.finish(); first.end()
  const second = frames(h, { revision: 0, attemptId: 'second', seq: 2 })
  second.start(); second.finish(); second.end()
  await h.runtime.drain()
  assert.equal(h.pageCalls.length, 1)
  second.start(); second.finish(); second.end()
  await h.runtime.drain()
  assert.equal(h.pageCalls.length, 1)
  h.runtime.dispose()
})

test('goal created before prompt enhancement retains durable ownership for later rounds', async () => {
  book('Before')
  const h = harness()
  const goal = { id: 'created-first', phase: 'active', activation: 'armed' }
  h.setGoal(goal)
  await h.runtime.run(h.invocation, async () => {
    book('After')
    h.invocation.novelProject = 'After'
    bindNovelGoal(h.invocation, goal)
    await enhanceTaskPrompt(h.invocation, 'new project')
  })
  await h.stream(); await h.runtime.drain()
  await h.stream(); await h.runtime.drain()
  assert.equal(h.records().length, 2)
  assert.equal(h.records()[0].source.project, 'After')
  h.runtime.dispose()
})

test('pausing owned goal during summary prevents final record write', async () => {
  let started, release
  const begin = new Promise(resolve => { started = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  const h = harness({ summarize: async () => { started(); await blocked; return 'stale summary' } })
  const goal = await ownGoal(h)
  await h.stream(); await begin
  h.setGoal({ ...goal, phase: 'paused', activation: 'disarmed' })
  release(); await h.runtime.drain()
  assert.equal(h.records().length, 0)
  h.runtime.dispose()
})
