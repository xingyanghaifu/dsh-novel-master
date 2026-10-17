import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply, inject, name, Config, definitions } from '../src/index.js'
import { chapterTarget, extractOptions, leadingChapter } from '../src/args.js'
import { splitChapters, decodeText } from '../src/importer.js'
import { textStats } from '../src/cmd-study.js'

let cwd
beforeEach(() => { cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-')) })
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }) })

/**
 * Read a resolved config field, unwrapping the live reference that
 * `.volatile()` produces (see src/index.js).
 */
const VOLATILE_REF = Symbol.for('cosmokit.volatile.write')
function readConfig(config, key) {
  const value = config?.[key]
  return typeof value === 'object' && value !== null && VOLATILE_REF in value ? value.get() : value
}

/** Fake host: command registry + optional goal service + one agent. */
function host({ goals = true, config = {}, services = {} } = {}) {
  const commands = new Map()
  const created = []
  let current
  const goalService = {
    get: () => current,
    create: (_agent, req) => { current = { ...req, phase: 'active' }; created.push(req); return current },
  }
  const listeners = new Map()
  const ctx = {
    logger: { warn() {}, info() {} },
    commands: { register: (d) => {
      assert.equal(commands.has(d.name), false, `duplicate command ${d.name}`)
      commands.set(d.name, d)
      return () => { if (commands.get(d.name) === d) commands.delete(d.name) }
    } },
    get: (key) => (key === 'goals' && goals ? goalService : services[key]),
    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set()
      listeners.set(event, set)
      set.add(listener)
      return () => set.delete(listener)
    },
  }
  const emit = (event, ...args) => { for (const listener of [...(listeners.get(event) ?? [])]) listener(...args) }
  apply(ctx, config)
  const followups = []
  const agent = { id: 'test-novel-session', session: { header: { cwd } }, followup: (m) => followups.push(m) }
  const run = (cmd, rawInput = '', attachments = []) =>
    commands.get(cmd).handler({ agent, rawInput, attachments, signal: new AbortController().signal })
  return { commands, created, followups, run, emit, setGoal: (g) => { current = g } }
}

const CREATIVE_COUNT = definitions({}).length

const proj = (n) => path.join(cwd, 'novel_projects', n)

test('plugin metadata and Config schema are valid', () => {
  assert.equal(name, 'novel-master')
  assert.deepEqual(inject, ['commands'])

  // Cordis validates the raw profile row through Config["~standard"].validate(),
  // so the export must be a schemastery schema instance, not a plain object.
  assert.equal(typeof Config['~standard']?.validate, 'function')

  const resolved = Config['~standard'].validate({})
  assert.equal(resolved.issues, undefined)
  assert.equal(readConfig(resolved.value, 'enabled'), true)
  assert.equal(readConfig(resolved.value, 'projectsDir'), 'novel_projects')
  assert.equal(Object.keys(resolved.value.commands).length, CREATIVE_COUNT)
  for (const key of Object.keys(resolved.value.commands)) {
    assert.equal(readConfig(resolved.value.commands, key), true, `${key} should default to true`)
  }

  // A partial row keeps the other defaults.
  const partial = Config['~standard'].validate({ commands: { novel: false } })
  assert.equal(partial.issues, undefined)
  assert.equal(readConfig(partial.value.commands, 'novel'), false)
  assert.equal(readConfig(partial.value.commands, 'market'), true)
})

test('entry integrates real decision calls, audit storage and live tool gating', async () => {
  const tools = new Map(), calls = []
  const config = { decision: { enabled: true, provider: 'judge', model: 'decision-model', minConfidence: 0.5 }, learning: { enabled: false } }
  const services = {
    tools: { register(definition) { assert.ok(definition.output.schema); assert.equal(typeof definition.output.render, 'function'); tools.set(definition.name, definition); return () => tools.delete(definition.name) } },
    sessionController: { inspect: async () => ({ events: [{ type: 'assistant/message', seq: 1, data: { message: { source: { kind: 'model', provider: 'writer', model: 'book-model' } } } }] }) },
    llm: {
      listProviders: () => [{ id: 'judge' }],
      resolveModelInfo: async (provider, model) => ({ provider, id: model }),
      stream: async function* (options) { calls.push(options); yield { type: 'text-delta', index: 0, text: JSON.stringify({ choice: 'option-1', reason: '保留既有线索', confidence: 0.55, needsHumanReview: false }) }; yield { type: 'finish', reason: { kind: 'stop' } } },
    },
  }
  const h = host({ config, services, goals: false })
  assert.equal(tools.has('novel_decide'), true)
  const answer = await h.run('novel-decide', '如何安排？ | 先铺垫 | 直接揭示')
  assert.equal(answer.kind, 'success')
  assert.match(answer.text, /"humanRequired": false/)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].provider, 'judge')
  assert.deepEqual(calls[0].tools, [])
  assert.ok(fs.existsSync(path.join(cwd, 'novel_learning')))
  config.commands = { decide: false }
  h.emit('settings/document-updated')
  assert.equal(tools.has('novel_decide'), false)
  assert.equal(h.commands.has('novel-decide'), false)
  config.commands.decide = true
  h.emit('settings/document-updated')
  assert.equal(tools.has('novel_decide'), true)
  config.enabled = false
  h.emit('settings/document-updated')
  assert.equal(tools.has('novel_decide'), false)
  assert.deepEqual([...h.commands.keys()], ['novel-update'])
  h.emit('dispose')
})

test('config.enabled: false disables all commands', () => {
  const h = host({ config: { enabled: false } })
  assert.deepEqual([...h.commands.keys()], ['novel-update'])
})

test('config.commands selective disable', () => {
  const h = host({ config: { commands: { novel: false, study: false, export: false } } })
  assert.equal(h.commands.has('novel'), false)
  assert.equal(h.commands.has('novel-study'), false)
  assert.equal(h.commands.has('novel-export'), false)
  assert.equal(h.commands.has('novel-continue'), true)
  assert.equal(h.commands.has('novel-outline'), true)
  assert.equal(h.commands.size, CREATIVE_COUNT - 1 - 3 + 1) // 资料检索默认关闭；更新维护命令仍可用
})

test('default config enables every creative command and update maintenance', () => {
  const h = host()
  assert.equal(h.commands.size, CREATIVE_COUNT)
  assert.equal(h.commands.has('novel-research'), false) // 资料检索默认关闭
  for (const [n, d] of h.commands) {
    assert.match(n, /^[a-z][a-z0-9_-]*$/u)
    assert.ok(d.description.length > 0)
    assert.ok(d.definitionId.startsWith('dsh-novel-master/'))
  }
})

test('live config toggles reconcile without duplicate registrations and dispose cleanly', () => {
  const config = Config['~standard'].validate({ enabled: false }).value
  const h = host({ config })
  assert.deepEqual([...h.commands.keys()], ['novel-update'])
  config.enabled[VOLATILE_REF](true)
  h.emit('settings/document-updated', 'include:novel-master', 1)
  assert.equal(h.commands.size, CREATIVE_COUNT)
  const unchanged = h.commands.get('novel-continue')
  config.commands.novel[VOLATILE_REF](false)
  h.emit('settings/document-updated', 'include:novel-master', 2)
  h.emit('app-boot/config-reload')
  assert.equal(h.commands.has('novel'), false)
  assert.equal(h.commands.get('novel-continue'), unchanged)
  assert.equal(h.commands.size, CREATIVE_COUNT - 1)
  config.commands.novel[VOLATILE_REF](true)
  h.emit('app-boot/config-reload')
  assert.equal(h.commands.has('novel'), true)
  config.enabled[VOLATILE_REF](false)
  h.emit('settings/document-updated', 'include:novel-master', 3)
  assert.deepEqual([...h.commands.keys()], ['novel-update'])
  config.enabled[VOLATILE_REF](true)
  h.emit('app-boot/config-reload')
  h.emit('dispose')
  assert.equal(h.commands.size, 0)
  h.emit('app-boot/config-reload')
  h.emit('settings/document-updated', 'include:novel-master', 4)
  assert.equal(h.commands.size, 0)
})

test('research command registers only after its opt-in switch is enabled', () => {
  const config = Config['~standard'].validate({ research: { enabled: false } }).value
  const h = host({ config })
  assert.equal(h.commands.has('novel-research'), false)
  config.research.enabled[VOLATILE_REF](true)
  h.emit('settings/document-updated', 'include:novel-master', 1)
  assert.equal(h.commands.has('novel-research'), true)
  config.commands.research[VOLATILE_REF](false)
  h.emit('app-boot/config-reload')
  assert.equal(h.commands.has('novel-research'), false)
  config.commands.research[VOLATILE_REF](true)
  config.research.enabled[VOLATILE_REF](false)
  h.emit('settings/document-updated', 'include:novel-master', 2)
  assert.equal(h.commands.has('novel-research'), false)
})
test('directory setting changes apply on the next command invocation', async () => {
  const config = Config['~standard'].validate({ projectsDir: 'books/first' }).value
  const h = host({ config, goals: false })
  assert.equal((await h.run('novel', '第一本 3章')).kind, 'success')
  assert.ok(fs.existsSync(path.join(cwd, 'books/first')))
  config.projectsDir[VOLATILE_REF]('books/second')
  assert.equal((await h.run('novel', '第二本 3章')).kind, 'success')
  assert.ok(fs.existsSync(path.join(cwd, 'books/second')))
  assert.equal(fs.existsSync(path.join(cwd, 'novel_projects')), false)
  config.projectsDir[VOLATILE_REF]('../outside')
  assert.equal((await h.run('novel', '不应创建 3章')).kind, 'error')
})

test('option parsing', () => {
  assert.deepEqual(extractOptions('网管修仙 80章 --auto'), { auto: true, chapters: 80, rest: '网管修仙' })
  assert.equal(chapterTarget(extractOptions('x 20万字')), 80)
  assert.equal(chapterTarget(extractOptions('x')), 40)
  assert.equal(chapterTarget({ chapters: 99999 }), 2000)
  assert.deepEqual(leadingChapter('第12章 节奏快点'), { chapter: 12, note: '节奏快点' })
})

test('/novel creates project, workflow and a goal', async () => {
  const h = host()
  const r = await h.run('novel', '网管发现网吧电脑能修仙 30章')
  assert.equal(r.kind, 'success')
  const [dir] = fs.readdirSync(path.join(cwd, 'novel_projects'))
  for (const f of ['写作规范.md', '完本流程.md', '世界状态.md', '剧情树.md', '伏笔.md', '角色.md', '设定.md', '脑洞.md', '项目.json']) {
    assert.ok(fs.existsSync(path.join(proj(dir), f)), f)
  }
  const state = JSON.parse(fs.readFileSync(path.join(proj(dir), '项目.json'), 'utf8'))
  assert.equal(state.target, 30)
  assert.equal(state.branchMode, 'ask')
  assert.equal(h.created.length, 1)
  assert.match(h.created[0].objective, /完本流程\.md/u)
  assert.equal(h.created[0].maxGoalRounds, 40)
  assert.match(fs.readFileSync(path.join(proj(dir), '完本流程.md'), 'utf8'), /ask_user_question/u)
})

test('/novel refuses while another goal is active and without an idea', async () => {
  const h = host()
  assert.equal((await h.run('novel', '')).kind, 'error')
  h.setGoal({ phase: 'active', objective: 'other' })
  assert.equal((await h.run('novel', '某个脑洞')).kind, 'error')
  assert.equal(fs.existsSync(path.join(cwd, 'novel_projects')), false)
})

test('/novel falls back to turn-by-turn without a goal service', async () => {
  const h = host({ goals: false })
  const r = await h.run('novel', '末日种田 --auto')
  assert.equal(r.kind, 'success')
  assert.equal(h.followups.length, 1)
  assert.match(h.followups[0].content.at(-1).text, /完本流程\.md/u)
})

test('/novel-continue imports a txt file and targets done + N', async () => {
  const file = path.join(cwd, '旧作.txt')
  fs.writeFileSync(file, '第一章 开端\n他醒了。\n\n第二章 出门\n他出门了。\n第3章 回家\n他回来了。\n')
  const h = host()
  const r = await h.run('novel-continue', '旧作.txt 5章')
  assert.equal(r.kind, 'success', r.text)
  assert.deepEqual(fs.readdirSync(path.join(proj('旧作'), '正文')).sort(), ['第1章_开端.md', '第2章_出门.md', '第3章_回家.md'])
  assert.equal(JSON.parse(fs.readFileSync(path.join(proj('旧作'), '项目.json'), 'utf8')).target, 8)
  assert.match(fs.readFileSync(path.join(proj('旧作'), '完本流程.md'), 'utf8'), /续写/u)
  assert.equal(h.created.at(-1).maxGoalRounds, 15)
})

test('/novel-continue without any project errors', async () => {
  assert.equal((await host().run('novel-continue', '')).kind, 'error')
})

test('/novel-study computes stats and applies to project', async () => {
  const h = host()
  await h.run('novel', '测试书 3章')
  const [book] = fs.readdirSync(path.join(cwd, 'novel_projects'))
  fs.writeFileSync(path.join(cwd, 'ref.txt'), '第一章 雨\n“走吧。”\n他没动。\n雨很大。\n')
  const r = await h.run('novel-study', `ref.txt --to ${book}`)
  assert.equal(r.kind, 'success', r.text)
  const prompt = h.followups.at(-1).content.at(-1).text
  assert.match(prompt, /平均句长/u)
  assert.match(prompt, /写作规范\.md/u)
  assert.ok(fs.existsSync(path.join(cwd, 'novel_projects', '_风格档案')))
  assert.equal((await h.run('novel-study', 'missing.txt')).kind, 'error')
})

test('helper commands resolve the latest project', async () => {
  const h = host()
  await h.run('novel', '测试书 3章')
  const [book] = fs.readdirSync(path.join(cwd, 'novel_projects')).filter((n) => !n.startsWith('_'))
  const body = path.join(proj(book), '正文')
  fs.writeFileSync(path.join(body, '第1章_起.md'), '# 第1章 起\n\n“你好。”他说。\n')
  fs.writeFileSync(path.join(body, '第3章_终.md'), '# 第3章 终\n\n结束了。\n')
  for (const c of ['novel-outline', 'novel-cast', 'novel-review', 'novel-spark']) {
    assert.equal((await h.run(c, '')).kind, 'success', c)
  }
  assert.equal((await h.run('novel-rewrite', '1 节奏快点')).kind, 'success')
  assert.equal((await h.run('novel-rewrite', '9')).kind, 'error')
  assert.equal((await h.run('novel-idea', '')).kind, 'error')
  assert.equal((await h.run('novel-idea', '会说话的猫')).kind, 'success')
  const stats = await h.run('novel-stats', '')
  assert.match(stats.text, /2 章/u)
  assert.match(stats.text, /缺章：2/u)
  assert.match((await h.run('novel-world', '')).text, /世界时钟/u)
  assert.equal((await h.run('novel-role', '')).kind, 'success')
  const exp = await h.run('novel-export', 'html')
  assert.equal(exp.kind, 'success', exp.text)
  const html = fs.readdirSync(path.join(proj(book), '导出')).find((f) => f.endsWith('.html'))
  assert.match(fs.readFileSync(path.join(proj(book), '导出', html), 'utf8'), /第3章 终/u)
  assert.ok(fs.existsSync(path.join(proj(book), '目录.md')))
})

test('importer helpers', () => {
  assert.equal(splitChapters('没有章节标题的一段文字').length, 1)
  assert.equal(decodeText(Buffer.from([0xef, 0xbb, 0xbf, 0x61])), 'a')
  const gbk = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]) // 你好 in GBK
  assert.equal(decodeText(gbk), '你好')
  const s = textStats('“走。”\n他走了。')
  assert.ok(s.dialogueRatio > 0)
})
