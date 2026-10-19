import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { assetReadiness, buildAtlas, cleanLabel, eventsOf, extractChapter, headingTree, parseTable, readBatchStatus, regionsOf, worldClockLines } from '../src/atlas.js'

test('headingTree nests headings by level and keeps stable ids', () => {
  const { nodes, total, truncated } = headingTree('# 书\n## 世界\n### 规则A\n## 角色\n')
  assert.equal(total, 4)
  assert.equal(truncated, false)
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].label, '书')
  assert.deepEqual(nodes[0].children.map((n) => n.label), ['世界', '角色'])
  assert.deepEqual(nodes[0].children[0].children.map((n) => n.label), ['规则A'])
  assert.equal(nodes[0].id, '/0')
  assert.equal(nodes[0].children[0].id, '/0/0')
})

test('headingTree truncates past the node cap', () => {
  const text = Array.from({ length: 420 }, (_, i) => `## 标题${i}`).join('\n')
  const { total, truncated } = headingTree(text)
  assert.equal(total, 400)
  assert.equal(truncated, true)
})

test('cleanLabel strips markdown decoration', () => {
  assert.equal(cleanLabel('**主角** `林晓` ###'), '主角 林晓')
})

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-atlas-'))
  const project = path.join(cwd, 'novel_projects', '测试书')
  fs.mkdirSync(path.join(project, '正文'), { recursive: true })
  fs.writeFileSync(path.join(project, '设定.md'), '# 设定\n\n## 力量体系\n\n### 等级\n', 'utf8')
  fs.writeFileSync(path.join(project, '角色.md'), '# 角色\n\n## 林晓\n\n## 顾寒\n', 'utf8')
  fs.writeFileSync(path.join(project, '伏笔.md'), '| 伏笔 | 埋于 | 状态 |\n| --- | --- | --- |\n| 铜镜 | 1 | 已回收 |\n| 黑影 | 2 | 未回收 |\n', 'utf8')
  fs.writeFileSync(path.join(project, '剧情树.md'), '# 剧情树\n\n## 分岔1\n\n## 分岔2\n', 'utf8')
  fs.writeFileSync(path.join(project, '正文', '第1章.md'), '# 第1章 起点\n\n' + '字'.repeat(1200), 'utf8')
  fs.writeFileSync(path.join(project, '正文', '第3章.md'), '# 第3章 转折\n\n' + '字'.repeat(800), 'utf8')
  fs.writeFileSync(path.join(project, '项目.json'), JSON.stringify({ title: '测试书', target: 10 }), 'utf8')
  return cwd
}

test('buildAtlas returns project tree, progress and missing chapters', () => {
  const cwd = fixture()
  const atlas = buildAtlas({ cwd, projectsDirectory: 'novel_projects' })
  assert.equal(atlas.error, undefined)
  assert.equal(atlas.defaultProject, '测试书')
  assert.equal(atlas.projects.length, 1)
  const project = atlas.projects[0]
  assert.equal(project.title, '测试书')
  assert.equal(project.progress.chapters, 2)
  assert.equal(project.progress.goal, 10)
  assert.equal(project.progress.last, 3)
  assert.deepEqual(project.progress.missing, [2])
  assert.equal(project.progress.percent, 30)
  assert.equal(project.progress.foreshadowTotal, 2)
  assert.equal(project.progress.foreshadowOpen, 1)
  assert.equal(project.progress.branches, 2)
  const setting = project.sections.find((section) => section.key === 'setting')
  assert.equal(setting.exists, true)
  // 文档 H1 空壳被提升：直接看到「力量体系」而不是「设定 > 力量体系」
  assert.equal(setting.docTitle, '设定')
  assert.equal(setting.nodes[0].label, '力量体系')
  assert.equal(setting.nodes[0].children[0].label, '等级')
  const rules = project.sections.find((section) => section.key === 'rules')
  assert.equal(rules.exists, false)
  assert.equal(project.chapterList.count, 2)
  assert.match(project.chapterList.nodes[0].label, /第1章/u)
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('atlas exposes readiness so the progress panel does not re-derive it', () => {
  const cwd = fixture()
  const atlas = buildAtlas({ cwd, projectsDirectory: 'novel_projects' })
  const { readiness } = atlas.projects[0]
  assert.ok(readiness, '项目应当带 readiness')
  // fixture 有 设定/角色/伏笔/剧情树 和 2 章正文，缺 大纲/世界状态/写作规范
  const byKey = Object.fromEntries(readiness.items.map((item) => [item.key, item]))
  assert.equal(byKey.setting.exists, true)
  assert.equal(byKey.outline.exists, false)
  assert.equal(byKey.rules.exists, false)
  assert.equal(byKey.chapters.exists, true, '有正文就算完成')
  assert.equal(byKey.chapters.headings, 2)
  // 伏笔.md 是纯表格、没有标题，但它确实写好了 —— 这正是不能按 headings
  // 判断的原因。
  assert.equal(byKey.foreshadow.exists, true)
  assert.equal(byKey.foreshadow.headings, 0)
  assert.equal(byKey.foreshadow.chars > 0, true)
  assert.equal(readiness.total, 8, '七个扇区 + 正文')
  assert.equal(readiness.done, 5)
  assert.equal(readiness.percent, 63)
  // next 必须是按扇区顺序的第一个缺失项，前端靠它给出下一步建议
  assert.equal(readiness.next, 'outline')
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('assetReadiness treats an empty document as not ready', () => {
  // 文件存在但一个字都没有：手工建了个空文件不算写好。
  const readiness = assetReadiness([
    { key: 'setting', label: '世界观', exists: true, headings: 0, chars: 0, truncated: false },
    { key: 'cast', label: '人设', exists: true, headings: 2, chars: 120, truncated: false },
  ], 0)
  assert.equal(readiness.items[0].exists, false, '空文档不算完成')
  assert.equal(readiness.items[0].created, true, '但确实创建过，UI 要能区分')
  assert.equal(readiness.items[1].exists, true)
  assert.equal(readiness.next, 'setting')
})

test('assetReadiness counts headingless table documents as written', () => {
  // 伏笔.md 是纯表格：有内容但没有任何标题。只按 headings 判断会误报未完成。
  const readiness = assetReadiness([
    { key: 'foreshadow', label: '伏笔', exists: true, headings: 0, chars: 86, truncated: false },
  ], 0)
  assert.equal(readiness.items[0].exists, true)
  assert.equal(readiness.items[0].chars, 86)
})

test('readBatchStatus reports progress and tolerates a missing or broken file', () => {
  const cwd = fixture()
  const project = path.join(cwd, 'novel_projects', '测试书')
  assert.equal(readBatchStatus(cwd, '测试书'), null, '没跑过批量写作时是 null')

  fs.writeFileSync(path.join(project, '批量写作状态.json'),
    JSON.stringify({ phase: 'running', done: 3, target: 12, requestSize: 2, lastError: '', updatedAt: '2026-10-19T03:00:00.000Z' }), 'utf8')
  const status = readBatchStatus(cwd, '测试书', Date.parse('2026-10-19T03:00:30.000Z'))
  assert.equal(status.phase, 'running')
  assert.equal(status.phaseLabel, '正在写')
  assert.equal(status.done, 3)
  assert.equal(status.percent, 25)
  assert.equal(status.staleMs, 30000)

  fs.writeFileSync(path.join(project, '批量写作状态.json'), '{ 这不是 json', 'utf8')
  assert.equal(readBatchStatus(cwd, '测试书'), null, '坏文件当没跑过，不能拖垮面板')

  fs.writeFileSync(path.join(project, '批量写作状态.json'), '[]', 'utf8')
  assert.equal(readBatchStatus(cwd, '测试书'), null, '数组不是合法状态')
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('readBatchStatus keeps an unknown phase readable instead of leaking the raw code', () => {
  const cwd = fixture()
  fs.writeFileSync(path.join(cwd, 'novel_projects', '测试书', '批量写作状态.json'),
    JSON.stringify({ phase: 'paused-by-user', done: 1, target: 5 }), 'utf8')
  const status = readBatchStatus(cwd, '测试书')
  assert.equal(status.phase, 'paused-by-user', '原始值保留，便于排查')
  assert.equal(status.phaseLabel, '状态未知', '展示层永远是中文')
  assert.equal(status.percent, 20)
  assert.equal(status.staleMs, null, '没有 updatedAt 就没有陈旧判断')
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('buildAtlas accepts an absolute projectsDir without a session cwd', () => {
  const cwd = fixture()
  const atlas = buildAtlas({ cwd: '', projectsDirectory: path.join(cwd, 'novel_projects') })
  assert.equal(atlas.error, undefined)
  assert.equal(atlas.projects.length, 1)
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('buildAtlas refuses to guess a root without cwd', () => {
  const atlas = buildAtlas({ cwd: '', projectsDirectory: 'novel_projects' })
  assert.equal(atlas.error, 'no-cwd')
  assert.match(atlas.message, /projectsDir/u)
})

test('extractChapter and parseTable handle the documented shapes', () => {
  assert.equal(extractChapter('第12章 起点'), 12)
  assert.equal(extractChapter('12章'), 12)
  assert.equal(extractChapter('12'), 12)
  assert.equal(extractChapter('第一卷'), null)
  const table = parseTable('| 事件 | 章号 |\n| --- | --- |\n| 王都遇刺 | 5 |\n')
  assert.deepEqual(table.header, ['事件', '章号'])
  assert.deepEqual(table.rows, [['王都遇刺', '5']])
  assert.equal(parseTable('纯文本，不是表格'), null)
})

function fixtureRich() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-map-'))
  const project = path.join(cwd, 'novel_projects', '地图书')
  fs.mkdirSync(project, { recursive: true })
  fs.writeFileSync(path.join(project, '地区.md'),
    '| 地区 | 方位 | 地形 | 说明 | 人物 |\n| --- | --- | --- | --- | --- |\n| 王都 | 中 | 城邦 | 王权中心 | 国王 |\n| 北境 | 北 | 雪原 | 边塞要冲 | 领主 |\n', 'utf8')
  fs.writeFileSync(path.join(project, '事件.md'),
    '| 事件 | 章号 | 地区 | 状态 |\n| --- | --- | --- | --- |\n| 王都遇刺 | 5 | 王都 | 已发生 |\n| 北境烽烟 | 9 | | 未发生 |\n', 'utf8')
  return cwd
}

test('regionsOf reads the 地区.md table and eventsOf links regions', () => {
  const cwd = fixtureRich()
  const regions = regionsOf(cwd, '地图书')
  assert.deepEqual(regions.map((region) => region.name), ['王都', '北境'])
  assert.equal(regions[0].pos, '中')
  assert.equal(regions[0].terrain, '城邦')
  assert.equal(regions[1].terrain, '雪原')
  const events = eventsOf(cwd, '地图书', regions)
  assert.equal(events.length, 2)
  assert.equal(events[0].title, '王都遇刺')
  assert.equal(events[0].chapter, 5)
  assert.equal(events[0].region, '王都')
  assert.equal(events[0].status, '已发生')
  // 空地区列回退到标题里的地区名匹配
  assert.equal(events[1].region, '北境')
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('regionsOf falls back to 设定.md 地理 and eventsOf derives a timeline', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-map2-'))
  const project = path.join(cwd, 'novel_projects', '推导书')
  fs.mkdirSync(project, { recursive: true })
  fs.writeFileSync(path.join(project, '设定.md'), '# 设定\n\n## 地理\n\n### 王都\n\n### 北境\n', 'utf8')
  fs.writeFileSync(path.join(project, '大纲.md'), '# 大纲\n\n- **第1章 坠落**：末地被毁。\n- **第2章 相遇**：学者登场。\n第一卷：起承（第 1–6 章）\n', 'utf8')
  fs.writeFileSync(path.join(project, '剧情树.md'), '# 剧情树\n\n## 分岔点 1 · 第 2 章 抉择\n', 'utf8')
  fs.writeFileSync(path.join(project, '伏笔.md'), '| 伏笔 | 埋于 | 状态 |\n| --- | --- | --- |\n| 王都的铜镜 | 1 | 未回收 |\n', 'utf8')
  fs.writeFileSync(path.join(project, '世界状态.md'), '# 世界状态\n\n## 世界时钟\n三百年前大陆统一\n\n## 势力与角色动向\n', 'utf8')
  const regions = regionsOf(cwd, '推导书')
  assert.deepEqual(regions.map((region) => region.name), ['王都', '北境'])
  const events = eventsOf(cwd, '推导书', regions)
  const chapters = [...new Set(events.filter((event) => event.chapter !== null).map((event) => event.chapter))].sort()
  assert.deepEqual(chapters, [1, 2])
  // 加粗条目的标题去掉章号与描述，只留「坠落」
  assert.equal(events.find((event) => event.source === '大纲' && event.chapter === 1).title, '坠落')
  // 卷名里的“第 1–6 章”区间不算事件
  assert.equal(events.some((event) => /起承/u.test(event.title)), false)
  // 伏笔按地区名归位，世界时钟进背景
  assert.equal(events.find((event) => event.source === '伏笔').region, '王都')
  assert.equal(events.find((event) => event.source === '世界时钟').chapter, null)
  assert.deepEqual(worldClockLines(fs.readFileSync(path.join(project, '世界状态.md'), 'utf8')), ['三百年前大陆统一'])
  fs.rmSync(cwd, { recursive: true, force: true })
})
