/**
 * 单维度拼接：只把参考作品的某个维度接过来，其余保持原样。
 *
 * 这是「这本书只有对话写得好，我只想要它的对话」的核心诉求，所以测试
 * 重点不在字段是否存在，而在：
 * 1. 只覆盖点名的维度，base 的其余维度一个字节都不许变。
 * 2. 没点名的维度不能出现旧值冒充新值的情况。
 * 3. 提示词与报告要让模型和用户都知道「哪个维度是借来的」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  BUILTIN_PERSONA_IDS,
  PERSONA_DIMENSIONS,
  PERSONA_FILE,
  builtinPersona,
  extractPersona,
  loadPersona,
  isAnalyzed,
  mergePersonaDimensions,
  parseFocusDimensions,
  personaPromptSection,
  personaReport,
  savePersona,
  writePersonaToRules,
} from '../src/author-persona.js'
import { personaStudyCommand, personaCommand } from '../src/cmd-persona.js'

const stop = { type: 'finish', reason: { kind: 'stop' } }
const route = Object.freeze({ provider: 'p', model: 'm' })
const SAMPLE = '灰落了一夜。他站着。“你还要站多久？”她问。“等到风停。”他说。'.repeat(80)

/** 一份只含指定维度的人格 JSON，模拟 --只取 时模型该返回的东西。 */
function partialJson(keys) {
  return {
    traits: Object.fromEntries(keys.map(key => [key, { score: 9, label: `借来的${key}` }])),
    signature: ['这是全局签名，不该被整份搬走'],
    dimensionNotes: Object.fromEntries(keys.map(key => [key, {
      signature: [`${key} 的专属写法`],
      avoid: [`${key} 上不这么写`],
    }])),
    avoid: [],
    closestMatch: null,
    confidence: 0.8,
  }
}

function makeWorkspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-merge-'))
  const dir = path.join(cwd, 'novel_projects', '我的新书')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '写作规范.md'), '# 写作规范\n', 'utf8')
  fs.writeFileSync(path.join(cwd, '参考.txt'), SAMPLE, 'utf8')
  return cwd
}

function host(reply) {
  const calls = []
  const llm = {
    listProviders: () => [{ id: 'p' }],
    resolveModelInfo: async (provider, model) => ({ provider, id: model }),
    stream: options => {
      calls.push(options)
      return (async function * () {
        yield { type: 'text-delta', index: 0, text: JSON.stringify(reply) }
        yield stop
      })()
    },
  }
  return { ctx: { get: name => (name === 'llm' ? llm : undefined) }, calls }
}

const run = (command, ctx, rawInput, cwd) => command.handler({
  rawInput,
  agent: { id: 'a', session: { header: { cwd } } },
  attachments: [],
  signal: new AbortController().signal,
})

test('完整重算会清掉旧的拼接出处', async () => {
  // mergedFrom 只在拼接时累加、自己不会消失。整份重算之后若不清理，
  // 提示词会继续说某维度「取自《旧参考》」，而它其实已被重新定过。
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-merge-'))
  try {
    const dir = path.join(cwd, 'novel_projects', '我的书')
    fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
    fs.writeFileSync(path.join(dir, '写作规范.md'), '# 规范\n', 'utf8')
    fs.writeFileSync(path.join(cwd, '参考.txt'), SAMPLE, 'utf8')
    run(personaCommand(), {}, '我的书 wangyu-classic', cwd)

    // 先做一次「只取对话」的拼接，制造 mergedFrom。
    const mergeHost = host(partialJson(['dialogueStyle']))
    await run(personaStudyCommand(mergeHost.ctx, {}), {}, '参考.txt --只取 对话 --to 我的书 --provider p --model m', cwd)
    assert.ok(loadPersona(cwd, '我的书').mergedFrom?.dialogueStyle, '拼接后应记下出处')

    // 再做一次完整重算（不带 --只取）。
    const all = Object.fromEntries(PERSONA_DIMENSIONS.map((d, i) => [d.key, { score: i, label: 'x' }]))
    const fullHost = host({ traits: all, signature: [], avoid: [], confidence: 0.9 })
    await run(personaStudyCommand(fullHost.ctx, {}), {}, '参考.txt --to 我的书 --provider p --model m', cwd)
    const after = loadPersona(cwd, '我的书')
    assert.equal(after.mergedFrom?.dialogueStyle, undefined, '完整重算后不该再有旧拼接出处')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('parseFocusDimensions 认 key、中文标签和口语词', () => {
  assert.deepEqual(parseFocusDimensions('dialogueStyle').keys, ['dialogueStyle'])
  assert.deepEqual(parseFocusDimensions('对话风格').keys, ['dialogueStyle'])
  assert.deepEqual(parseFocusDimensions('对话').keys, ['dialogueStyle'])
  // 逗号、顿号、加号、空格都当分隔符。
  assert.deepEqual(parseFocusDimensions('对话,冲突烈度、人物').keys, ['dialogueStyle', 'conflictIntensity', 'characterDepth'])
  // 不去重会把同一维度拼两次。
  assert.deepEqual(parseFocusDimensions('对话 对话').keys, ['dialogueStyle'])
})

test('parseFocusDimensions 空输入表示全部维度', () => {
  const { keys, unknown } = parseFocusDimensions(undefined)
  assert.equal(keys.length, PERSONA_DIMENSIONS.length)
  assert.deepEqual(unknown, [])
})

test('parseFocusDimensions 把认不出的词单独交出来，而不是悄悄丢掉', () => {
  // 「对白」现在是合法别名了，用一个确实不存在的词来验证未知项。
  const { keys, unknown } = parseFocusDimensions('对话 文笔 描写')
  assert.deepEqual(keys, ['dialogueStyle', 'descriptionDensity'])
  assert.deepEqual(unknown, ['文笔'])
})

test('mergePersonaDimensions 只覆盖点名的维度，其余原样保留', () => {
  const base = builtinPersona('wangyu-classic')
  const patch = { name: '某参考书', traits: { dialogueStyle: { score: 10, label: '极简对话' } } }
  const merged = mergePersonaDimensions(base, patch, ['dialogueStyle'])
  // 点名的换掉了。
  assert.equal(merged.traits.dialogueStyle.score, 10)
  assert.equal(merged.traits.dialogueStyle.label, '极简对话')
  // 其余每一个维度都必须与 base 完全一致 —— 这是本功能的核心承诺。
  for (const dimension of PERSONA_DIMENSIONS) {
    if (dimension.key === 'dialogueStyle') continue
    assert.deepEqual(merged.traits[dimension.key], base.traits[dimension.key], `${dimension.key} 不该被改动`)
  }
  assert.equal(merged.name, base.name, '名字保持自己的')
})

test('mergePersonaDimensions 不修改传进来的 base 对象', () => {
  const base = builtinPersona('ergen-style')
  const before = JSON.parse(JSON.stringify(base))
  mergePersonaDimensions(base, { name: 'x', traits: { dialogueStyle: { score: 1, label: 'y' } } }, ['dialogueStyle'])
  assert.deepEqual(base, before, 'base 被就地改掉会导致保存后原风格丢失')
})

test('mergePersonaDimensions 标记拼接出处，提示词能区分借来的维度', () => {
  const base = builtinPersona('tiancan-fast')
  const merged = mergePersonaDimensions(base, { name: '参考作品', traits: { dialogueStyle: { score: 7, label: '短促' } } }, ['dialogueStyle'])
  assert.equal(merged.mergedFrom.dialogueStyle, '参考作品')
  assert.ok(merged.analyzed.includes('dialogueStyle'))
  const section = personaPromptSection(merged)
  assert.match(section, /此维度取自《参考作品》/u)
  const report = personaReport(merged)
  assert.match(report, /←《参考作品》/u)
  // 没被拼接的维度不能凭空多出来源标记。
  const untouched = PERSONA_DIMENSIONS.find(item => item.key === 'narrativePacing')
  assert.doesNotMatch(report.split('\n').find(line => line.includes(untouched.label)), /←/u)
})

test('mergePersonaDimensions 只搬与该维度相关的签名', () => {
  const base = builtinPersona('wangyu-classic')
  const patch = {
    name: '参考',
    traits: { dialogueStyle: { score: 8, label: 'x' } },
    signature: ['全局签名不该被搬过来'],
    dimensionNotes: { dialogueStyle: { signature: ['对话短促有力'], avoid: ['不写客套寒暄'] } },
  }
  const merged = mergePersonaDimensions(base, patch, ['dialogueStyle'])
  assert.ok(merged.signature.includes('对话短促有力'), '应带进该维度的签名')
  assert.ok(!merged.signature.includes('全局签名不该被搬过来'), '整份签名不该搬')
})

test('维度没真的搬动时不写出处，避免提示词谎报来源', () => {
  // 模型可能「选了对话维度但 traits 里没有它」。此时记下出处会让提示词
  // 说「此维度取自《参考》」，而分数其实还是 base 原来的 —— 用户以为学到了。
  const base = builtinPersona('wangyu-classic')
  const merged = mergePersonaDimensions(base, { name: '某参考', traits: {} }, ['dialogueStyle'])
  assert.equal(merged.mergedFrom?.dialogueStyle, undefined, '没搬动就不该写出处')
  assert.equal(merged.traits.dialogueStyle.score, base.traits.dialogueStyle.score)
})

test('签名取满时不动用户原有签名，并把溢出的条数记下来', () => {
  // 原实现把新签名插到最前面再截断，base 已满 8 条时每拼一次就从尾部
  // 挤掉用户原有几条，且一声不响 —— 用户的风格会这么一点点变少。
  const base = {
    ...builtinPersona('wangyu-classic'),
    signature: Array.from({ length: 8 }, (_, i) => `原有签名${i}`),
  }
  const patch = {
    name: '参考',
    traits: { dialogueStyle: { score: 9, label: 'x' } },
    dimensionNotes: { dialogueStyle: { signature: ['新签名A', '新签名B'], avoid: [] } },
  }
  const merged = mergePersonaDimensions(base, patch, ['dialogueStyle'])
  // 原有 8 条一条都不能少。
  for (const line of base.signature) {
    assert.ok(merged.signature.includes(line), `原有签名「${line}」不该被挤掉`)
  }
  assert.equal(merged.signature.length, 8)
  assert.equal(merged.signatureOverflow, 2, '被容量挡下的条数要能说出来')
})

test('mergePersonaDimensions 拒绝空维度列表', () => {
  const base = builtinPersona('wangyu-classic')
  assert.throws(() => mergePersonaDimensions(base, { traits: {} }, []), /没有指定要拼接的维度/u)
  assert.throws(() => mergePersonaDimensions(base, { traits: {} }, ['乱写的']), /没有指定要拼接的维度/u)
})

test('isAnalyzed 在没标记时视为全部维度', () => {
  const full = builtinPersona('wangyu-classic')
  for (const dimension of PERSONA_DIMENSIONS) assert.equal(isAnalyzed(full, dimension.key), true)
  const partial = { traits: {}, analyzed: ['dialogueStyle'] }
  assert.equal(isAnalyzed(partial, 'dialogueStyle'), true)
  assert.equal(isAnalyzed(partial, 'narrativePacing'), false)
})

test('extractPersona 只评指定维度，并在提示词里排除其余维度', async () => {
  const h = host(partialJson(['dialogueStyle']))
  const persona = await extractPersona(h.ctx, { text: SAMPLE, route, only: ['对话'] })
  const sent = h.calls[0].messages[0].content[0].text
  assert.match(sent, /本次只分析这 1 个维度/u)
  assert.match(sent, /dialogueStyle/u)
  // 其余维度的评分刻度不能出现在提示词里，否则模型会顺手一起评了。
  assert.doesNotMatch(sent, /narrativePacing（叙事节奏）/u)
  assert.deepEqual(persona.analyzed, ['dialogueStyle'])
  assert.equal(persona.traits.dialogueStyle.score, 9)
  // 模型额外返回的维度不该被收下。
  assert.equal(persona.traits.narrativePacing, undefined)
})

test('extractPersona 全量分析时 analyzed 覆盖全部维度', async () => {
  const all = Object.fromEntries(PERSONA_DIMENSIONS.map((d, i) => [d.key, { score: i, label: 'x' }]))
  const h = host({ traits: all, signature: ['s'], avoid: [] })
  const persona = await extractPersona(h.ctx, { text: SAMPLE, route })
  assert.equal(persona.analyzed.length, PERSONA_DIMENSIONS.length)
})

test('extractPersona 对认不出的维度直接报错，不退化成全量分析', async () => {
  const h = host(partialJson(['dialogueStyle']))
  await assert.rejects(
    extractPersona(h.ctx, { text: SAMPLE, route, only: ['文笔'] }),
    /不认识的维度/u,
  )
  assert.equal(h.calls.length, 0, '维度不合法时不该发起请求')
})

test('/novel-persona-study --只取 拼接后其余维度不变', async () => {
  const cwd = makeWorkspace()
  try {
    // 先建一个带默认风格的基线。
    const applied = run(personaCommand(), {}, '我的新书 tiancan-fast', cwd)
    assert.equal(applied.kind, 'success')
    const before = loadPersona(cwd, '我的新书')

    const h = host(partialJson(['dialogueStyle']))
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '参考.txt --只取 对话 --to 我的新书 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success')
    assert.match(result.text, /拼接维度/u)
    assert.match(result.text, /对话风格/u)

    const after = loadPersona(cwd, '我的新书')
    assert.equal(after.traits.dialogueStyle.score, 9, '对话维度应来自参考作品')
    // 其余五个维度必须与拼接前一模一样。
    for (const dimension of PERSONA_DIMENSIONS) {
      if (dimension.key === 'dialogueStyle') continue
      assert.deepEqual(after.traits[dimension.key], before.traits[dimension.key], `${dimension.key} 被意外改动`)
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study --只取 把拼接结果写进写作规范', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '我的新书 wangyu-classic', cwd)
    const h = host(partialJson(['dialogueStyle']))
    await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --只取 对话 --to 我的新书 --provider p --model m', cwd)
    const rules = fs.readFileSync(path.join(cwd, 'novel_projects', '我的新书', '写作规范.md'), 'utf8')
    assert.match(rules, /此维度取自《参考.txt》|此维度取自《参考》/u, '写作规范里要标出拼接来源')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study --只取 在没有基础风格时拒绝并给出解法', async () => {
  const cwd = makeWorkspace()
  const h = host(partialJson(['dialogueStyle']))
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --只取 对话 --to 我的新书 --provider p --model m', cwd)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /还没有风格可以拼接/u)
    assert.match(result.text, /wangyu-classic/u, '要给出可直接照抄的解法')
    assert.equal(h.calls.length, 0, '缺基础风格时不该白跑一次模型')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study --只取 不带 --to 时明确报错', async () => {
  const cwd = makeWorkspace()
  const h = host(partialJson(['dialogueStyle']))
  try {
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --只取 对话 --provider p --model m', cwd)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /还不知道要拼给哪个项目/u)
    assert.match(result.text, /--to/u, '错误里要给出正确写法')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('/novel-persona-study --只取 对未知维度给出可用清单', async () => {
  const cwd = makeWorkspace()
  const h = host(partialJson(['dialogueStyle']))
  try {
    run(personaCommand(), {}, '我的新书 wangyu-classic', cwd)
    const result = await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --只取 文笔 --to 我的新书 --provider p --model m', cwd)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /不认识的维度/u)
    assert.match(result.text, /dialogueStyle/u)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('--只取 的参数解析不会把后面的 --to 吞进维度里', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '我的新书 wangyu-classic', cwd)
    const h = host(partialJson(['dialogueStyle']))
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '参考.txt --只取 对话 --to 我的新书 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `解析失败：${result.text}`)
    // 项目名不该变成 "对话--to" 之类的拼接物。
    assert.ok(fs.existsSync(path.join(cwd, 'novel_projects', '我的新书', PERSONA_FILE)))
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('拼接产物落盘后仍保留出处，可供日后追溯', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '我的新书 wangyu-classic', cwd)
    const h = host(partialJson(['dialogueStyle']))
    await run(personaStudyCommand(h.ctx, {}), h.ctx, '参考.txt --只取 对话 --to 我的新书 --provider p --model m', cwd)
    const saved = JSON.parse(fs.readFileSync(path.join(cwd, 'novel_projects', '我的新书', PERSONA_FILE), 'utf8'))
    assert.equal(saved.mergedFrom.dialogueStyle, '参考')
    // analyzed 是「哪些维度已经算过」，拼接后六个维度都在：漏掉某个维度会
    // 让下次读取时把它当不存在而丢弃。
    assert.equal(saved.analyzed.length, PERSONA_DIMENSIONS.length, `analyzed 丢了维度：${saved.analyzed.join(',')}`)
    assert.ok(saved.analyzed.includes('dialogueStyle'))
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})
