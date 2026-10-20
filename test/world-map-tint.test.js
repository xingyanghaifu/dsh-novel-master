import test from 'node:test'
import assert from 'node:assert/strict'
import { renderWorldMap } from '../src/world-map.js'

const layers = ['M 10 10 L 70 10 L 70 70 L 10 70 Z']

test('导出地图带地貌配色', () => {
  // 界面上有颜色、导出的是空白等高线，作者会以为功能没生效
  const out = renderWorldMap({
    layers,
    project: '测试',
    sites: [
      { name: '无声之地', terrainKind: 'desert', x: 0.18, y: 0.5, height: 0.6 },
      { name: '背面', terrainKind: 'snow', x: 0.82, y: 0.18, height: 0.7 },
    ],
  })
  assert.ok(out.svg.includes('<radialGradient'), '应带色斑渐变')
  assert.equal((out.svg.match(/<radialGradient /gu) ?? []).length, 2)
  assert.ok(out.svg.includes('fill="url(#w0)"'), '应引用色斑')
})

test('认不出地形的地点不涂颜色', () => {
  // 猜一个颜色比不涂更误导：把一座城涂成森林，作者会以为是 bug
  const out = renderWorldMap({
    layers,
    project: '测试',
    sites: [{ name: '某地', x: 0.3, y: 0.8, height: 0.3 }],
  })
  assert.equal((out.svg.match(/<radialGradient /gu) ?? []).length, 0)
})

test('地形能从名字推出来，不必等前端传', () => {
  const out = renderWorldMap({
    layers,
    project: '测试',
    sites: [{ name: '无声之地', desc: '一片沙漠', x: 0.18, y: 0.5, height: 0.6 }],
  })
  assert.ok(out.svg.includes('<radialGradient'), '名字或说明里写了沙漠就该上色')
})

test('色斑画在等高线下面', () => {
  // 顺序错了颜色会盖住等高线，整张图糊掉
  const out = renderWorldMap({
    layers,
    project: '测试',
    sites: [{ name: '背面', terrainKind: 'snow', x: 0.82, y: 0.18, height: 0.7 }],
  })
  const defs = out.svg.indexOf('<defs>')
  const tints = out.svg.indexOf('<g class="tints">')
  const contours = out.svg.indexOf('<g class="contours">')
  assert.ok(defs >= 0 && tints > defs, 'defs 要在色斑前')
  assert.ok(tints < contours, '色斑要在等高线下')
})

test('配色不会把文件撑大', () => {
  // 把 PNG 塞进 SVG 会让体积翻几十倍；纯矢量色斑只多几百字节
  const out = renderWorldMap({
    layers,
    project: '测试',
    sites: Array.from({ length: 20 }, (_, i) => ({
      name: `地点${i}`, terrainKind: 'forest', x: i / 20, y: 0.5, height: 0.5,
    })),
  })
  assert.ok(out.svg.length < 100000, `20 个地点时 ${out.svg.length} 字节，太大了`)
  assert.ok(!out.svg.includes('data:image/png;base64'), '不该内嵌位图')
})
