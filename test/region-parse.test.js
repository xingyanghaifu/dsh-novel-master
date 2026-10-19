import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { buildAtlas, parseRegionLine } from '../src/atlas.js'

test('地名行：旧格式照旧能读', () => {
  // 不能因为加了新写法，就让已经写好的项目读不出来
  const plain = parseRegionLine('**白塔**：光辉圣教总部，建在源质最浓的平原中央')
  assert.equal(plain.name, '白塔')
  assert.equal(plain.desc, '光辉圣教总部，建在源质最浓的平原中央')
  assert.equal(plain.pos, '')
  assert.equal(plain.terrain, '')

  const noBold = parseRegionLine('无声之地：源质稀薄的边境荒原')
  assert.equal(noBold.name, '无声之地')
  assert.equal(noBold.desc, '源质稀薄的边境荒原')

  const bare = parseRegionLine('背面')
  assert.equal(bare.name, '背面')
  assert.equal(bare.desc, '')
})

test('地名行：括号里能读出方位和地形', () => {
  const full = parseRegionLine('**白塔**（东·城邦）：源质最浓的平原中央')
  assert.equal(full.name, '白塔')
  assert.equal(full.pos, '东')
  assert.equal(full.terrain, '城邦')
  assert.equal(full.desc, '源质最浓的平原中央')

  // 只有方位
  const onlyPos = parseRegionLine('**深渊裂谷**（北）：绝对无源质')
  assert.equal(onlyPos.name, '深渊裂谷')
  assert.equal(onlyPos.pos, '北')
  assert.equal(onlyPos.terrain, '')
  assert.equal(onlyPos.desc, '绝对无源质')

  // 只有地形
  const onlyTerrain = parseRegionLine('**背面**（雪原）：诸神被封印之地')
  assert.equal(onlyTerrain.name, '背面')
  assert.equal(onlyTerrain.pos, '')
  assert.equal(onlyTerrain.terrain, '雪原')
  assert.equal(onlyTerrain.desc, '诸神被封印之地')
})

test('地名行：复合方位优先于单字', () => {
  // 「西南」不能被读成「南」，否则地点会摆到正下方而不是左下
  assert.equal(parseRegionLine('**石锤镇**（西南）：故事起点').pos, '西南')
  assert.equal(parseRegionLine('**哨站**（东北）：边境').pos, '东北')
  assert.equal(parseRegionLine('**港城**（东南）').pos, '东南')
  assert.equal(parseRegionLine('**荒原**（西北）').pos, '西北')
})

test('地名行：半角括号也认', () => {
  const half = parseRegionLine('**白塔**(东·城邦)：说明')
  assert.equal(half.name, '白塔')
  assert.equal(half.pos, '东')
  assert.equal(half.terrain, '城邦')
})

test('地名行：括号里不是方位地形时不拆，保住原名', () => {
  // 「雾谷（北境）」的「北境」不是方位词，硬拆会把作者的地名切成两半
  const kept = parseRegionLine('**雾谷（北境）**：常年大雾')
  assert.equal(kept.name, '雾谷（北境）')
  assert.equal(kept.pos, '')
  assert.equal(kept.terrain, '')
})

test('地名行：没有冒号也能读方位', () => {
  const noDesc = parseRegionLine('**白塔**（东·城邦）')
  assert.equal(noDesc.name, '白塔')
  assert.equal(noDesc.pos, '东')
  assert.equal(noDesc.terrain, '城邦')
  assert.equal(noDesc.desc, '')
})

/** 建一个临时项目，写一份世界状态.md。 */
function makeProject(worldState) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-world-'))
  const dir = path.join(root, 'novel_projects', '测试项目')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '世界状态.md'), worldState, 'utf8')
  return { root, dir }
}

test('atlas 把方位和地形读进来，并算出各自不同的气候', () => {
  // 这条测试的意义：以前六个地区全被摆到画布正中，气候一模一样，
  // 「真实世界感」就无从谈起。现在每个地点必须在图上各占一方。
  const { root } = makeProject([
    '# 世界状态',
    '',
    '## 地理',
    '',
    '- **赤道密林**（中·森林）：湿热丛林',
    '- **大沙海**（北·沙漠）：连绵沙丘',
    '- **北境冰原**（东北·雪原）：终年冰封',
    '- **港城**（东·城邦）：靠海吃海',
    '',
    '## 其他',
    '',
  ].join('\n'))

  const atlas = buildAtlas({ cwd: root })
  if (atlas.error) assert.fail(`atlas 出错：${atlas.message}`)
  const project = atlas.projects[0]
  assert.equal(project.regions.length, 4)

  const byName = Object.fromEntries(project.regions.map((r) => [r.name, r]))
  assert.equal(byName['大沙海'].pos, '北')
  assert.equal(byName['大沙海'].terrain, '沙漠')

  // 每个地点都要有气候，且不能全都一样
  const climates = project.regions.map((r) => r.climate).filter(Boolean)
  assert.equal(climates.length, 4, '每个地区都该有气候推演结果')
  const summaries = new Set(climates.map((c) => c.summary))
  assert.ok(summaries.size > 1, `不同纬度的地区气候不该完全相同，实际全是：${[...summaries].join('/')}`)

  // 北边的沙海应当比赤道的密林干
  assert.ok(byName['大沙海'].climate.wet < byName['赤道密林'].climate.wet,
    '副热带沙漠应比赤道雨林干')

  // atlas 要暴露 world 汇总
  assert.equal(typeof project.world.coherent, 'boolean')
  assert.ok(Array.isArray(project.world.issues))
})

test('atlas 会把讲不通的设定报出来', () => {
  const { root } = makeProject([
    '# 世界状态',
    '',
    '## 地理',
    '',
    '- **赤道雪原**（中·雪原）：终年积雪的地方',
    '',
    '## 其他',
    '',
  ].join('\n'))

  const atlas = buildAtlas({ cwd: root })
  const project = atlas.projects[0]
  assert.equal(project.world.coherent, false)
  const issue = project.world.issues.find((i) => i.kind === 'snow-too-warm')
  assert.ok(issue, '应报出赤道雪原')
  assert.equal(issue.region, '赤道雪原')
})

test('旧格式项目照样能被读出来，且不会因为缺方位而崩', () => {
  // 已经存在的项目不会有方位标注，不能因为这次改动就让它们坏掉
  const { root } = makeProject([
    '# 世界状态',
    '',
    '## 地理',
    '',
    '- **艾尔登维尔大陆**：主舞台，四族共存',
    '- **白塔**：光辉圣教总部',
    '',
    '## 当前势力态势',
    '',
    '- **光辉圣教**：已发通缉',
    '',
  ].join('\n'))

  const atlas = buildAtlas({ cwd: root })
  const project = atlas.projects[0]
  // 「当前势力态势」里的条目不能被当成地名
  assert.deepEqual(project.regions.map((r) => r.name), ['艾尔登维尔大陆', '白塔'])
  // 缺方位时坐标退回中部，但气候仍然算得出来，不是 null
  for (const region of project.regions) {
    assert.equal(region.x, 0.5)
    assert.equal(region.y, 0.5)
    assert.ok(region.climate, `${region.name} 应有气候结论`)
  }
})

test('没有地理段的项目不会因此报错', () => {
  const { root } = makeProject('# 世界状态\n\n## 未解线索\n\n1. 某个问题\n')
  const atlas = buildAtlas({ cwd: root })
  const project = atlas.projects[0]
  assert.deepEqual(project.regions, [])
  assert.deepEqual(project.world.issues, [])
  assert.equal(project.world.coherent, true)
})
