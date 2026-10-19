import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

/**
 * 地形必须由「世界布局」决定，而不是纯噪声。
 *
 * 这一组测试盯的是 client.js 里地形生成的那几个纯函数。它们在插件工厂里，
 * 没有单独导出，所以只能按源码断言 + 用 vm 跑真实实现。
 *
 * 背景：地形原来完全由噪声生成，换个项目山形一样、写没写世界观也一样。
 * 改成让每项设定资产在地图上占一个山头、字数决定高度之后，就有了「山在
 * 哪里 = 哪部分设定写得厚」这层含义。下面每条都对应一个踩过的坑。
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
  for (let k = m.index + m[0].length; k < SOURCE.length; k++) {
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

/** 把地形相关的函数装进一个可调用的作用域。 */
function buildTerrain() {
  const code = [
    extractConst('TERRA'),
    extractConst('TERRA_RAMP'),
    extractFn('terraHash'),
    extractFn('terraSmooth'),
    extractFn('terraNoise'),
    extractFn('terraColor'),
    extractFn('terraSites'),
    extractFn('terraBump'),
    extractFn('terraContour'),
    extractFn('terraLayers'),
    'return { TERRA, terraLayers, terraSites, terraBump }',
  ].join('\n')
  // eslint-disable-next-line no-new-func
  return new Function(code)()
}

test('地形计算接受资产列表并按资产造山', () => {
  const { terraSites } = buildTerrain()
  const items = [
    { name: '设定.md', done: true, chars: 5000 },
    { name: '角色.md', done: true, chars: 4000 },
    { name: '大纲.md', done: true, chars: 3000 },
  ]
  const sites = terraSites(items)
  assert.equal(sites.length, 3, '每项资产对应一个山头')
  for (const site of sites) {
    assert.ok(site.x > 0 && site.x < 1, 'x 必须落在地图内')
    assert.ok(site.y > 0 && site.y < 1, 'y 必须落在地图内')
    assert.ok(site.height > 0, '山头必须有高度')
  }
})

test('资产写得越厚，山头越高', () => {
  const { terraSites } = buildTerrain()
  const thin = terraSites([{ name: '设定.md', done: true, chars: 10 }])[0]
  const thick = terraSites([{ name: '设定.md', done: true, chars: 8000 }])[0]
  assert.ok(thick.height > thin.height, `厚设定(${thick.height}) 应高于薄设定(${thin.height})`)
  // done 但没有字数，应该介于两者之间
  const bare = terraSites([{ name: '设定.md', done: true, chars: 0 }])[0]
  assert.ok(bare.height > thin.height - 0.001, '已完成的资产不能比刚起草的更矮')
})

test('山头位置按序号均匀铺开，不会挤成一团', () => {
  // 曾经用名字哈希直接定位，几个资产的坐标几乎重合，隆起叠成一大片
  // 平坦高地，等高线绕着平台边缘走，正中裂出一个大洞。
  const { terraSites } = buildTerrain()
  const items = ['设定.md', '角色.md', '大纲.md', '世界状态.md', '伏笔.md', '剧情树.md']
    .map((name) => ({ name, done: true, chars: 1000 }))
  const sites = terraSites(items)
  assert.equal(sites.length, 6)
  // 两两之间的最小距离不能太小
  let minDistance = Infinity
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const d = Math.hypot(sites[i].x - sites[j].x, sites[i].y - sites[j].y)
      if (d < minDistance) minDistance = d
    }
  }
  assert.ok(minDistance > 0.15, `最近两个山头相距 ${minDistance.toFixed(3)}，太近了会连成平台`)
})

test('同一份资产重复计算得到完全相同的地形', () => {
  // 面板每 4 秒轮询一次。地形若非确定，整张图每次刷新都会重排。
  const { terraLayers, TERRA } = buildTerrain()
  const items = [
    { name: '设定.md', done: true, chars: 5000 },
    { name: '角色.md', done: false, chars: 0 },
  ]
  TERRA.cache = null
  TERRA.seed = ''
  const first = terraLayers(items).map((layer) => layer.d).join('|')
  TERRA.cache = null
  TERRA.seed = ''
  const second = terraLayers(items).map((layer) => layer.d).join('|')
  assert.equal(first, second, '同输入必须同输出')
})

test('不同资产产生不同地形', () => {
  const { terraLayers, TERRA } = buildTerrain()
  const fingerprints = []
  for (const items of [
    [],
    [{ name: '设定.md', done: true, chars: 20 }],
    [
      { name: '设定.md', done: true, chars: 5000 },
      { name: '角色.md', done: true, chars: 4000 },
    ],
  ]) {
    TERRA.cache = null
    TERRA.seed = ''
    const layers = terraLayers(items)
    fingerprints.push(layers.map((l) => `${l.frac.toFixed(2)}:${l.d.length}`).join(','))
  }
  assert.equal(new Set(fingerprints).size, 3, '三种资产状态必须画出三种地形')
})

test('缓存把资产计入键，写完一章回来地形会更新', () => {
  // 只按「有没有缓存」判断的话，资产变了还返回旧地形。
  const { terraLayers, TERRA } = buildTerrain()
  const before = [{ name: '设定.md', done: true, chars: 100 }]
  const after = [{ name: '设定.md', done: true, chars: 9000 }]
  TERRA.cache = null
  TERRA.seed = ''
  const a = terraLayers(before).map((l) => l.d.length).join(',')
  const b = terraLayers(after).map((l) => l.d.length).join(',')
  assert.notEqual(a, b, '字数变化后必须重算，不能吃旧缓存')
  // 同输入应命中缓存
  const again = terraLayers(after).map((l) => l.d.length).join(',')
  assert.equal(b, again, '同输入应命中缓存')
})

test('高程不得出现平台，否则等高线中间会空掉', () => {
  // 曾经用 Math.min(1, ...) 截断，几个山头一起顶到 1.0，中间成为
  // 高程相同的平地，顶层等值线全挤到边缘，正中裂出巨大空洞。
  // 现在改为不截断、最后整场归一。
  assert.doesNotMatch(SOURCE, /h = Math\.min\(1, h \+ lift/, '不能再用硬截断')
  assert.match(SOURCE, /if \(peak > 1\)/, '必须有整场归一化')
  assert.match(SOURCE, /field\[i\] \*= scale/, '归一化要真的缩放高程场')
})

test('地形缓存命中时几乎不花时间', () => {
  const { terraLayers, TERRA } = buildTerrain()
  const items = [{ name: '设定.md', done: true, chars: 3000 }]
  TERRA.cache = null
  TERRA.seed = ''
  terraLayers(items)
  const started = process.hrtime.bigint()
  for (let i = 0; i < 200; i++) terraLayers(items)
  const ms = Number(process.hrtime.bigint() - started) / 1e6 / 200
  assert.ok(ms < 0.5, `缓存命中应接近零成本，实测 ${ms.toFixed(3)}ms`)
})
