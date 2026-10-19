/**
 * 作者人格命令实测：/novel-persona 与 /novel-persona-study。
 *
 * 重点验证三件容易出错的事：
 * 1. 指定模型（--provider/--model）真的用了指定的那个，而不是会话模型。
 * 2. 没有可用路由时明确报错，不猜一个模型把参考作品发出去。
 * 3. 人格落盘之后，写作命令的提示词里真的出现了风格。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { personaCommand, personaStudyCommand } from '../src/cmd-persona.js'
import { BUILTIN_PERSONA_IDS, PERSONA_DIMENSIONS, PERSONA_FILE, loadPersona } from '../src/author-persona.js'
import { continueCommand } from '../src/cmd-write.js'

const stop = { type: 'finish', reason: { kind: 'stop' } }
const SAMPLE = '灰落了一夜。他站着，没有动。“你还要站多久？”她问。“等到风停。”他说。'.repeat(60)

/** 造工作区：一个项目 + 一份参考作品。 */
function makeWorkspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-persona-cmd-'))
  const dir = path.join(cwd, 'novel_projects', '测试书')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '写作规范.md'), '# 写作规范\n\n通用口径。\n', 'utf8')
  fs.writeFileSync(path.join(dir, '正文', '第1章_灰烬.md'), '# 第1章 灰烬\n\n正文。\n', 'utf8')
  fs.writeFileSync(path.join(cwd, '参考.txt'), SAMPLE, 'utf8')
  return cwd
}

/** 假宿主：记录每次模型请求，返回指定人格 JSON。 */
function host({ reply, efforts = [{ id: 'high' }, { id: 'low' }], providers = ['host-provider', 'deepseek', 'cfg-provider', 'vw-provider', 'p'] } = {}) {
  const calls = []
  const payload = reply ?? {
    traits: Object.fromEntries(PERSONA_DIMENSIONS.map((dimension, index) => [
      dimension.key,
      { score: index + 2, label: `${dimension.label}说明` },
    ])),
    signature: ['遇事先算代价'],
    avoid: [],
    closestMatch: 'wangyu-classic',
    confidence: 0.8,
  }
  const llm = {
    listProviders: () => providers.map(id => ({ id })),
    resolveModelInfo: async (provider, model) => ({ provider, id: model, reasoning: { efforts } }),
    stream: options => {
      calls.push(options)
      return (async function * () {
        yield { type: 'text-delta', index: 0, text: typeof payload === 'string' ? payload : JSON.stringify(payload) }
        yield stop
      })()
    },
  }
  return { ctx: { get: name => (name === 'llm' ? llm : undefined) }, calls }
}

/** 没有任何 llm / sessionController 的宿主。 */
function bareHost() {
  return { ctx: { get: () => undefined }, calls: [] }
}

const run = (command, ctx, rawInput, cwd, extra = {}) => command.handler({
  rawInput,
  agent: { id: 'agent-1', session: { header: { cwd } }, ...extra.agent },
  config: extra.config ?? {},
  attachments: extra.attachments ?? [],
  signal: new AbortController().signal,
})

test('/novel-persona 列出内置风格与当前状态', () => {
  const cwd = makeWorkspace()
  try {
    const result = run(personaCommand(), {}, '测试书', cwd)
    assert.equal(result.kind, 'success')
    for (const id of BUILTIN_PERSONA_IDS) assert.ok(result.text.includes(id), `清单里应有 ${id}`)
    assert.match(result.text, /当前没有设置风格/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona 位置参数套用风格并写入人格文件与写作规范', () => {
  const cwd = makeWorkspace()
  try {
    const result = run(personaCommand(), {}, '测试书 忘', cwd)
    // "忘" 不是合法 id，应报错而不是静默忽略。
    assert.equal(result.kind, 'error')

    const applied = run(personaCommand(), {}, '测试书 wangyu-classic', cwd)
    assert.equal(applied.kind, 'success')
    const dir = path.join(cwd, 'novel_projects', '测试书')
    assert.ok(fs.existsSync(path.join(dir, PERSONA_FILE)), '应写入人格文件')
    const persona = loadPersona(cwd, '测试书')
    assert.equal(persona.name, '忘语（凡人流）')
    const rules = fs.readFileSync(path.join(dir, '写作规范.md'), 'utf8')
    assert.match(rules, /忘语/u, '写作规范里应带风格')
    // 套用后再查状态，应显示当前风格而不是「没有设置」。
    const status = run(personaCommand(), {}, '测试书', cwd)
    assert.doesNotMatch(status.text, /当前没有设置风格/u)
    assert.match(status.text, /忘语/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona 也接受 --persona 参数形式', () => {
  const cwd = makeWorkspace()
  try {
    const applied = run(personaCommand(), {}, '测试书 --persona ergen-style', cwd)
    assert.equal(applied.kind, 'success')
    assert.equal(loadPersona(cwd, '测试书').name, '耳根（仙侠诗意）')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona 拒绝不存在的项目与未知风格', () => {
  const cwd = makeWorkspace()
  try {
    assert.equal(run(personaCommand(), {}, '查无此书', cwd).kind, 'error')
    const unknown = run(personaCommand(), {}, '测试书 --persona 查无此风', cwd)
    assert.equal(unknown.kind, 'error')
    assert.match(unknown.text, /没有内置风格/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona 不给项目名时列出现有项目而不是猜一个', () => {
  const cwd = makeWorkspace()
  try {
    const result = run(personaCommand(), {}, '', cwd)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /请指定项目名/u)
    assert.match(result.text, /测试书/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 用命令行指定的模型分析，而不是会话模型', async () => {
  const cwd = makeWorkspace()
  const h = host()
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --to 测试书 --provider deepseek --model deepseek-chat --effort high', cwd)
    assert.equal(result.kind, 'success')
    assert.equal(h.calls.length, 1)
    const sent = h.calls[0]
    assert.equal(sent.provider, 'deepseek', '必须用命令行指定的 provider')
    assert.equal(sent.model, 'deepseek-chat', '必须用命令行指定的 model')
    assert.equal(sent.reasoningEffort, 'high')
    assert.match(result.text, /命令行指定/u, '回执应说明模型来源')
    assert.match(result.text, /deepseek\/deepseek-chat/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 回退到插件设置里的模型', async () => {
  const cwd = makeWorkspace()
  const h = host()
  try {
    const config = { persona: { provider: 'cfg-provider', model: 'cfg-model' } }
    const result = await run(personaStudyCommand(h.ctx, config), h.ctx, '参考.txt --to 测试书', cwd)
    assert.equal(result.kind, 'success')
    assert.equal(h.calls[0].provider, 'cfg-provider')
    assert.equal(h.calls[0].model, 'cfg-model')
    assert.match(result.text, /插件设置/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 配置段是 volatile 时也能读出来', async () => {
  const cwd = makeWorkspace()
  const h = host()
  try {
    const volatile = value => ({ get: () => value })
    const config = { persona: { provider: volatile('vw-provider'), model: volatile('vw-model') } }
    const result = await run(personaStudyCommand(h.ctx, config), h.ctx, '参考.txt --to 测试书', cwd)
    assert.equal(result.kind, 'success')
    assert.equal(h.calls[0].provider, 'vw-provider')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 无可用路由时明确报错且不发起请求', async () => {
  const cwd = makeWorkspace()
  const h = bareHost()
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --to 测试书', cwd)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /不知道该用哪个模型/u)
    assert.match(result.text, /--provider/u, '错误里要给出指定模型的写法')
    assert.equal(h.calls.length, 0)
    assert.equal(fs.existsSync(path.join(cwd, 'novel_projects', '测试书', PERSONA_FILE)), false, '失败不应留下人格文件')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 宿主没有该 provider 时给出可操作的错误', async () => {
  const cwd = makeWorkspace()
  const h = host({ providers: ['only-this-one'] })
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --to 测试书 --provider nope --model m', cwd)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /宿主没有可用模型/u)
    assert.match(result.text, /nope\/m/u)
    assert.equal(fs.existsSync(path.join(cwd, 'novel_projects', '测试书', PERSONA_FILE)), false)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 不带 --to 时只报告不落盘', async () => {
  const cwd = makeWorkspace()
  const h = host()
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --provider deepseek --model deepseek-chat', cwd)
    assert.equal(result.kind, 'success')
    assert.match(result.text, /未保存/u)
    assert.equal(fs.existsSync(path.join(cwd, 'novel_projects', '测试书', PERSONA_FILE)), false)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 保存后风格真的落进了写作规范', async () => {
  const cwd = makeWorkspace()
  const h = host()
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --to 测试书 --provider p --model m', cwd)
    assert.equal(result.kind, 'success')
    const persona = loadPersona(cwd, '测试书')
    assert.ok(persona, '拆书结果应落盘')
    assert.equal(persona.name, '参考', '风格名取自文件名')
    assert.ok(persona.signature.length > 0)
    // 关键：写作规范.md 里要真的出现风格，否则续写时上下文一压缩就丢了。
    const rules = fs.readFileSync(path.join(cwd, 'novel_projects', '测试书', '写作规范.md'), 'utf8')
    assert.match(rules, /必须照做的写法/u)
    assert.match(rules, /遇事先算代价/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 拒绝不存在的文件与过短文本', async () => {
  const cwd = makeWorkspace()
  const h = host()
  try {
    const missing = await run(personaStudyCommand(h.ctx, {}), h.ctx, '没有这本书.txt --to 测试书', cwd)
    assert.equal(missing.kind, 'error')
    assert.match(missing.text, /读不到文件/u)

    fs.writeFileSync(path.join(cwd, '短.txt'), '太短。', 'utf8')
    const short = await run(personaStudyCommand(h.ctx, {}), h.ctx, '短.txt --to 测试书 --provider p --model m', cwd)
    assert.equal(short.kind, 'error')
    assert.match(short.text, /太短/u)
    assert.equal(h.calls.length, 0, '文本不合格时不应调用模型')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 拒绝不存在的目标项目', async () => {
  const cwd = makeWorkspace()
  const h = host()
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --to 查无此书 --provider p --model m', cwd)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /查无此书/u)
    assert.equal(h.calls.length, 0)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study 支持附件作为参考文本', async () => {
  const cwd = makeWorkspace()
  const h = host()
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '--to 测试书 --provider p --model m', cwd, {
      attachments: [{ name: '某作者.txt', content: Buffer.from(SAMPLE, 'utf8').toString('base64') }],
    })
    assert.equal(result.kind, 'success')
    assert.ok(h.calls.length === 1)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('续写命令会沿用已保存的人格并写进写作规范', () => {
  // 端到端验证「设一次风格，之后续写自动带上」，这是本功能最主要的用法。
  const cwd = makeWorkspace()
  try {
    const applied = run(personaCommand(), {}, '测试书 tiancan-fast', cwd)
    assert.equal(applied.kind, 'success')
    const ctx = { get: () => undefined }
    const result = continueCommand(ctx).handler({
      rawInput: '测试书 3章',
      agent: { id: 'agent-1', session: { header: { cwd } } },
      signal: new AbortController().signal,
    })
    // 没有 goals/followup 时命令会返回「无法交回模型」的错误，但人格必须已经落盘。
    const rules = fs.readFileSync(path.join(cwd, 'novel_projects', '测试书', '写作规范.md'), 'utf8')
    assert.match(rules, /天蚕土豆/u)
    assert.match(result.text, /天蚕土豆|无法/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('续写时 --persona 可以临时换风格', () => {
  const cwd = makeWorkspace()
  try {
    const ctx = { get: () => undefined }
    continueCommand(ctx).handler({
      rawInput: '测试书 3章 --persona ergen-style',
      agent: { id: 'agent-1', session: { header: { cwd } } },
      signal: new AbortController().signal,
    })
    const rules = fs.readFileSync(path.join(cwd, 'novel_projects', '测试书', '写作规范.md'), 'utf8')
    assert.match(rules, /耳根/u)
    assert.equal(loadPersona(cwd, '测试书').name, '耳根（仙侠诗意）')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})
