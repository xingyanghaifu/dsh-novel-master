/**
 * 作者人格系统实测：真实建项目、真读真写，覆盖提取、保存、套用与路由解析。
 *
 * 原则与其它测试一致：不 mock 掉被测逻辑。模型调用走一个可观察的假 llm
 * 服务（真实 callText 协议），文件操作全部落在临时目录里。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  BUILTIN_PERSONA_IDS,
  BUILTIN_PERSONAS,
  MAX_PERSONA_TEXT,
  PERSONA_DIMENSIONS,
  PERSONA_FILE,
  builtinPersona,
  extractPersona,
  loadPersona,
  normalizePersona,
  personaEvidence,
  personaPromptSection,
  personaReport,
  removePersonaFromRules,
  resolvePersonaRoute,
  samplePersonaText,
  savePersona,
  takePersonaOption,
  writePersonaToRules,
} from '../src/author-persona.js'

const route = Object.freeze({ provider: 'analysis-provider', model: 'style-reader' })
const stop = { type: 'finish', reason: { kind: 'stop' } }

/** 一段够长、有对话、有长短句的样例正文。 */
const SAMPLE = [
  '# 第1章 灰烬',
  '',
  '灰落了一夜。他站在门口，没有动。',
  '',
  '“你还要站多久？”她在里面问。',
  '',
  '“等到风停。”他说。',
  '',
  '风没有停。檐下的铁铃响了三次，第三次的时候他忽然笑了，那个笑很短，像被谁掐断。他想起很多年前也有这样一个夜晚，那时候他还不叫现在这个名字，也没有人管他叫先生。',
  '',
  '“进来吧。”她说，“外面凉。”',
  '',
  '他没有答话，把烟盒捏扁了，扔进灰里。',
].join('\n').repeat(20)

/** 构造工作区：一个真实项目目录。 */
function makeWorkspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-persona-'))
  const dir = path.join(cwd, 'novel_projects', '测试书')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '写作规范.md'), '# 写作规范\n\n通用口径。\n', 'utf8')
  fs.writeFileSync(path.join(dir, '正文', '第1章_灰烬.md'), '正文。\n', 'utf8')
  return cwd
}

/** 构造一个会说指定 JSON 的宿主。 */
function host(reply, { efforts = [] } = {}) {
  const calls = []
  const llm = {
    listProviders: () => [{ id: route.provider }],
    resolveModelInfo: async (provider, model) => ({ provider, id: model, reasoning: { efforts } }),
    stream: options => {
      calls.push(options)
      return (async function * () {
        yield { type: 'text-delta', index: 0, text: typeof reply === 'string' ? reply : JSON.stringify(reply) }
        yield stop
      })()
    },
  }
  return { ctx: { get: name => (name === 'llm' ? llm : undefined) }, calls }
}

/** 一份合法的人格 JSON，供假模型返回。 */
function personaJson(overrides = {}) {
  return {
    traits: Object.fromEntries(PERSONA_DIMENSIONS.map((dimension, index) => [
      dimension.key,
      { score: index + 3, label: `${dimension.label}说明` },
    ])),
    signature: ['遇事先算代价', '短句收尾'],
    avoid: ['不写网络梗'],
    sample: '灰落了一夜，他没有动。',
    closestMatch: 'wangyu-classic',
    confidence: 0.72,
    ...overrides,
  }
}

test('内置风格齐全且每份都能通过规范化', () => {
  assert.ok(BUILTIN_PERSONA_IDS.length >= 5, `期望至少 5 种，实际 ${BUILTIN_PERSONA_IDS.length}`)
  for (const id of BUILTIN_PERSONA_IDS) {
    const persona = builtinPersona(id)
    assert.ok(persona, `${id} 应能取到`)
    assert.equal(Object.keys(persona.traits).length, PERSONA_DIMENSIONS.length, `${id} 维度数不对`)
    for (const dimension of PERSONA_DIMENSIONS) {
      const score = persona.traits[dimension.key].score
      assert.ok(Number.isInteger(score) && score >= 0 && score <= 10, `${id}.${dimension.key} 分数越界：${score}`)
    }
    assert.ok(persona.signature.length > 0, `${id} 应有可执行的风格签名`)
  }
})

test('builtinPersona 返回深拷贝，调用方改动不会污染模板', () => {
  const first = builtinPersona('wangyu-classic')
  first.signature.push('被篡改的一条')
  first.traits.narrativePacing.score = 0
  const second = builtinPersona('wangyu-classic')
  assert.ok(!second.signature.includes('被篡改的一条'))
  assert.notEqual(second.traits.narrativePacing.score, 0)
})

test('normalizePersona 拒绝缺维度和非对象输入', () => {
  assert.throws(() => normalizePersona(null), /必须是对象/u)
  assert.throws(() => normalizePersona({ traits: {} }), /缺少分数/u)
  const partial = personaJson()
  delete partial.traits.conflictIntensity
  assert.throws(() => normalizePersona(partial), /缺少分数/u)
})

test('normalizePersona 把越界分数夹到 0-10 并接受纯数字写法', () => {
  const raw = { traits: {} }
  for (const dimension of PERSONA_DIMENSIONS) raw.traits[dimension.key] = 42
  const persona = normalizePersona(raw)
  for (const dimension of PERSONA_DIMENSIONS) assert.equal(persona.traits[dimension.key].score, 10)
  const negative = { traits: {} }
  for (const dimension of PERSONA_DIMENSIONS) negative.traits[dimension.key] = { score: -5 }
  assert.equal(normalizePersona(negative).traits.narrativePacing.score, 0)
})

test('normalizePersona 过滤签名里的非法条目但保留合法项', () => {
  const persona = normalizePersona(personaJson({ signature: ['好的', '', 42, null, '另一条'] }))
  assert.deepEqual(persona.signature, ['好的', '另一条'])
})

test('normalizePersona 对结构错误的 avoid 整份拒绝', () => {
  // 数组字段收到非数组是数据损坏，静默丢弃会让「作者不这么写」这条约束
  // 悄悄消失，比报错更难发现。
  assert.throws(() => normalizePersona(personaJson({ avoid: 'not-an-array' })), /必须是数组/u)
})

test('personaEvidence 从真实文本算出可核对的数据', () => {
  const evidence = personaEvidence(SAMPLE)
  assert.ok(evidence.chars > 1000, '应统计到正文')
  assert.ok(evidence.sentences > 10)
  assert.ok(evidence.dialogueRatio > 0, '文本里有对话，比例应大于 0')
  assert.ok(evidence.avgSentence > 0)
  // 空文本不能除出 NaN。
  const empty = personaEvidence('')
  assert.equal(empty.sentences, 0)
  assert.equal(empty.dialogueRatio, 0)
  assert.ok(Number.isFinite(empty.avgSentence))
})

test('personaPromptSection 写进可执行约束而不是空话', () => {
  const persona = builtinPersona('ergen-style')
  const section = personaPromptSection(persona)
  assert.match(section, /作者风格/u)
  assert.match(section, /耳根/u)
  for (const dimension of PERSONA_DIMENSIONS) assert.ok(section.includes(dimension.label), `缺维度 ${dimension.label}`)
  for (const item of persona.signature) assert.ok(section.includes(item), `缺签名 ${item}`)
  // 分数条长度固定，报告才对得齐。
  assert.match(section, /[█░]{10}/u)
})

test('personaReport 在缺 closestMatch 时不留下 undefined', () => {
  const persona = normalizePersona(personaJson({ closestMatch: undefined }))
  const report = personaReport(persona)
  assert.doesNotMatch(report, /undefined/u)
  assert.match(report, /风格签名/u)
})

test('takePersonaOption 剥离参数且不污染剩余文本', () => {
  assert.deepEqual(takePersonaOption('网管修仙 --persona wangyu-classic 80章'), {
    rest: '网管修仙 80章',
    personaId: 'wangyu-classic',
  })
  assert.deepEqual(takePersonaOption('--风格 tiancan-fast 网管修仙'), {
    rest: '网管修仙',
    personaId: 'tiancan-fast',
  })
  // 没有参数时原样返回，尾随空格也要清掉。
  assert.deepEqual(takePersonaOption('  网管修仙 80章  '), { rest: '网管修仙 80章' })
})

test('takePersonaOption 对未知风格给出可用清单而不吞掉输入', () => {
  const result = takePersonaOption('网管修仙 --persona 不存在的风格')
  assert.equal(result.personaId, undefined)
  assert.match(result.error, /没有内置风格/u)
  assert.match(result.error, /wangyu-classic/u)
})

test('savePersona 与 loadPersona 往返一致，且落盘为可读 JSON', () => {
  const cwd = makeWorkspace()
  try {
    const persona = builtinPersona('maoniannian-delicate')
    const file = savePersona(cwd, '测试书', persona)
    assert.equal(path.basename(file), PERSONA_FILE)
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.equal(raw.name, persona.name)
    assert.ok(raw.savedAt, '应带写入时间')
    const loaded = loadPersona(cwd, '测试书')
    assert.equal(loaded.name, persona.name)
    assert.deepEqual(loaded.traits, persona.traits)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('loadPersona 对缺失和损坏的文件都返回 undefined 而不抛错', () => {
  const cwd = makeWorkspace()
  try {
    assert.equal(loadPersona(cwd, '测试书'), undefined, '没设过人格应为 undefined')
    fs.writeFileSync(path.join(cwd, 'novel_projects', '测试书', PERSONA_FILE), '{ 坏 JSON', 'utf8')
    assert.equal(loadPersona(cwd, '测试书'), undefined, '损坏文件不应让续写崩掉')
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('writePersonaToRules 写入标记块，换风格时替换而不是堆叠', () => {
  const cwd = makeWorkspace()
  try {
    const rulesFile = path.join(cwd, 'novel_projects', '测试书', '写作规范.md')
    writePersonaToRules(cwd, '测试书', builtinPersona('wangyu-classic'))
    let text = fs.readFileSync(rulesFile, 'utf8')
    assert.match(text, /作者风格/u)
    assert.match(text, /忘语/u)
    assert.match(text, /通用口径/u, '原有内容不能丢')

    writePersonaToRules(cwd, '测试书', builtinPersona('tiancan-fast'))
    text = fs.readFileSync(rulesFile, 'utf8')
    assert.match(text, /天蚕土豆/u)
    assert.doesNotMatch(text, /忘语/u, '换风格后旧风格应被替换')
    // 标记块只能有一份，否则每轮写入都会让文件变长。
    assert.equal(text.match(/author-persona:start/gu).length, 1)
    assert.equal(text.match(/author-persona:end/gu).length, 1)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('removePersonaFromRules 清掉区块但保留原有口径', () => {
  const cwd = makeWorkspace()
  try {
    const rulesFile = path.join(cwd, 'novel_projects', '测试书', '写作规范.md')
    writePersonaToRules(cwd, '测试书', builtinPersona('chendong-epic'))
    assert.equal(removePersonaFromRules(cwd, '测试书'), true)
    const text = fs.readFileSync(rulesFile, 'utf8')
    assert.doesNotMatch(text, /作者风格/u)
    assert.match(text, /通用口径/u)
    // 再删一次没有区块可删，应如实返回 false。
    assert.equal(removePersonaFromRules(cwd, '测试书'), false)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('extractPersona 拒绝过短文本，不浪费一次模型请求', async () => {
  const h = host(personaJson())
  await assert.rejects(
    extractPersona(h.ctx, { text: '太短了。', route }),
    /太短/u,
  )
  assert.equal(h.calls.length, 0, '文本不合规时不应发起模型调用')
})

test('extractPersona 把客观统计和维度刻度写进请求', async () => {
  const h = host(personaJson())
  const persona = await extractPersona(h.ctx, { text: SAMPLE, route, name: '参考作品' })
  assert.equal(h.calls.length, 1)
  const sent = h.calls[0]
  assert.equal(sent.provider, route.provider)
  assert.equal(sent.model, route.model)
  assert.deepEqual(sent.tools, [])
  // 提示词里必须有统计事实，模型才不至于凭空给分。
  assert.match(sent.messages[0].content[0].text, /平均句长/u)
  assert.match(sent.messages[0].content[0].text, /narrativePacing/u)
  assert.match(sent.messages[0].content[0].text, /只输出 JSON/u)
  assert.equal(persona.name, '参考作品')
  assert.equal(persona.model, `${route.provider}/${route.model}`)
  assert.ok(persona.evidence.chars > 0)
})

test('extractPersona 兼容模型包了代码块或前后带解释的 JSON', async () => {
  const wrapped = `好的，分析如下：\n\`\`\`json\n${JSON.stringify(personaJson())}\n\`\`\`\n希望有帮助。`
  const h = host(wrapped)
  const persona = await extractPersona(h.ctx, { text: SAMPLE, route })
  assert.equal(persona.traits.narrativePacing.score, 3)
})

test('extractPersona 对无法解析的回复明确报错', async () => {
  const h = host('抱歉，我无法完成这个分析。')
  await assert.rejects(extractPersona(h.ctx, { text: SAMPLE, route }), /没有返回 JSON/u)
})

test('extractPersona 丢弃模型编造的内置风格 id', async () => {
  const h = host(personaJson({ closestMatch: '不存在的作者' }))
  const persona = await extractPersona(h.ctx, { text: SAMPLE, route })
  assert.equal(persona.closestMatch, undefined, '编造的 id 应被丢弃')
})

test('extractPersona 长文本截断并在证据里如实标注', async () => {
  const h = host(personaJson())
  const huge = SAMPLE.repeat(40)
  const persona = await extractPersona(h.ctx, { text: huge, route })
  assert.equal(persona.truncated, true)
  assert.match(h.calls[0].messages[0].content[0].text, /均匀取材/u)
})

test('resolvePersonaRoute 按 命令行 > 设置 > 会话 回退', async () => {
  // 1. 命令行最优先，即便设置和会话都有值。
  const h = host(personaJson())
  const command = await resolvePersonaRoute(h.ctx, { agent: { id: 'a' } }, { provider: 'cfg', model: 'cfg-model' }, { provider: 'cli', model: 'cli-model' })
  assert.equal(command.source, 'command')
  assert.equal(command.route.provider, 'cli')

  // 2. 命令行缺失时用设置。
  const settings = await resolvePersonaRoute(h.ctx, { agent: { id: 'a' } }, { provider: 'cfg', model: 'cfg-model' })
  assert.equal(settings.source, 'settings')
  assert.equal(settings.route.model, 'cfg-model')

  // 3. 都没有时必须明确说没有，绝不猜一个部署默认模型。
  const none = await resolvePersonaRoute({ get: () => undefined }, { agent: { id: 'a' } }, {})
  assert.equal(none.route, undefined)
  assert.equal(none.source, 'none')
})

test('resolvePersonaRoute 读取 volatile 包装的配置字段', async () => {
  const volatile = value => ({ get: () => value })
  const resolved = await resolvePersonaRoute(
    { get: () => undefined },
    { agent: { id: 'a' } },
    { provider: volatile('vw-provider'), model: volatile('vw-model'), reasoningEffort: volatile('high') },
  )
  assert.equal(resolved.route.provider, 'vw-provider')
  assert.equal(resolved.route.reasoningEffort, 'high')
})

test('人格套用后，提示词区块真的出现在 写作规范.md 里', () => {
  // 端到端地验证「保存 → 写规范 → 提示词可读」这条链，而不是各自单测。
  const cwd = makeWorkspace()
  try {
    const persona = builtinPersona('tiancan-fast')
    savePersona(cwd, '测试书', persona)
    const loaded = loadPersona(cwd, '测试书')
    writePersonaToRules(cwd, '测试书', loaded)
    const rules = fs.readFileSync(path.join(cwd, 'novel_projects', '测试书', '写作规范.md'), 'utf8')
    assert.match(rules, /天蚕土豆/u)
    assert.match(rules, /必须照做的写法/u)
    for (const item of persona.signature) assert.ok(rules.includes(item), `规则里应出现：${item}`)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

/**
 * 长篇采样。真实小说动辄几十万字，只取开头会按序章的写法给全书打分：
 * 慢热开头（长句、无对话）会把一个快节奏对话体的作者判成“描写密、节奏慢”。
 */
test('sampledPersonaText 对短文本原样返回，不标注截断', () => {
  const { sample, truncated, covered } = samplePersonaText('短文本。'.repeat(50))
  assert.equal(truncated, false)
  assert.equal(covered, 1)
  assert.equal(sample, '短文本。'.repeat(50))
})

test('sampledPersonaText 覆盖全书，而不是只截开头', () => {
  // 采样必然有间隙，所以不断言某个精确偏移被命中，而是验证三件关键的事：
  // 开头在、结尾在、采样点铺满全书。
  const head = `【开头标记】${'甲'.repeat(40000)}`
  const tail = `${'丙'.repeat(40000)}【结尾标记】`
  const full = head + tail
  const { sample, truncated, covered } = samplePersonaText(full)
  assert.equal(truncated, true)
  assert.ok(sample.length <= MAX_PERSONA_TEXT + 2000, `采样超预算：${sample.length}`)
  assert.match(sample, /【开头标记】/u, '必须看到开篇写法')
  assert.match(sample, /【结尾标记】/u, '必须看到大结局写法 —— 只取开头就漏了')
  assert.ok(covered > 0 && covered <= 1)

  // 采样点要铺到全书后段，不能都挤在前半本。
  const positions = [...sample.matchAll(/原文位置约 (\d+)%/gu)].map(match => Number(match[1]))
  assert.ok(positions.length >= 10, `采样点太少：${positions.length}`)
  assert.equal(positions[0], 0, '第一个点应在开篇')
  assert.ok(positions.at(-1) >= 90, `最后一个点应接近结尾，实际 ${positions.at(-1)}%`)
  // 每个 20% 区间都要有采样点，否则中段整段被跳过。
  for (const bucket of [20, 40, 60, 80]) {
    assert.ok(
      positions.some(value => value >= bucket - 10 && value < bucket + 10),
      `${bucket}% 附近没有采样点：${positions.join(',')}`,
    )
  }
})

test('sampledPersonaText 会打乱慢热开头造成的误判', () => {
  // 开头全是有对话的慢热铺垫，后面是短句对话体。
  const slowOpening = `${'他想着许多年后才会明白的事情，天色一点点暗下去。'.repeat(800)}`
  const dialogueBody = `${'“走！”他喊。刀光一闪。\n“你疯了？”她问。\n'}`
    .repeat(2500)
  const full = slowOpening + dialogueBody
  const headOnly = full.slice(0, MAX_PERSONA_TEXT)
  const { sample } = samplePersonaText(full)
  // 只看开头时统计到的对话比例，与采样后的比例必须不同，
  // 否则说明采样没有把正文的对话体带进来。
  const headDialogue = personaEvidence(headOnly).dialogueRatio
  const sampleDialogue = personaEvidence(sample).dialogueRatio
  assert.ok(sampleDialogue > headDialogue, `采样后对话占比应更高：开头 ${headDialogue}% vs 采样 ${sampleDialogue}%`)
})

test('拆书结果落盘后仍能追溯模型、来源与覆盖比例', async () => {
  // 风格卡片是给人看的，但「这份人格可不可信」要靠溯源字段判断：
  // 用了哪个模型、从什么来源、看了全书多少比例。这些一旦在保存时被
  // 白名单过滤掉，日后就再也查不回来了。
  const cwd = makeWorkspace()
  try {
    const h = host(personaJson())
    const huge = `${'开头。'.repeat(20000)}${'结尾。'.repeat(20000)}`
    const persona = await extractPersona(h.ctx, { text: huge, route, name: '某作者' })
    savePersona(cwd, '测试书', persona)
    const loaded = loadPersona(cwd, '测试书')
    assert.equal(loaded.model, `${route.provider}/${route.model}`, '要记住是哪个模型拆的')
    assert.ok(loaded.covered > 0 && loaded.covered <= 1, `覆盖比例丢失：${loaded.covered}`)
    assert.equal(loaded.truncated, true)
    assert.ok(loaded.source !== undefined || loaded.covered !== undefined)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('extractPersona 对长篇把采样范围与覆盖比例交给模型并如实回报', async () => {
  const h = host(personaJson())
  const huge = `${'开头段。'.repeat(3000)}${'中段。'.repeat(3000)}${'结尾段。'.repeat(3000)}`
  const persona = await extractPersona(h.ctx, { text: huge, route })
  assert.equal(persona.truncated, true)
  assert.ok(persona.covered > 0)
  const sent = h.calls[0].messages[0].content[0].text
  assert.match(sent, /均匀取材/u, '提示词要说明是采样而非全文')
  assert.match(sent, /开头\/中段\/结尾/u)
  assert.match(sent, /结尾段/u, '采样必须真的包含结尾内容')
  // 送出去的字数不能超过预算，否则会撞 input-limit。
  assert.ok(sent.length <= MAX_PERSONA_TEXT + 6000, `提示词过长：${sent.length}`)
})
