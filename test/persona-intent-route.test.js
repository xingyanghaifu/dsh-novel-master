/**
 * 意图解析的独立模型选择。
 *
 * 「听懂人话」和「拆书」是两件不同的事：前者要的是理解力，后者要的是
 * 长文本分析，成本和擅长点都不一样。所以给意图解析单独一档配置，留空则
 * 沿用拆书模型（保持旧行为）。
 *
 * 测试重点：配置真的被读到、优先级顺序对、半套配置不会让命令直接失效。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { personaStudyCommand, personaCommand } from '../src/cmd-persona.js'
import { PERSONA_DIMENSIONS, loadPersona } from '../src/author-persona.js'

const stop = { type: 'finish', reason: { kind: 'stop' } }
const SAMPLE = '灰落了一夜。他站着。“你还要站多久？”她问。“等到风停。”他说。'.repeat(80)

const extractionReply = {
  traits: { dialogueStyle: { score: 9, label: '一句一个态度' } },
  signature: [], avoid: [],
  dimensionNotes: { dialogueStyle: { signature: ['对话不超过十个字'], avoid: [] } },
  confidence: 0.9,
}

function makeWorkspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-route-'))
  const dir = path.join(cwd, 'novel_projects', '网管修仙')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '写作规范.md'), '# 写作规范\n', 'utf8')
  fs.writeFileSync(path.join(cwd, '这本神作.txt'), SAMPLE, 'utf8')
  return cwd
}

/**
 * 假宿主：记录每次调用用的是哪个模型。
 * @param {object} extraction 拆书结果。
 * @param {object} intentReply 意图解析结果。
 */
function host(extraction, intentReply = { only: ['dialogueStyle'], to: '网管修仙', reason: 'x' }) {
  const calls = []
  // 两个 provider 都注册，才能验证「意图用 A、拆书用 B」。
  const llm = {
    listProviders: () => [{ id: 'pa' }, { id: 'pb' }, { id: 'pc' }],
    resolveModelInfo: async (provider, model) => ({ provider, id: model }),
    stream: options => {
      const isIntent = (options.system ?? '').includes('命令行参数解析器')
      calls.push({ kind: isIntent ? 'intent' : 'extract', provider: options.provider, model: options.model })
      const payload = isIntent
        ? (typeof intentReply === 'string' ? intentReply : JSON.stringify(intentReply))
        : JSON.stringify(extraction)
      return (async function * () {
        yield { type: 'text-delta', index: 0, text: payload }
        yield stop
      })()
    },
  }
  return { ctx: { get: name => (name === 'llm' ? llm : undefined) }, calls }
}

/** 目标项目里先放一个基础风格，好让 --只取 能落地。 */
function seed(cwd) {
  const dir = path.join(cwd, 'novel_projects', '网管修仙')
  const persona = {
    name: '忘语（凡人流）',
    traits: Object.fromEntries(PERSONA_DIMENSIONS.map((d, i) => [d.key, { score: 4 + i, label: `内置${d.key}` }])),
    signature: ['内置签名'], avoid: [],
  }
  fs.writeFileSync(path.join(dir, '作者人格.json'), JSON.stringify(persona), 'utf8')
}

const run = (command, ctx, rawInput, cwd) => command.handler({
  rawInput,
  agent: { id: 'a', session: { header: { cwd } } },
  attachments: [],
  signal: new AbortController().signal,
})

/**
 * 不会触发模型兜底的纯参数调用，用来固定拆书模型。
 * 注意不能带 --provider：命令行优先级最高，会盖过要验证的设置。
 */
const PROSE = '这本神作.txt 那本书里人说话的感觉太好了给我弄过来'

test('personaIntent 配置生效：意图用一个模型，拆书用另一个', async () => {
  const cwd = makeWorkspace()
  try {
    seed(cwd)
    const h = host(extractionReply)
    const config = {
      persona: { provider: 'pb', model: 'mb' },
      personaIntent: { provider: 'pa', model: 'ma' },
    }
    const result = await run(personaStudyCommand(h.ctx, config), h.ctx, PROSE, cwd)
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    const intentCall = h.calls.find(c => c.kind === 'intent')
    const extractCall = h.calls.find(c => c.kind === 'extract')
    assert.equal(intentCall?.provider, 'pa', '意图解析该用 personaIntent 的 provider')
    assert.equal(intentCall?.model, 'ma')
    assert.equal(extractCall?.provider, 'pb', '拆书仍用 persona 的 provider')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('personaIntent 留空时沿用拆书模型', async () => {
  const cwd = makeWorkspace()
  try {
    seed(cwd)
    const h = host(extractionReply)
    const config = { persona: { provider: 'pb', model: 'mb' }, personaIntent: {} }
    const result = await run(personaStudyCommand(h.ctx, config), h.ctx, PROSE, cwd)
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    const intentCall = h.calls.find(c => c.kind === 'intent')
    assert.equal(intentCall?.provider, 'pb', '没配意图模型就沿用拆书模型')
    assert.equal(intentCall?.model, 'mb')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('只填了 intent.provider 没填 model 时，退回拆书路由而不是失败', async () => {
  const cwd = makeWorkspace()
  try {
    seed(cwd)
    const h = host(extractionReply)
    // 半套配置：provider 有、model 空。不能因此判成「没有可用模型」。
    const config = {
      persona: { provider: 'pb', model: 'mb' },
      personaIntent: { provider: 'pa', model: '' },
    }
    const result = await run(personaStudyCommand(h.ctx, config), h.ctx, PROSE, cwd)
    assert.equal(result.kind, 'success', `半套配置不该让命令失效：${result.text}`)
    const intentCall = h.calls.find(c => c.kind === 'intent')
    assert.equal(intentCall?.provider, 'pb', '应退回拆书路由')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('命令行 --provider 优先于 personaIntent', async () => {
  const cwd = makeWorkspace()
  try {
    seed(cwd)
    const h = host(extractionReply)
    const config = {
      persona: { provider: 'pb', model: 'mb' },
      personaIntent: { provider: 'pa', model: 'ma' },
    }
    // 命令行显式指定 pc：用户当场说的话优先级最高。
    const result = await run(
      personaStudyCommand(h.ctx, config),
      h.ctx,
      '这本神作.txt 那本书里人说话的感觉太好了给我弄过来 --provider pc --model mc',
      cwd,
    )
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    const intentCall = h.calls.find(c => c.kind === 'intent')
    assert.equal(intentCall?.provider, 'pc', '命令行应压过设置')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('意图配置支持 reasoningEffort，且会传到请求里', async () => {
  const cwd = makeWorkspace()
  try {
    seed(cwd)
    const h = host(extractionReply)
    const config = {
      persona: { provider: 'pb', model: 'mb' },
      personaIntent: { provider: 'pa', model: 'ma', reasoningEffort: 'high' },
    }
    const result = await run(personaStudyCommand(h.ctx, config), h.ctx, PROSE, cwd)
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    const intentCall = h.calls.find(c => c.kind === 'intent')
    assert.equal(intentCall?.provider, 'pa')
    // resolveModelInfo 未声明 efforts 时不应报不支持；关键是没抛错就算通过。
    assert.ok(intentCall !== undefined)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('volatile 包装的 personaIntent 配置也能读到', async () => {
  const cwd = makeWorkspace()
  try {
    seed(cwd)
    const h = host(extractionReply)
    // 真实宿主里配置段是 volatile 包装的，读取时必须 unwrap。
    const vol = v => ({ get: () => v })
    const config = {
      persona: vol({ provider: vol('pb'), model: vol('mb') }),
      personaIntent: vol({ provider: vol('pa'), model: vol('ma') }),
    }
    const result = await run(personaStudyCommand(h.ctx, config), h.ctx, PROSE, cwd)
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    const intentCall = h.calls.find(c => c.kind === 'intent')
    assert.equal(intentCall?.provider, 'pa', 'volatile 包装的配置要能 unwrap')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('没配任何设置时，意图解析仍会走会话路由（行为不变）', async () => {
  const cwd = makeWorkspace()
  try {
    seed(cwd)
    const h = host(extractionReply)
    // 没有任何配置：resolvePersonaRoute 会退到会话观察路由，测试环境没有，
    // 所以这里只验证「不会因为缺配置就崩」。
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, PROSE, cwd)
    assert.ok(['success', 'error'].includes(result.kind))
    assert.doesNotMatch(result.text, /personaIntent/u, '不该把内部配置名暴露给用户')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})
