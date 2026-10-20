import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { terrainCells, cellPath } from '../src/terrain-cells.js'

const sites = [
  { name: '艾尔登维尔大陆', x: 0.5, y: 0.5, terrainKind: 'plain', height: 0.8 },
  { name: '边境村·石锤镇', x: 0.34, y: 0.81, terrainKind: 'city', height: 0.5 },
  { name: '白塔', x: 0.82, y: 0.5, terrainKind: 'city', height: 0.6 },
  { name: '无声之地', x: 0.18, y: 0.5, terrainKind: 'desert', height: 0.6 },
  { name: '深渊裂谷', x: 0.5, y: 0.18, terrainKind: 'cave', height: 0.5 },
  { name: '背面', x: 0.82, y: 0.18, terrainKind: 'snow', height: 0.7 },
]

const area = (cell) => {
  let a = 0
  for (let i = 0; i < cell.points.length; i++) {
    const p = cell.points[i]
    const q = cell.points[(i + 1) % cell.points.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(a / 2)
}

test('每个地点都分到一块地', () => {
  const out = terrainCells(sites, { seed: '测试' })
  const names = out.cells.filter((c) => !c.filler).map((c) => c.key)
  assert.equal(names.length, sites.length)
  for (const site of sites) assert.ok(names.includes(site.name), `缺 ${site.name}`)
})

test('地块拼满整张图，不重叠也不留缝', () => {
  // 这是 Voronoi 的核心性质。有缝的话图上会出现黑三角，
  // 重叠的话后画的块会盖住前面的，边界看着是错的。
  const out = terrainCells(sites, { seed: '测试', width: 84, height: 84 })
  const total = out.cells.reduce((sum, c) => sum + area(c), 0)
  const canvas = 84 * 84
  assert.ok(Math.abs(total - canvas) < canvas * 0.001, `总面积 ${total.toFixed(1)} 与画布 ${canvas} 差太多`)
})

test('每块都是合法多边形', () => {
  const out = terrainCells(sites, { seed: '测试' })
  for (const cell of out.cells) {
    assert.ok(cell.points.length >= 3, `${cell.key} 只有 ${cell.points.length} 个点`)
    // 顶点不能跑到画布外
    for (const [x, y] of cell.points) {
      assert.ok(x >= -0.01 && x <= 84.01, `${cell.key} 的 x=${x} 越界`)
      assert.ok(y >= -0.01 && y <= 84.01, `${cell.key} 的 y=${y} 越界`)
    }
    // 不能有退化边（零长度），否则某些渲染器会画毛刺
    for (let i = 0; i < cell.points.length; i++) {
      const a = cell.points[i]
      const b = cell.points[(i + 1) % cell.points.length]
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6, `${cell.key} 有零长度边`)
    }
  }
})

test('同一份输入永远得到同一张图', () => {
  // 前后端各算一次，坐标必须完全一致，否则存下来的地图和界面上的对不上
  const a = terrainCells(sites, { seed: '末影之龙' })
  const b = terrainCells(sites, { seed: '末影之龙' })
  assert.deepEqual(
    a.cells.map((c) => c.points),
    b.cells.map((c) => c.points),
  )
})

test('换种子会换一张图', () => {
  const a = terrainCells(sites, { seed: '甲' })
  const b = terrainCells(sites, { seed: '乙' })
  assert.notDeepEqual(a.cells[0].points, b.cells[0].points)
})

test('空白地带继承最近的地形，而不是变黑', () => {
  // 早先填充块是深灰，整张图一大半是黑的，像地图没加载完。
  // 真实地图里远离城镇的地方也有地形，只是没有名字。
  const out = terrainCells(sites, { seed: '测试', filler: 8 })
  const filler = out.cells.filter((c) => c.filler)
  assert.ok(filler.length > 0, '应该有填充块')
  for (const cell of filler) {
    assert.ok(cell.terrainKind, `${cell.key} 没继承到地形`)
  }
})

test('填充块不会挤掉真实地点', () => {
  // 填充太密时真实地点会被切成很小的碎块，名字都放不下
  const out = terrainCells(sites, { seed: '测试', filler: 8 })
  const real = out.cells.filter((c) => !c.filler)
  for (const cell of real) {
    assert.ok(area(cell) > 30, `${cell.key} 只剩 ${area(cell).toFixed(0)} 面积，太小了`)
  }
})

test('没有地点时不崩，返回空图', () => {
  const out = terrainCells([], { seed: '测试' })
  assert.deepEqual(out.cells, [])
})

test('坐标缺失或非法的地点被跳过', () => {
  const out = terrainCells([
    { name: '好的', x: 0.5, y: 0.5 },
    { name: '没坐标' },
    { name: '非数字', x: 'a', y: 'b' },
    null,
  ], { seed: '测试' })
  const names = out.cells.filter((c) => !c.filler).map((c) => c.key)
  assert.deepEqual(names, ['好的'])
})

test('客户端和服务端算出的多边形逐点相同', () => {
  // 这条是整个方案的地基。界面上的图和后端存进资产的图必须一模一样，
  // 否则作者照界面认路、打开资产却对不上，这张图就没有价值。
  //
  // client.js 里有一份同样的实现（客户端不能 import 服务端模块），
  // 两份代码靠这条测试绑在一起。任何一边改了默认值或取整方式都会失败。
  const SOURCE = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  const extractFn = (name) => {
    const start = SOURCE.indexOf(`function ${name}(`)
    assert.ok(start > 0, `client.js 里必须有 ${name}`)
    let depth = 0
    for (let k = SOURCE.indexOf('{', start); k < SOURCE.length; k++) {
      if (SOURCE[k] === '{') depth++
      else if (SOURCE[k] === '}') {
        depth--
        if (depth === 0) return SOURCE.slice(start, k + 1)
      }
    }
    throw new Error(`${name} 未闭合`)
  }
  // eslint-disable-next-line no-new-func
  const client = new Function(`
    ${extractFn('terrainCells')}
    ${extractFn('cellPath')}
    return { terrainCells, cellPath }
  `)()

  const opts = { seed: '末影之龙', width: 84, height: 84 }
  const server = terrainCells(sites, opts)
  const doubt = client.terrainCells(sites, opts)
  assert.equal(doubt.cells.length, server.cells.length, '块数不一致')
  for (let i = 0; i < server.cells.length; i++) {
    assert.equal(
      client.cellPath(doubt.cells[i]),
      cellPath(server.cells[i]),
      `第 ${i} 块（${server.cells[i].key}）前后端不一致`,
    )
  }
})

test('单元格转出合法的 SVG path', () => {
  const out = terrainCells(sites, { seed: '测试' })
  const d = cellPath(out.cells[0])
  assert.ok(d.startsWith('M'), '应以 M 开头')
  assert.ok(d.endsWith('Z'), '应闭合')
  assert.ok(!d.includes('NaN'), '不能有 NaN')
  assert.equal(cellPath({ points: [] }), '')
})
