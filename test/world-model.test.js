import test from 'node:test'
import assert from 'node:assert/strict'

import {
  auditWorld,
  baselineOf,
  climateOf,
  describeWorld,
  detectMarks,
  detectTerrain,
  latitudeBand,
  prevailingWind,
  TERRAIN_TRAITS,
} from '../src/world-model.js'

/** 一个典型的奇幻世界：赤道雨林、副热带沙漠、温带平原、极地冰原。 */
const SAMPLE = [
  { name: '赤道密林', desc: '湿热丛林', x: 0.5, y: 0.5, terrain: '森林' },
  { name: '大沙海', desc: '连绵沙丘', x: 0.2, y: 0.3, terrain: '沙漠' },
  { name: '中央平原', desc: '四族共存之地', x: 0.5, y: 0.42, terrain: '原野' },
  { name: '北境冰原', desc: '终年冰封', x: 0.5, y: 0.05, terrain: '雪原' },
]

test('能从地形列和说明里认出地形种类', () => {
  assert.equal(detectTerrain('雪原', ''), 'snow')
  assert.equal(detectTerrain('', '终年积雪的山谷'), 'snow')
  assert.equal(detectTerrain('', '建在源质最浓的平原中央'), 'plain')
  assert.equal(detectTerrain('', '连绵无尽的沙丘'), 'desert')
  assert.equal(detectTerrain('', '深渊之下'), 'cave')
  // 地形列优先于说明 —— 作者明确写了就别去猜
  assert.equal(detectTerrain('城邦', '旁边有片森林'), 'city')
})

test('认不出来的文字返回 undefined，而不是硬猜成平原', () => {
  // 猜错的比没有更糟：会凭空给一个地方安上气候
  assert.equal(detectTerrain('', '一个名字很长的地方'), undefined)
  assert.equal(detectTerrain('', ''), undefined)
  assert.equal(detectTerrain(undefined, undefined), undefined)
})

test('纬度带以赤道为中心南北对称', () => {
  // 这是真实世界的基本形状，也是审计能用的前提
  for (const y of [0.05, 0.2, 0.35, 0.45]) {
    const north = latitudeBand(y)
    const south = latitudeBand(1 - y)
    assert.equal(north.key, south.key, `y=${y} 与 y=${1 - y} 应属同一纬度带`)
  }
  // 正中间必须是热带
  assert.equal(latitudeBand(0.5).key, 'tropical')
  // 两端必须是极地
  assert.equal(latitudeBand(0.0).key, 'polar')
  assert.equal(latitudeBand(1.0).key, 'polar')
})

test('越靠两极越冷，赤道最热', () => {
  const warmthAt = (y) => climateOf({ x: 0.5, y, terrain: '原野', desc: '' }, { neighbours: [] }).warmth
  assert.ok(warmthAt(0.5) > warmthAt(0.3), '赤道应比温带热')
  assert.ok(warmthAt(0.3) > warmthAt(0.1), '温带应比亚寒带热')
  assert.ok(warmthAt(0.1) > warmthAt(0.0), '亚寒带应比极地热')
})

test('海拔越高越冷，赤道高山也能有冰', () => {
  const low = climateOf({ x: 0.5, y: 0.5, terrain: '原野', desc: '' }, { neighbours: [] })
  const high = climateOf({ x: 0.5, y: 0.5, terrain: '山地', desc: '' }, { neighbours: [] })
  assert.ok(high.warmth < low.warmth, '山应比平原冷')
  // 乞力马扎罗在赤道，山顶有冰川 —— 高山把温度拉下来是必须的
  assert.ok(high.warmth < 0.6, `赤道高山应明显偏冷，实测 ${high.warmth}`)
})

test('副热带比赤道干，极锋又比副热带湿 —— 三条雨带不能单调', () => {
  const wetAt = (y) => baselineOf({ x: 0.5, y, terrain: '原野' }, { x: 0.5, y }).wet
  const equator = wetAt(0.5)
  const subtropical = wetAt(0.3) // 南北纬 30° 附近，副热带高压
  const polarFront = wetAt(0.12) // 极锋附近
  const pole = wetAt(0.0)
  assert.ok(equator > subtropical, '赤道辐合带应比副热带湿')
  assert.ok(polarFront > pole, '极锋应比极点湿')
  // 之前的错误版本让副热带比赤道还湿，沙漠因此算不出干旱
  assert.ok(subtropical < 0.4, `副热带应明显偏干，实测 ${subtropical}`)
})

test('盛行风随纬度改变，赤道带是东风', () => {
  assert.equal(prevailingWind(0.5).key, 'east', '赤道信风带应为东风')
  assert.equal(prevailingWind(0.25).key, 'west', '中纬西风带应为西风')
  assert.equal(prevailingWind(0.02).key, 'east', '极地东风带应为东风')
})

test('上风侧有高山时下风侧出现雨影', () => {
  // 中纬度吹西风：山在西边，东边的地点就该变干
  const mountain = { name: '西岭', x: 0.3, y: 0.25, terrain: '山地', desc: '' }
  const leeward = { name: '雨影镇', x: 0.45, y: 0.25, terrain: '原野', desc: '' }
  const climate = climateOf(leeward, { neighbours: [mountain, leeward] })
  assert.ok(climate.rainShadow > 0.2, `应检测到雨影，实测 ${climate.rainShadow}`)

  // 同样的地点，山搬到下风侧就不该有雨影
  const wrongSide = { ...mountain, x: 0.55 }
  const noShadow = climateOf(leeward, { neighbours: [wrongSide, leeward] })
  assert.ok(noShadow.rainShadow < 0.1, '下风侧的山不该造成雨影')
})

test('审计抓得到「赤道雪原」', () => {
  const report = auditWorld([{ name: '赤道雪原', desc: '终年积雪', x: 0.5, y: 0.5, terrain: '雪原' }])
  assert.equal(report.coherent, false)
  const issue = report.issues.find((i) => i.kind === 'snow-too-warm')
  assert.ok(issue, '应报出 snow-too-warm')
  assert.equal(issue.severity, 'high')
  assert.ok(issue.suggestion.length > 0, '每条问题都要给建议，不能只判罪')
})

test('审计抓得到「热带沙漠」，但只判 medium', () => {
  // 奇幻世界里「源质被抽干的荒原」是成立的设定，作者常常已经写明原因。
  // 判成 high 会让整个世界显得处处是错，作者反而不再看提示。
  // 所以这条能报出来，但不算「讲不通」。
  //
  // 注意说明用词：写「寸草不生」会被认成枯萎限定，那属于作者已解释，
  // 反而不该报。这里要的是一个没给理由的沙漠。
  const report = auditWorld([{ name: '热带沙漠', desc: '一片黄沙', x: 0.5, y: 0.5, terrain: '沙漠' }])
  const issue = report.issues.find((i) => i.kind === 'desert-too-wet')
  assert.ok(issue, '应报出 desert-too-wet')
  assert.equal(issue.severity, 'medium', '沙漠在湿处只提示，不判死')
  assert.equal(report.coherent, true, 'medium 级问题不应让世界判成讲不通')
})

test('审计抓得到「无水之城」', () => {
  const report = auditWorld([
    { name: '孤城', desc: '要塞', x: 0.3, y: 0.3, terrain: '城邦' },
  ])
  const issue = report.issues.find((i) => i.kind === 'city-without-water')
  assert.ok(issue, `应报出无水之城，实际：${report.issues.map((i) => i.kind).join(',')}`)
})

test('审计不会冤枉合理的世界', () => {
  // 误报比漏报更糟：作者会开始无视提示
  const report = auditWorld(SAMPLE)
  assert.equal(report.coherent, true, `不该有 high 级问题：${report.issues.map((i) => i.kind).join(',')}`)
})

test('审计只看位置不看地形本身 —— 否则是循环论证', () => {
  // 这是最容易犯的错：用推演结果去校验地形。
  // 沙漠的 aridity 会拉低自己的湿度，于是「沙漠查出自己干旱」，
  // 永远不矛盾，审计等于没有。所以判据必须用 baselineOf。
  const desert = { x: 0.5, y: 0.5, terrain: '沙漠', desc: '' }
  const climate = climateOf(desert, { neighbours: [desert] })
  const base = baselineOf(desert, { x: 0.5, y: 0.5 })
  // 推演结果被地形拉干，基准值不受地形影响
  assert.ok(climate.wet < base.wet, '推演湿度应低于基准（沙漠抽干了它）')
  assert.ok(base.wet > 0.6, '赤道基准湿度应很高')
  // 正因为两者不同，审计才能发现「赤道沙漠」这种矛盾
  const report = auditWorld([{ name: '赤道沙漠', desc: '沙海', x: 0.5, y: 0.5, terrain: '沙漠' }])
  assert.ok(report.issues.some((i) => i.kind === 'desert-too-wet'))
})

test('同一份设定算两次，结果完全一样', () => {
  // 面板每 4 秒刷新一次。有随机数的话世界会跟着变，读者会更晕。
  const first = auditWorld(SAMPLE)
  const second = auditWorld(SAMPLE)
  assert.deepEqual(first, second)
})

test('空输入不炸', () => {
  assert.deepEqual(auditWorld([]), { issues: [], climates: [], coherent: true })
  assert.deepEqual(auditWorld(), { issues: [], climates: [], coherent: true })
  assert.equal(describeWorld([]), '')
})

test('没有名字的地区会被跳过，不污染结果', () => {
  const report = auditWorld([
    { name: '', terrain: '雪原', x: 0.5, y: 0.5 },
    { terrain: '沙漠' },
    null,
    { name: '北境冰原', desc: '冰封', x: 0.5, y: 0.05, terrain: '雪原' },
  ])
  assert.equal(report.climates.length, 1)
  assert.equal(report.climates[0].name, '北境冰原')
})

test('坐标缺失时退回画布中部，而不是算出 NaN', () => {
  const climate = climateOf({ name: '某地', desc: '', terrain: '原野' }, { neighbours: [] })
  assert.ok(Number.isFinite(climate.warmth) && Number.isFinite(climate.wet))
  assert.equal(latitudeBand(Number.NaN).key, 'tropical')
})

test('世界概要包含表格与待解释的地方', () => {
  const text = describeWorld([
    ...SAMPLE,
    { name: '赤道雪原', desc: '终年积雪', x: 0.5, y: 0.5, terrain: '雪原' },
  ])
  assert.ok(text.includes('| 地区 |'), '应有表头')
  assert.ok(text.includes('赤道密林'))
  assert.ok(text.includes('需要解释的地方'), '有矛盾时应有这一节')
  assert.ok(text.includes('赤道雪原'))
})

test('气候概要是人能读的中文，不是数字', () => {
  const climate = climateOf({ x: 0.5, y: 0.5, terrain: '森林', desc: '' }, { neighbours: [] })
  assert.match(climate.summary, /^[炎热温暖凉爽寒冷]{2}(多雨|湿润|半干|干旱)$/u)
})

test('每种地形都有完整的物理属性', () => {
  // 少一个字段，推演就会算出 NaN，而这种错会静默传到界面上
  for (const [kind, traits] of Object.entries(TERRAIN_TRAITS)) {
    assert.equal(typeof traits.label, 'string', `${kind} 缺 label`)
    assert.ok(traits.label.length > 0)
    for (const field of ['altitude', 'aridity', 'warmth']) {
      assert.equal(typeof traits[field], 'number', `${kind} 的 ${field} 不是数字`)
      assert.ok(Number.isFinite(traits[field]), `${kind} 的 ${field} 是 NaN`)
    }
    assert.equal(typeof traits.water, 'boolean', `${kind} 缺 water`)
  }
})

test('说明里的超自然限定能被认出来', () => {
  assert.deepEqual(detectMarks('绝对无源质，末影龙的全盛之所'), ['barren'])
  assert.deepEqual(detectMarks('被诅咒的永冬之地'), ['eternal-winter', 'cursed'])
  assert.deepEqual(detectMarks('普通的平原村落'), [])
  assert.deepEqual(detectMarks(undefined), [])
})

test('作者写了原因的异常，审计不再追问', () => {
  // 审计的价值在于「你没想到的地方」，不在于「你没写的地方」。
  // 他写了原因，就不是疏漏；重复提示只会训练他无视面板。
  const explained = auditWorld([
    { name: '深渊裂谷', desc: '绝对无源质', x: 0.5, y: 0.5, terrain: '沙漠' },
  ])
  assert.equal(explained.issues.some((i) => i.kind === 'desert-too-wet'), false,
    '已写明「无源质」的沙漠不该再被点名')

  // 同样的位置和地形，但没写原因，就该报
  const unexplained = auditWorld([
    { name: '无名沙海', desc: '一片沙地', x: 0.5, y: 0.5, terrain: '沙漠' },
  ])
  assert.equal(unexplained.issues.some((i) => i.kind === 'desert-too-wet'), true)
})

test('限定只解释它管得着的问题', () => {
  // 「永冬」能解释赤道雪原，解释不了城邦没水 —— 别一竿子全放过
  const report = auditWorld([
    { name: '诅咒雪原', desc: '被诅咒的永冬', x: 0.5, y: 0.5, terrain: '雪原' },
    { name: '无水城', desc: '一座城', x: 0.5, y: 0.3, terrain: '城邦' },
  ])
  assert.equal(report.issues.some((i) => i.kind === 'snow-too-warm'), false, '永冬应能解释雪原')
  assert.equal(report.issues.some((i) => i.kind === 'city-without-water'), true, '永冬解释不了没水')
})

test('climate 标明这条结论是谁给的', () => {
  const derived = climateOf({ x: 0.5, y: 0.5, terrain: '原野', desc: '一片平原' }, { neighbours: [] })
  assert.equal(derived.derived, true, '普通地点应标为推演所得')
  assert.deepEqual(derived.marks, [])

  const written = climateOf({ x: 0.5, y: 0.5, terrain: '沙漠', desc: '绝对无源质' }, { neighbours: [] })
  assert.equal(written.derived, false, '有设定限定时不该说成推演')
  assert.deepEqual(written.marks, ['无源质'], '面板要能显示作者写了什么')
})
