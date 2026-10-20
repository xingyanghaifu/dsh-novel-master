import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

/**
 * 地图相关的纯函数必须在源码层面盯住。
 *
 * 这几个函数在插件工厂里，没有单独导出，所以只能把源码抠出来用 new Function
 * 跑真实实现 —— 断言样式或者另写一份模拟都会走样。
 *
 * 背景：这张图曾经是一整个程序噪声高程场（等高线 + 高程配色），
 * 和作者的设定毫无关系。现在改成只画『地区.md』里写过的东西：
 * 地区名、方位、地形。下面每条都对应一个踩过的坑。
 */
const SOURCE = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')

/** 按大括号配对抠出函数声明。 */
function extractFn(name) {
  const start = SOURCE.indexOf(`function ${name}(`)
  assert.ok(start > 0, `源码里必须有 ${name}`)
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

/** 按表达式配对抠出 const 声明。 */
function extractConst(name) {
  const m = new RegExp(`const ${name} = `).exec(SOURCE)
  assert.ok(m, `源码里必须有 ${name}`)
  const open = { '{': '}', '[': ']', '(': ')' }
  let depth = 0
  let started = false
  const arrow = SOURCE.indexOf('=>', m.index + m[0].length)
  const from = arrow > 0 && arrow < m.index + 400 ? arrow + 2 : m.index + m[0].length
  for (let k = from; k < SOURCE.length; k++) {
    const ch = SOURCE[k]
    if (open[ch]) { depth++; started = true } else if (Object.values(open).includes(ch)) depth--
    if (started && depth === 0) {
      const end = SOURCE.indexOf('\n', k)
      return SOURCE.slice(m.index, end > 0 ? end : k + 1)
    }
    if (!started && (ch === '\n' || ch === ';')) return SOURCE.slice(m.index, k)
  }
  throw new Error(`${name} 未结束`)
}

/** 把地图相关的函数装进一个可调用的作用域。 */
function buildMap() {
  const code = [
    extractConst('MAP'),
    extractConst('MAP_TINTS'),
    extractConst('TERRAIN_KINDS'),
    extractConst('terrainKindOf'),
    extractConst('posCell'),
    extractFn('terraSites'),
    extractFn('terraLabelLayout'),
    extractFn('terrainCells'),
    extractFn('cellPath'),
    'return { MAP, MAP_TINTS, TERRAIN_KINDS, terrainKindOf, terraSites, terraLabelLayout, terrainCells, cellPath }',
  ].join('\n')
  // eslint-disable-next-line no-new-func
  return new Function(code)()
}
const M = buildMap()

/* ---- 不再伪造地形 ---- */

test('源码里不存在高程场与等高线', () => {
  // 这一整块是用程序噪声编出来的地形，和作者的设定无关。
  // 作者看着觉得「对不上」是对的。删掉之后不许再悄悄长回来。
  for (const name of ['terraLayers', 'terraContour', 'terraBump', 'terraNoise', 'terraColor']) {
    assert.ok(!SOURCE.includes(`function ${name}(`), `不该再有 ${name}`)
  }
  for (const name of ['TERRA_RAMP', 'TERRAIN_TINTS', 'tintAt']) {
    assert.ok(!SOURCE.includes(`const ${name} = `) && !SOURCE.includes(`function ${name}(`), `不该再有 ${name}`)
  }
})

test('配色是纯标记色，不再按高程渐变', () => {
  // 渐变需要一张高程面；没有高程就只能一种地形一个颜色。
  // 每条色标如果还是数组（三个色标），说明又走回老路了。
  for (const [kind, color] of Object.entries(M.MAP_TINTS)) {
    assert.equal(typeof color, 'string', `${kind} 的配色应是单一颜色，实际是 ${typeof color}`)
    assert.match(color, /^#[0-9a-f]{6}$/iu, `${kind} 的配色格式不对：${color}`)
  }
})

test('配色覆盖了全部地形种类，且都不同', () => {
  // 少一种就会让那种地形画成空心，看着像没设定
  for (const entry of M.TERRAIN_KINDS) {
    assert.ok(M.MAP_TINTS[entry.kind], `缺少 ${entry.kind}（${entry.label}）的配色`)
  }
  const colors = Object.values(M.MAP_TINTS)
  assert.equal(new Set(colors).size, colors.length, '不同地形不该共用同一个颜色')
})

test('认不出地形时不给颜色', () => {
  // 猜一个颜色会把「沙漠」涂成「森林」，那是错的信息
  assert.equal(M.MAP_TINTS.unknownKind, undefined)
  assert.equal(M.MAP_TINTS[''], undefined)
})

/* ---- 地点摆放 ---- */

test('地点按后端给的坐标摆放', () => {
  const sites = M.terraSites([
    { name: '甲', pos: '西', x: 0.16, y: 0.2 },
    { name: '乙', pos: '东', x: 0.84, y: 0.8 },
  ])
  assert.equal(sites[0].x, 0.16)
  assert.equal(sites[0].y, 0.2)
  assert.equal(sites[1].x, 0.84)
})

test('没有坐标时退回方位词，不会丢掉地点', () => {
  // 旧项目的数据里可能只有方位没有坐标，不能因此把地点弄丢
  const sites = M.terraSites([{ name: '甲', pos: '西' }])
  assert.equal(sites.length, 1)
  assert.ok(sites[0].x > 0 && sites[0].x < 1, `x=${sites[0].x} 应在画布内`)
  assert.ok(sites[0].y > 0 && sites[0].y < 1, `y=${sites[0].y} 应在画布内`)
})

test('同一方位的多个地点不会重合', () => {
  // 这就是「地图怎么都对不上」的根因：七个「西」曾拿到同一个坐标
  const sites = M.terraSites(['甲', '乙', '丙', '丁', '戊'].map((name) => ({ name, pos: '西' })))
  const points = new Set(sites.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`))
  assert.equal(points.size, sites.length, `5 个「西」的地区只得到 ${points.size} 个位置`)
})

test('地形种类优先用后端给的，前端只做兜底', () => {
  const withKind = M.terraSites([{ name: '某地', terrainKind: 'desert', x: 0.5, y: 0.5 }])
  assert.equal(withKind[0].terrainKind, 'desert')
  // 名字里能认出来时也要认
  const guessed = M.terraSites([{ name: '无声之地', terrain: '沙漠', x: 0.5, y: 0.5 }])
  assert.equal(guessed[0].terrainKind, 'desert')
})

test('同一份输入得到完全相同的摆位', () => {
  // 面板每 4 秒轮询，位置乱跳的话作者没法靠地图记住东西
  const input = [{ name: '甲', pos: '西' }, { name: '乙', pos: '东' }]
  assert.deepEqual(M.terraSites(input), M.terraSites(input))
})

/* ---- 地名标注避让 ---- */

const SIZE = 84

test('地名标签不会压住任何一个点位', () => {
  // 标杆是数据，比文字重要。「艾尔登维尔大陆」曾经正好横在白塔的圆点上
  const sites = [
    { key: '甲', label: '甲', x: 0.5, y: 0.5 },
    { key: '乙', label: '乙', x: 0.52, y: 0.5 },
  ]
  const plan = M.terraLabelLayout(sites, SIZE, SIZE)
  for (const item of plan) {
    for (const site of sites) {
      const px = site.x * SIZE
      const py = site.y * SIZE
      const w = 2.9 * Math.min(9, Math.max(2, site.label.length)) + 2
      const left = item.flip ? item.ax - w - 2.4 : item.ax + 2.4
      const inside = px > left - 1.2 && px < left + w + 1.2 && py > item.ay - 1.8 - 1.2 && py < item.ay + 1.8 + 1.2
      assert.ok(!inside, `${item.key} 的文字压住了 ${site.key} 的点位`)
    }
  }
})

test('标签不得超出画布', () => {
  // 贴边被裁掉的地名等于没有名字
  const sites = [{ key: '甲', label: '贴着右边的一个很长的地名', x: 0.97, y: 0.5 }]
  for (const item of M.terraLabelLayout(sites, SIZE, SIZE)) {
    assert.ok(item.ax > 0 && item.ax < SIZE, `ax=${item.ax} 出界`)
    assert.ok(item.ay > 0 && item.ay < SIZE, `ay=${item.ay} 出界`)
  }
})

test('放不下的标签宁可丢掉，也不硬挤', () => {
  // 挤在一起的地名比少标一个更糟：两个都读不出来
  const many = Array.from({ length: 40 }, (_, i) => ({
    key: `k${i}`, label: `很长的一个地名${i}`, x: 0.5, y: 0.5,
  }))
  const plan = M.terraLabelLayout(many, SIZE, SIZE)
  assert.ok(plan.length < many.length, '重叠到这个程度时必须有标签被放弃')
})

test('没探明的地区不标名字', () => {
  // 和地貌块同一套语义：还没写到的地方不出现
  const sites = [{ key: '甲', label: '甲', x: 0.95, y: 0.95 }]
  const plan = M.terraLabelLayout(sites, SIZE, SIZE * 0.1)
  assert.equal(plan.length, 0, '进度很低时边缘地区不该标出来')
})

/* ---- 地貌块 ---- */

test('每个地区各占一块', () => {
  const out = M.terrainCells([
    { name: '甲', x: 0.3, y: 0.3, terrainKind: 'plain' },
    { name: '乙', x: 0.7, y: 0.7, terrainKind: 'forest' },
  ], { seed: '测试' })
  const real = out.cells.filter((c) => !c.filler)
  assert.equal(real.length, 2)
})

test('同一项目每次得到同一张图', () => {
  const input = [
    { name: '甲', x: 0.3, y: 0.3, terrainKind: 'plain' },
    { name: '乙', x: 0.7, y: 0.7, terrainKind: 'forest' },
  ]
  const a = M.terrainCells(input, { seed: '同一本' })
  const b = M.terrainCells(input, { seed: '同一本' })
  assert.deepEqual(a.cells.map((c) => c.points), b.cells.map((c) => c.points))
  const c = M.terrainCells(input, { seed: '另一本' })
  assert.notDeepEqual(a.cells[0].points, c.cells[0].points, '换项目应换一张形状')
})
