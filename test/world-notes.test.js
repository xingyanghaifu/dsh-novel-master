import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const SOURCE = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')

test('WorldNotes 存在且接在存为地图资产之后', () => {
  assert.ok(SOURCE.includes('function WorldNotes('), '缺 WorldNotes 组件')
  // 顺序：先动作后解释。反过来会让人以为那段文字是保存的附带品
  const save = SOURCE.indexOf('存为地图资产')
  const notes = SOURCE.indexOf('WorldNotes(h, { regions: placeLike')
  assert.ok(save > 0 && notes > save, 'WorldNotes 应渲染在存为地图资产之后')
})

test('WorldNotes 不吃后端没给的数据', () => {
  // 空项目不该多出一块空表格
  assert.ok(SOURCE.includes('if (list.length === 0) return null'), '没有地区时应返回 null')
  // world 缺失时不能抛
  assert.ok(SOURCE.includes('const issues = Array.isArray(world?.issues) ? world.issues : []'))
})

test('气候数据来自后端，前端不重算', () => {
  // 两处各算一套，迟早出现「图上写湿热、侧栏写干旱」
  assert.ok(SOURCE.includes('climate: region.climate ?? null'), '地区应直接带后端的 climate')
  assert.ok(SOURCE.includes('region.climate.bandLabel'), '纬度带应读后端结果')
  assert.ok(SOURCE.includes('region.climate.summary'), '气候概要应读后端结果')
})

test('问题按严重度分色，且只列前五条', () => {
  // 全都标红等于都没标红
  assert.ok(SOURCE.includes("high: 'nm-world-issue-high'"))
  assert.ok(SOURCE.includes("medium: 'nm-world-issue-mid'"))
  assert.ok(SOURCE.includes("low: 'nm-world-issue-low'"))
  // 列表要短，多了给出路
  assert.ok(SOURCE.includes('issues.slice(0, 5)'), '最多列五条')
  assert.ok(SOURCE.includes('还有 ${issues.length - 5} 条'), '超出部分要给出路')
})

test('完整解释放在 title 里，列表只留一句', () => {
  // 列表长了就把地形图挤出屏幕了
  assert.ok(SOURCE.includes('title: `${issue.message}\\n\\n建议：${issue.suggestion}`'))
})

test('世界概览的 CSS 全部存在，且不用不存在的变量', () => {
  const css = /const CSS = `([\s\S]*?)`\r?\n/.exec(SOURCE)
  assert.ok(css, '抽不到 CSS 块')
  const block = css[1]
  for (const cls of [
    'nm-world', 'nm-world-head', 'nm-world-title', 'nm-world-hint',
    'nm-world-list', 'nm-world-row', 'nm-world-name', 'nm-world-band',
    'nm-world-terrain', 'nm-world-climate', 'nm-world-issues',
    'nm-world-issues-head', 'nm-world-issues-count', 'nm-world-issue-list',
    'nm-world-issue', 'nm-world-more', 'nm-world-research',
  ]) {
    assert.ok(block.includes(`.${cls}`), `CSS 缺少 .${cls}`)
  }
  // --nm-bad 这个变量根本不存在，写了也不会生效
  assert.ok(!block.includes('--nm-bad'), 'CSS 里用了不存在的 --nm-bad')
  assert.ok(block.includes('var(--nm-border-soft)'), '分隔线应使用已有的软边框变量')
})

test('问题行能换行，检索词不会被挤成一行', () => {
  // .nm-world-issue 原本是 flex 单行，把检索词加进去会横着挤出容器
  assert.ok(SOURCE.includes('flex-wrap:wrap;gap:2px 5px'), '问题行应允许换行')
  assert.ok(SOURCE.includes('.nm-world-research{display:block'), '检索词应独占一行')
})

test('作者写的设定与推演结论在视觉上分开', () => {
  // 「无源质」是作者写的，「炎热多雨」是算出来的。混在一起看，
  // 读者会以为全都是推的，反而没人回去看原文。
  assert.ok(SOURCE.includes('nm-world-mark'), '缺少设定限定的标签样式')
  assert.ok(SOURCE.includes('region.climate.marks?.length'), '应只在这些限定存在时渲染标签')
  assert.ok(SOURCE.includes("title: '来自你的设定，不是推出来的'"), '标签要说明来源')
  assert.ok(SOURCE.includes('region.climate.derived'), '推演结论的 title 要区分来源')
  // 五列：名字、纬度带、地形、设定标签、气候
  assert.ok(SOURCE.includes('grid-template-columns:1fr auto auto auto auto'), '行布局应为五列')
})
