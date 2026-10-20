import test from 'node:test'
import assert from 'node:assert/strict'
import { renderWorldMap } from '../src/world-map.js'

const layers = ['M 10 10 L 70 10 L 70 70 L 10 70 Z']
const build = (sites, extra = {}) => renderWorldMap({ layers, project: '测试', sites, ...extra })

test('导出地图带地形块', () => {
  // 界面上是一块块拼起来的地，导出的是空白等高线，作者会以为功能没生效
  const out = build([
    { name: '无声之地', terrainKind: 'desert', x: 0.18, y: 0.5, height: 0.6 },
    { name: '背面', terrainKind: 'snow', x: 0.82, y: 0.18, height: 0.7 },
  ])
  assert.ok(out.svg.includes('class="cell"'), '应带地形块')
  assert.ok((out.svg.match(/class="cell"/gu) ?? []).length >= 2, '至少每个地点一块')
})

test('地形块是闭合多边形，覆盖整张图', () => {
  // 有缝的话图上会出现黑色三角，重叠的话后画的块盖住前面的
  const out = build([
    { name: '甲', terrainKind: 'plain', x: 0.3, y: 0.3, height: 0.5 },
    { name: '乙', terrainKind: 'forest', x: 0.7, y: 0.7, height: 0.5 },
  ])
  const paths = [...out.svg.matchAll(/<path class="cell[^"]*" d="([^"]*)"/gu)].map((m) => m[1])
  assert.ok(paths.length > 0, '应有地形块路径')
  for (const d of paths) {
    assert.ok(d.startsWith('M'), '应以 M 开头')
    assert.ok(d.endsWith('Z'), '应闭合')
    assert.ok(!d.includes('NaN'), '不能有 NaN')
  }
})

test('认不出地形的地点不涂颜色，但地块还在', () => {
  // 猜一个颜色比不涂更误导：把一座城涂成森林，作者会以为是 bug
  const out = build([{ name: '某地', x: 0.3, y: 0.8, height: 0.3 }])
  const filled = [...out.svg.matchAll(/<path class="cell[^"]*" d="[^"]*" fill="/gu)]
  assert.equal(filled.length, 0, '认不出地形就不该有色块')
})

test('地形能从名字推出来，不必等前端传', () => {
  const out = build([{ name: '无声之地', desc: '一片沙漠', x: 0.18, y: 0.5 }])
  assert.ok(out.svg.includes('fill="#b0914f"'), '名字或说明里写了沙漠就该用沙漠色')
})

test('导出的图里没有等高线', () => {
  // 等高线是用程序噪声编的，和作者的设定无关。存下来的资产里
  // 留着它，等于把伪造的地形固化进项目，比不画更糟。
  const out = build([{ name: '背面', terrainKind: 'snow', x: 0.82, y: 0.18 }])
  assert.ok(!out.svg.includes('class="contours"'), '不该有等高线组')
  assert.ok(!out.svg.includes('class="line"'), '不该有等高线路径')
  assert.ok(out.svg.includes('<g class="cells">'), '应有地形块组')
})

test('配色不会把文件撑大', () => {
  // 把 PNG 塞进 SVG 会让体积翻几十倍；多边形只多几百字节
  const sites = Array.from({ length: 20 }, (_, i) => ({
    name: `地点${i}`, terrainKind: 'forest', x: (i % 5) / 5 + 0.1, y: Math.floor(i / 5) / 4 + 0.1, height: 0.5,
  }))
  const out = build(sites)
  assert.ok(out.svg.length < 200000, `20 个地点时 ${out.svg.length} 字节，太大了`)
  assert.ok(!out.svg.includes('data:image/png;base64'), '不该内嵌位图')
})

test('填充块不描边，避免整张图变成网格纸', () => {
  // 早先给每块都画边，结果整张图布满网格线，像行政区划图。
  // 真实地貌的边界只出现在两个地区交界处，未命名的地带不该有格线。
  const out = build([
    { name: '甲', terrainKind: 'plain', x: 0.3, y: 0.3, height: 0.5 },
    { name: '乙', terrainKind: 'forest', x: 0.7, y: 0.7, height: 0.5 },
  ])
  const fillers = [...out.svg.matchAll(/<path class="cell filler"[^>]*>/gu)].map((m) => m[0])
  assert.ok(fillers.length > 0, '应有填充块')
  for (const tag of fillers) {
    assert.ok(!tag.includes('stroke='), `填充块不该描边：${tag.slice(0, 90)}`)
  }
})

test('同一份输入导出的地图完全相同', () => {
  // 前后端各算一次，形状必须一致；种子不对就会每次都不一样
  const sites = [
    { name: '无声之地', terrainKind: 'desert', x: 0.18, y: 0.5, height: 0.6 },
    { name: '背面', terrainKind: 'snow', x: 0.82, y: 0.18, height: 0.7 },
  ]
  assert.equal(build(sites).svg, build(sites).svg)
})
