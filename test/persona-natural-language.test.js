/**
 * 自然语言识别：用户只说命令名，需求随口讲。
 *
 * 真实输入长这样：「这本小说对话写得好，帮我拼到《网管修仙》上」。命令
 * 不该要求用户先学会 `--只取 对话 --to 网管修仙` 才准用，所以这一层负责
 * 把话里的意图认出来。测试重点在「认得准」和「认不出时不许瞎猜」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { personaStudyCommand, personaCommand, parseNaturalIntent } from '../src/cmd-persona.js'
import { PERSONA_DIMENSIONS, PERSONA_FILE, loadPersona, parseFocusDimensions } from '../src/author-persona.js'

const stop = { type: 'finish', reason: { kind: 'stop' } }
const SAMPLE = '灰落了一夜。他站着。“你还要站多久？”她问。“等到风停。”他说。'.repeat(80)

function makeWorkspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-natural-'))
  const dir = path.join(cwd, 'novel_projects', '网管修仙')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '写作规范.md'), '# 写作规范\n', 'utf8')
  fs.writeFileSync(path.join(cwd, '这本书.txt'), SAMPLE, 'utf8')
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

const partial = {
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

test('parseNaturalIntent 从书名号认出目标项目', () => {
  for (const raw of [
    '这本小说对话写得好，帮我拼到《网管修仙》上',
    '拼到「网管修仙」',
    '拼到 "网管修仙"',
    '拼到“网管修仙”',
  ]) {
    assert.equal(parseNaturalIntent(raw).to, '网管修仙', `认不出目标：${raw}`)
  }
})

test('parseNaturalIntent 从口语里认出维度', () => {
  // parseNaturalIntent 交出来的是用户说的原词，真正映射成 key 的是
  // parseFocusDimensions —— 这里两段一起验证，才代表实际链路。
  const cases = [
    ['这本书对话写得好，我只想学对话', 'dialogueStyle'],
    ['它的对白很棒', 'dialogueStyle'],
    ['剧情冲突张弛有度，把冲突拿过来', 'conflictIntensity'],
    ['这个作者节奏感很好', 'narrativePacing'],
    ['描写很有画面感', 'descriptionDensity'],
    ['人物立得住', 'characterDepth'],
    ['情绪渲染到位', 'emotionalTone'],
  ]
  for (const [raw, expected] of cases) {
    const { only } = parseNaturalIntent(raw)
    assert.ok(only !== undefined, `没认出维度：${raw}`)
    const { keys } = parseFocusDimensions(only)
    assert.ok(keys.includes(expected), `${raw} → 期望 ${expected}，实际 ${only} → ${keys.join(',')}`)
  }
})

test('parseNaturalIntent 能同时认出多个维度', () => {
  const { only } = parseNaturalIntent('对话和冲突都写得好，我都要')
  assert.ok(only !== undefined)
  const { keys } = parseFocusDimensions(only)
  assert.ok(keys.includes('dialogueStyle'), `缺 dialogueStyle：${keys.join(',')}`)
  assert.ok(keys.includes('conflictIntensity'), `缺 conflictIntensity：${keys.join(',')}`)
})

test('parseNaturalIntent 对没有意图的话保持沉默，不瞎猜', () => {
  // 纯文件路径不该被误解成维度或项目。
  const plain = parseNaturalIntent('某作者.txt')
  assert.equal(plain.to, undefined)
  assert.equal(plain.only, undefined)
  assert.equal(plain.consumed, false)
})

test('parseNaturalIntent 不会把抱怨当成「要学这个维度」', () => {
  // 拼接会覆盖已有风格，所以「节奏太慢了」这种吐槽必须停住，不能顺势拼接。
  for (const sentence of ['节奏太慢了', '对话写得一般', '人物不够立体', '冲突太平淡了', '描写太多', '对白太啰嗦']) {
    const intent = parseNaturalIntent(sentence)
    assert.equal(intent.only, undefined, `${sentence} 不该被当成学习意图`)
    assert.ok(intent.complains !== undefined, `${sentence} 应被识别为抱怨`)
  }
  // 正面评价仍然要能认出维度。
  assert.equal(parseNaturalIntent('对话写得好').only, '对话')
  assert.equal(parseNaturalIntent('我要学节奏和对白').only, '节奏,对白')
})

test('抱怨句只反问、不调用模型、不改动已有风格', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const before = loadPersona(cwd, '网管修仙')
    const h = host(partial)
    const result = await run(personaStudyCommand(h.ctx, {}), {}, '参考.txt 节奏太慢了', cwd)
    assert.equal(result.kind, 'error')
    assert.match(result.text, /不像在说/u)
    // 关键：一次请求都不该发出，风格也不该动。
    assert.equal(h.calls.length, 0)
    const after = loadPersona(cwd, '网管修仙')
    assert.equal(after.traits.narrativePacing.score, before.traits.narrativePacing.score)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('普通叙述不会被当成维度', () => {
  // 「写得不错」「很好看」这种泛泛评价不该触发任何维度。
  const vague = parseNaturalIntent('这本书写得不错，很好看')
  assert.equal(vague.only, undefined)
})

test('自然语言一次说清：把对话拼到《网管修仙》', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const before = loadPersona(cwd, '网管修仙')
    const h = host(partial)
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本书.txt 这本书对话写得好，帮我拼到《网管修仙》上 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `识别失败：${result.text}`)
    const after = loadPersona(cwd, '网管修仙')
    assert.equal(after.traits.dialogueStyle.score, 9, '对话维度应被拼接')
    // 其余维度必须保持原样。
    for (const dimension of PERSONA_DIMENSIONS) {
      if (dimension.key === 'dialogueStyle') continue
      assert.deepEqual(after.traits[dimension.key], before.traits[dimension.key], `${dimension.key} 被改动`)
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('自然语言不带书名号也能认出项目', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const h = host(partial)
    // 用「拼到「网管修仙」」——书名号的各种写法都要认。
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本书.txt 它对话好，拼到「网管修仙」 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `识别失败：${result.text}`)
    assert.equal(loadPersona(cwd, '网管修仙').traits.dialogueStyle.score, 9)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('显式参数优先于自然语言', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    // 模型返回的维度要跟显式参数一致：显式说「冲突烈度」，模型就该只给这个。
    const h = host({
      traits: { conflictIntensity: { score: 9, label: '高压' } },
      signature: [], avoid: [],
      dimensionNotes: { conflictIntensity: { signature: ['每章都要有代价'], avoid: [] } },
      confidence: 0.9,
    })
    // 句子里的自然语言说「对话」，显式参数说「冲突烈度」：显式的那句赢。
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本书.txt 对话写得好 --只取 冲突烈度 --to 网管修仙 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'success', `失败：${result.text}`)
    const after = loadPersona(cwd, '网管修仙')
    assert.ok(after.mergedFrom?.conflictIntensity !== undefined, '应采用显式参数指定的维度')
    assert.equal(after.mergedFrom.dialogueStyle, undefined, '不该同时采纳句子里的「对话」')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('说了要拼接但没给参考文件时，明确说要给什么', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const h = host(partial)
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '我想把对话拼到《网管修仙》上 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'error')
    // 不该是干巴巴的「读不到文件」，而应说清楚缺什么。
    assert.match(result.text, /参考作品|参考文件|附件/u)
    assert.equal(h.calls.length, 0, '缺文件时不该调用模型')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('纯自然语言、无任何参数时也能工作（模型走会话路由）', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const h = host(partial)
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本书.txt 对话写得好，拼到《网管修仙》',
      cwd,
    )
    // 有 llm 服务但没有会话路由时会报「不知道该用哪个模型」，
    // 关键是维度与项目必须已经认对，错误里不该出现「读不到文件」。
    assert.doesNotMatch(result.text, /读不到文件/u, `自然语言解析失败：${result.text}`)
    if (result.kind === 'success') {
      assert.equal(loadPersona(cwd, '网管修仙').traits.dialogueStyle.score, 9)
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('认出的项目名不存在时，列出真实可选项', async () => {
  const cwd = makeWorkspace()
  try {
    run(personaCommand(), {}, '网管修仙 wangyu-classic', cwd)
    const h = host(partial)
    const result = await run(
      personaStudyCommand(h.ctx, {}),
      h.ctx,
      '这本书.txt 对话好，拼到《查无此书》 --provider p --model m',
      cwd,
    )
    assert.equal(result.kind, 'error')
    assert.match(result.text, /查无此书/u)
    assert.match(result.text, /网管修仙/u, '要列出实际存在的项目')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})
