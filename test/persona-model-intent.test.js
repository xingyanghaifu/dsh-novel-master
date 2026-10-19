/**
 * 模型兜底识别：规则认不出的说法，交给模型理解。
 *
 * 规则（parseNaturalIntent）只能覆盖固定说法，遇到「把那份对白的味道挪
 * 过去」就认不出。这一层让模型在**已给出的候选范围内**挑：项目必须真实
 * 存在，维度必须是六个之一 —— 不让模型凭空造参数。
 *
 * 测试重点：
 * 1. 规则能认时不该多花一次请求（省钱、可预测）。
 * 2. 规则认不出时模型接得上，且只返回候选内的值。
 * 3. 模型也不懂时，明确报错而不是假装成功。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { personaStudyCommand, personaCommand, modelIntent } from '../src/cmd-persona.js'
import { PERSONA_DIMENSIONS, loadPersona } from '../src/author-persona.js'

const stop = { type: 'finish', reason: { kind: 'stop' } }
const SAMPLE = '灰落了一夜。他站着。“你还要站多久？”她问。“等到风停。”他说。'.repeat(80)
const route = Object.freeze({ provider: 'p', model: 'm' })

function makeWorkspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-model-'))
  const dir = path.join(cwd, 'novel_projects', '网管修仙')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '写作规范.md'), '# 写作规范\n', 'utf8')
  fs.writeFileSync(path.join(cwd, '这本神作.txt'), SAMPLE, 'utf8')
  return cwd
}

/**
 * 造一个假宿主。
 * @param {object} extraction 拆书结果（给 extractPersona 用）。
 * @param {object|string} intentReply 模型解析意图返回的内容。
 */
function host(extraction, intentReply = { only: [], to: null, reason: '无' }) {
  const calls = []
  const llm = {
    listProviders: () => [{ id: 'p' }],
    resolveModelInfo: async (provider, model) => ({ provider, id: model }),
    stream: options => {
      // callText 把 system 放在顶层，messages 里只有 user 的 prompt。
      const system = options.system ?? ''
      const text = options.messages?.[0]?.content?.[0]?.text ?? ''
      // 意图解析请求带「命令行参数解析器」这个系统提示，据此区分两类调用。
      const isIntent = system.includes('命令行参数解析器')
      calls.push({ kind: isIntent ? 'intent' : 'extract', system, text })
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

const extractionReply = {
  traits: { dialogueStyle: { score: 9, label: '一句一个态度' } },
  signature: [], avoid: [],
  dimensionNotes: { dialogueStyle: { signature: ['对话不超过十个字'], avoid: [] } },
  confidence: 0.9,
}

const run = (command, ctx, rawInput, cwd) => command.handler({
  rawInput,
  agent: { id: 'a', session: { header: { cwd } } },
  attachments: [],
  signal: new AbortController().signal,
})

test('modelIntent 只接受候选内的维度与项目', async () => {
  const h = host(extractionReply, { only: ['dialogueStyle', '编造维度'], to: '网管修仙', reason: 'x' })
  const result = await modelIntent(h.ctx, route, '随便说点什么', ['网管修仙', '另一本'], new AbortController().signal)
  assert.ok(result !== null)
  assert.equal(result.only, 'dialogueStyle', '编造的维度要丢掉')
  assert.equal(result.to, '网管修仙')
})

test('modelIntent 拒绝候选外的项目名，不让模型凭空指定', async () => {
  const h = host(extractionReply, { only: ['dialogueStyle'], to: '不存在的书', reason: 'x' })
  const result = await modelIntent(h.ctx, route, '拼到那本书上', ['网管修仙'], new AbortController().signal)
  assert.equal(result.to, undefined, '候选外的项目必须被丢弃')
})

test('modelIntent 什么都没认出时返回 null', async () => {
  const h = host(extractionReply, { only: [], to: null, reason: '听不懂' })
  assert.equal(await modelIntent(h.ctx, route, '嗯', ['网管修仙'], new AbortController().signal), null)
})

test('modelIntent 对模型返回的垃圾文本不抛错，只是认不出', async () => {
  const h = host(extractionReply, '这不是 JSON')
  assert.equal(await modelIntent(h.ctx, route, '随便', ['网管修仙'], new AbortController().signal), null)
})

test('规则能认全时不额外调用模型', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    // 规则完全认得：显式 --只取 与 --to 都给全了。
    const h = host(extractionReply)
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本神作.txt --只取 对话 --to 网管修仙 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    assert.equal(h.calls.filter(c => c.kind === 'intent').length, 0, '显式参数不该触发意图解析请求')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('纯参数调用（中文文件名）不触发意图解析', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    // 全量分析要返回六个维度，否则校验器会拒绝。
    const all = Object.fromEntries(PERSONA_DIMENSIONS.map((d, i) => [d.key, { score: i, label: 'x' }]))
    const h = host({ traits: all, signature: ['s'], avoid: [] })
    // 只有中文文件名和参数，没有任何自然语言。
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本神作.txt --to 网管修仙 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    assert.equal(h.calls.filter(c => c.kind === 'intent').length, 0, '中文文件名不是自然语言')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('规则认不出的说法由模型接住并真正拼接', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const before = loadPersona(cwd, '网管修仙')
    // 「把对白的味道挪过去」——「挪」不在规则动词表里，规则会认不出这是拼接；
    // 但「对白」现在是维度的别名，所以 only 能认出来，to 认不出。
    // 用更彻底的黑话：完全不含维度词，全交给模型。
    const h = host(extractionReply, { only: ['dialogueStyle'], to: '网管修仙', reason: '用户想把对话搬过去' })
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本神作.txt 那本书里人说话的感觉太好了，给我弄过来 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `模型兜底失败：${result.text}`)
    assert.ok(h.calls.some(c => c.kind === 'intent'), '应该问过模型')
    const after = loadPersona(cwd, '网管修仙')
    assert.equal(after.traits.dialogueStyle.score, 9, '对话维度应被拼接')
    // 其余维度保持原样。
    for (const dimension of PERSONA_DIMENSIONS) {
      if (dimension.key === 'dialogueStyle') continue
      assert.deepEqual(after.traits[dimension.key], before.traits[dimension.key], `${dimension.key} 被改动`)
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('规则与模型都认不出时，明确报错而不是瞎跑', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const h = host(extractionReply, { only: [], to: null, reason: '听不懂' })
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本神作.txt 随便弄弄 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'error')
    assert.match(result.text, /没听懂/u)
    // 要给出可照抄的参数写法，而不是只说不懂。
    assert.match(result.text, /--只取/u)
    assert.match(result.text, /网管修仙/u, '要列出真实存在的项目')
    assert.equal(h.calls.filter(c => c.kind === 'extract').length, 0, '听不懂时不该发起拆书请求')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('模型补出的项目名会真实参与后续流程', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    // 用户没说清拼给谁，规则认不出，模型从候选里挑。
    const h = host(extractionReply, { only: ['dialogueStyle'], to: '网管修仙', reason: 'x' })
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本神作.txt 人说话的感觉给我弄过来 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    assert.match(result.text, /网管修仙/u, '回执应指向模型选出的项目')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('意图解析请求里包含真实项目名与维度清单，模型才有据可依', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const h = host(extractionReply, { only: ['dialogueStyle'], to: '网管修仙', reason: 'x' })
    await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本神作.txt 人说话的感觉给我弄过来 --provider p --model m',
      cwd,
    )
    const intentCall = h.calls.find(c => c.kind === 'intent')
    assert.ok(intentCall !== undefined)
    assert.match(intentCall.system, /网管修仙/u, '要把真实项目名告诉模型')
    for (const dimension of PERSONA_DIMENSIONS) {
      assert.match(intentCall.system, new RegExp(dimension.key, 'u'), `缺维度 ${dimension.key}`)
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('模型返回的维度顺序与数量被正确采用', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const h = host({
      traits: { dialogueStyle: { score: 9, label: 'a' }, conflictIntensity: { score: 8, label: 'b' } },
      signature: [], avoid: [],
      dimensionNotes: {
        dialogueStyle: { signature: ['短'], avoid: [] },
        conflictIntensity: { signature: ['压'], avoid: [] },
      },
      confidence: 0.9,
    }, { only: ['dialogueStyle', 'conflictIntensity'], to: '网管修仙', reason: 'x' })
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本神作.txt 人说话和冲突都给我弄过来 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    const after = loadPersona(cwd, '网管修仙')
    assert.ok(after.mergedFrom.dialogueStyle !== undefined)
    assert.ok(after.mergedFrom.conflictIntensity !== undefined)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})
