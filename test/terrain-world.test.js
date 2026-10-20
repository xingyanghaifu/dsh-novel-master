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
  // 箭头函数形如 `(pos) => {`：参数那对括号会把 depth 走一遍又归零，
  // 于是在真正的函数体 `{` 出现之前就误判成结束了。所以先把 `=>` 之后的
  // 空白跳过去，从函数体本身开始数括号。
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

/** 把地形相关的函数装进一个可调用的作用域。 */
function buildTerrain() {
  const code = [
    extractConst('TERRA'),
    extractConst('TERRA_RAMP'),
    // 着色要用到地形色板和识别函数，两样都得一起装进来
    extractConst('TERRAIN_KINDS'),
    extractConst('TERRAIN_TINTS'),
    extractFn('tintAt'),
    extractConst('terrainKindOf'),
    extractFn('terraHash'),
    extractFn('terraSmooth'),
    extractFn('terraNoise'),
    extractFn('terraColor'),
    // terraSites 现在会读地区方位词（posCell），所以它也要一起装进来
    extractConst('posCell'),
    extractFn('terraSites'),
    extractFn('terraBump'),
    extractFn('terraContour'),
    extractFn('terraLayers'),
    extractFn('terraLabelLayout'),
    'return { TERRA, TERRAIN_KINDS, TERRAIN_TINTS, tintAt, terrainKindOf, terraLayers, terraSites, terraBump, terraLabelLayout }',
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

test('地区带方位词时按方位摆位，而不是按序号均匀铺', () => {
  // 「白塔在平原中央」「深渊裂谷在极北」这类句子本来就写清了相对位置。
  // 按序号铺等于把这层信息扔掉，再由哈希随机决定 —— 图是散的，读者对不上原文。
  const { terraSites } = buildTerrain()
  const sites = terraSites([
    { name: '白塔', pos: '中', desc: '建在平原中央', chars: 20 },
    { name: '深渊裂谷', pos: '北', desc: '极北的裂谷', chars: 20 },
    { name: '无声之地', pos: '西南', desc: '边境荒原', chars: 20 },
  ])
  assert.equal(sites.length, 3)
  const byName = Object.fromEntries(sites.map((s) => [s.key, s]))
  // 北 → y 靠上（画面坐标上小）；南 → y 靠下
  assert.ok(byName['深渊裂谷'].y < byName['无声之地'].y, '北边的地点应该画在上面')
  // 西 → x 靠左；东 → 靠右
  assert.ok(byName['无声之地'].x < byName['白塔'].x, '西南的地点应该在中央的左边')
  // 居中那位应落在画布中部
  assert.ok(Math.abs(byName['白塔'].x - 0.5) < 0.2, '方位为「中」应落在中部')
  assert.ok(Math.abs(byName['白塔'].y - 0.5) < 0.2)
})

test('同一方位格里的多个地点会错开，不会完全重合', () => {
  const { terraSites } = buildTerrain()
  const sites = terraSites([
    { name: '甲村', pos: '北', desc: 'x', chars: 10 },
    { name: '乙村', pos: '北', desc: 'x', chars: 10 },
    { name: '丙村', pos: '北', desc: 'x', chars: 10 },
  ])
  assert.equal(sites.length, 3)
  let minDistance = Infinity
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      minDistance = Math.min(minDistance, Math.hypot(sites[i].x - sites[j].x, sites[i].y - sites[j].y))
    }
  }
  assert.ok(minDistance > 0.02, `同格地点相距 ${minDistance.toFixed(3)}，会叠成一个点`)
})

test('地区地形有保底高度，说明写得短也看得见', () => {
  // 地区都写出来了却因为说明太短而完全看不见，会让人以为地名丢了
  const { terraSites } = buildTerrain()
  const short = terraSites([{ name: '某地', pos: '东', desc: '短', chars: 0 }])[0]
  assert.ok(short.height > 0.2, `地区保底高度不足：${short.height}`)
})

test('没有方位词时退回按序号均匀铺开', () => {
  const { terraSites } = buildTerrain()
  const sites = terraSites([
    { name: '甲', desc: 'x', chars: 100 },
    { name: '乙', desc: 'x', chars: 100 },
    { name: '丙', desc: 'x', chars: 100 },
    { name: '丁', desc: 'x', chars: 100 },
  ])
  // 四个纬度相近的点应在画面上分散开，而不是挤在同一侧
  const xs = sites.map((s) => s.x)
  const ys = sites.map((s) => s.y)
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.3, 'x 方向应拉得开')
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.3, 'y 方向应拉得开')
})

test('地名标签不许压住任何一个标杆', () => {
  // 文字盖住标杆，那个地点就等于从图上消失了。标杆是数据，必须优先。
  // 用《末影之龙》的真实布局复现：中央的大陆名会横着扫向右侧的白塔。
  const { terraLayers, terraSites, terraLabelLayout, TERRA } = buildTerrain()
  const regions = [
    { name: '艾尔登维尔大陆', desc: '主舞台，四族共存', pos: '中' },
    { name: '边境村·石锤镇', desc: '故事起点', pos: '西南' },
    { name: '白塔', desc: '光辉圣教总部，建在源质最浓的平原中央', pos: '东' },
    { name: '无声之地', desc: '源质稀薄的边境荒原', pos: '西' },
    { name: '深渊裂谷', desc: '绝对无源质', pos: '北' },
  ].map((r) => ({ ...r, chars: r.desc.length }))

  TERRA.cache = null
  TERRA.seed = ''
  terraLayers(regions)
  const sites = terraSites(regions)
  const size = TERRA.size
  const plan = terraLabelLayout(sites.map((s) => ({ ...s, label: s.key })), size, size)

  const pins = sites.map((s) => ({ x: s.x * size, y: s.y * size, name: s.key }))
  for (const item of plan) {
    // 估算文字框（与 terraLabelLayout 内部一致）
    const w = 2.9 * Math.min(9, Math.max(2, item.label.length)) + 2
    const left = item.flip ? item.ax - w - 2.4 : item.ax + 2.4
    const box = { x1: left, y1: item.ay - 1.8, x2: left + w, y2: item.ay + 1.8 }
    for (const pin of pins) {
      // 自己的标杆允许被自己的引线连接，但文字不能盖住任何标杆
      if (pin.name === item.label) continue
      const over = pin.x > box.x1 && pin.x < box.x2 && pin.y > box.y1 && pin.y < box.y2
      assert.ok(!over, `「${item.label}」的文字压住了「${pin.name}」的标杆`)
    }
  }
})

test('避让后仍然放不下的标签宁可丢掉，也不硬挤', () => {
  // 全部堆在同一个点：能放几个放几个，但留下来的彼此绝不重叠。
  // 之前断言「必须丢掉一部分」太武断 —— 8 个短名字在 84 的画布上
  // 恰好排得开。真正要保证的是「不重叠」，不是「必须少」。
  const { terraLabelLayout } = buildTerrain()
  const sites = Array.from({ length: 8 }, (_, i) => ({
    key: `地点${i}`, label: `地点${i}`, x: 0.5, y: 0.5,
  }))
  const plan = terraLabelLayout(sites, 84, 84)
  assert.ok(plan.length >= 1, '至少要有能放下的那个')
  // 保留下来的彼此不能重叠
  for (let i = 0; i < plan.length; i++) {
    for (let j = i + 1; j < plan.length; j++) {
      const a = plan[i]; const b = plan[j]
      const aw = 2.9 * Math.min(9, Math.max(2, a.label.length)) + 2
      const bw = 2.9 * Math.min(9, Math.max(2, b.label.length)) + 2
      const al = a.flip ? a.ax - aw - 2.4 : a.ax + 2.4
      const bl = b.flip ? b.ax - bw - 2.4 : b.ax + 2.4
      const overlap = al < bl + bw && al + aw > bl
        && Math.abs(a.ay - b.ay) < 3.6
      assert.ok(!overlap, `「${a.label}」与「${b.label}」仍然重叠`)
    }
  }
})

test('挤不下的时候确实会放弃，而不是全画出来', () => {
  // 用超长名字把画布塞满，逼出「放弃」这条分支
  const { terraLabelLayout } = buildTerrain()
  const sites = Array.from({ length: 20 }, (_, i) => ({
    key: `非常非常长的地点名称${i}`, label: `非常非常长的地点名称${i}`, x: 0.5, y: 0.5,
  }))
  const plan = terraLabelLayout(sites, 84, 84)
  assert.ok(plan.length < sites.length, `20 个超长名字不可能全放下，实际放了 ${plan.length} 个`)
})

test('地形配色覆盖了全部地形种类', () => {
  const { TERRAIN_KINDS, TERRAIN_TINTS } = buildTerrain()
  for (const entry of TERRAIN_KINDS) {
    assert.ok(TERRAIN_TINTS[entry.kind], `缺「${entry.label}」的配色`)
    assert.equal(TERRAIN_TINTS[entry.kind].length, 3, `「${entry.label}」应有低/中/高三个色标`)
  }
})

test('同一种地形，高处比低处亮', () => {
  const { TERRAIN_TINTS, tintAt } = buildTerrain()
  const luma = (c) => {
    const m = /(\d+)\D+(\d+)\D+(\d+)/u.exec(c)
    return Number(m[1]) * 0.3 + Number(m[2]) * 0.59 + Number(m[3]) * 0.11
  }
  for (const [kind, stops] of Object.entries(TERRAIN_TINTS)) {
    assert.ok(luma(tintAt(stops, 0.9)) > luma(tintAt(stops, 0.1)), `「${kind}」高处应更亮`)
  }
})

test('地形着色不会出现硬边界', () => {
  // 判据不能只看「最大相邻色差」。沙漠的暗赭和雪原的近白本来就差得远，
  // 两者相邻时出现一次大落差是正常的。硬边界的特征不是「差得大」，而是
  // 「成片地差」—— 沿一条线连续跳变，那才是色块拼出来的方格边。
  //
  // 所以这里看比例：绝大多数相邻格应当平滑过渡，大跳变只能零星出现。
  const { TERRA, terraLayers, terraSites } = buildTerrain()
  const items = [
    { name: '无声之地', pos: '西', terrain: '沙漠', desc: '一片黄沙' },
    { name: '背面', pos: '东北', terrain: '雪原', desc: '终年冰封' },
    { name: '艾尔登维尔', pos: '中', terrain: '原野', desc: '主舞台' },
  ]
  terraSites(items)
  terraLayers(items)
  const n = TERRA.size
  const tints = TERRA.tints
  assert.ok(tints, '应产出着色网格')
  const delta = (a, b) => Math.abs(tints[a] - tints[b])
    + Math.abs(tints[a + 1] - tints[b + 1])
    + Math.abs(tints[a + 2] - tints[b + 2])
  let edges = 0
  let sharp = 0
  let chain = 0
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n - 1; x++) {
      const a = (y * n + x) * 4
      const b = a + 4
      const d = delta(a, b)
      edges++
      if (d > 60) sharp++
      // 连续两条边都很大 = 沿一条线成片跳变，硬边界的特征
      if (x < n - 2 && d > 60 && delta(b, b + 4) > 60) chain++
    }
  }
  const ratio = sharp / edges
  assert.ok(ratio < 0.01, `大跳变占 ${(ratio * 100).toFixed(2)}%，超过 1% 就是色块硬边界`)
  assert.equal(chain, 0, `有 ${chain} 处连续跳变，说明是硬边界而不是自然过渡`)
})

test('认不出地形的地区不硬涂颜色', () => {
  const { terrainKindOf } = buildTerrain()
  assert.equal(terrainKindOf({ name: '某地', desc: '一个地方' }), undefined)
  assert.equal(terrainKindOf({ name: '雪原哨站', desc: '' }), 'snow')
})
