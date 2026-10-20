/**
 * 地形块（Voronoi 单元）。
 *
 * 早先的地图是等高线 + 渐变底色：连续、平滑，但读起来像一张气象图，
 * 而不是一张地图。真实的地图集都是「一块一块拼起来」的 —— 每块地有
 * 自己的边界、自己的颜色、自己的一条等高线，块与块之间有硬边。
 *
 * 这里把整张图切成 Voronoi 单元：每个种子点（地区、或者填补空白的
 * 辅助点）占一块地，边界是相邻种子的垂直平分线。这就是 Azgaar、
 * Watabou 那类地图生成器的基础做法 —— 它们在此之上再做侵蚀、河流、
 * 生物群系，但骨架都是这一步。
 *
 * 为什么是 Voronoi 而不是网格瓦片：世界里的地点不是均匀分布的，
 * 网格会强行把「白塔」切成几块，而 Voronoi 每一块都属于某个地点，
 * 边界落在两个地点的正中间 —— 这恰好是「势力范围」的直觉形状。
 *
 * 纯函数，不碰 DOM。前后端各跑一次，得到的坐标必须完全一致，
 * 所以里面不能出现随机数、时间、或者浮点顺序依赖。
 */

/** 一个可复现的哈希，把字符串变成 0–1 的浮点。 */
function hash01(text, salt) {
  let acc = 2166136261 ^ (salt | 0)
  for (let i = 0; i < text.length; i++) {
    acc ^= text.charCodeAt(i)
    acc = Math.imul(acc, 16777619) >>> 0
  }
  return (acc >>> 8) / 16777216
}

/**
 * 生成地图的三层单元。
 *
 * 第一层是「地区块」：每个真实地点一块，颜色和形状都由它决定。
 * 只有真实地点的图会很空 —— 六个地名切一块大陆，剩下的地方没有归属。
 * 所以第二层是「填充块」：在空白处撒一批辅助种子，让整张图都有内容，
 * 但它们的颜色和真实地点不同（更暗、更灰），读起来是「未命名的地带」。
 *
 * @param {{name:string,x:number,y:number,terrainKind?:string,height?:number}[]} sites
 * @param {{width?:number,height?:number,filler?:number,seed?:string}} [options]
 * @returns {{cells:{key:string,x:number,y:number,points:[number,number][],terrainKind?:string,height:number,filler:boolean}[], width:number, height:number}}
 */
export function terrainCells(sites, options = {}) {
  const width = Number(options.width) > 0 ? Number(options.width) : 84
  const height = Number(options.height) > 0 ? Number(options.height) : 84
  const seed = String(options.seed ?? 'nm')
  // 填充密度：每个真实地点配几个空块。太少整张图还是空的，
  // 太多真实地点就被挤成小碎块。8 是量出来的平衡点：6 个地区时
  // 真实块平均面积还有 90（画布 7056），名字放得下，四周也填满了。
  // 这个默认值必须和 client.js 里那份一致，否则前后端画出来的是两张图。
  const perSite = Number(options.filler) >= 0 ? Number(options.filler) : 8

  const seeds = []
  const list = Array.isArray(sites) ? sites : []
  for (const site of list) {
    const x = Number(site?.x)
    const y = Number(site?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    seeds.push({
      key: String(site.name ?? site.key ?? `s${seeds.length}`),
      x: Math.min(width, Math.max(0, x * width)),
      y: Math.min(height, Math.max(0, y * height)),
      terrainKind: site.terrainKind,
      height: Number(site.height) || 0.3,
      filler: false,
    })
  }

  // 填充种子均匀撒在格子上，再按哈希抖一下 —— 严格等距会让所有块
  // 长得一样大，看着像蜂窝板；抖一抖才像自然分割出来的地盘。
  //
  // 填充块的「地形」不是空的，而是抄最近那个真实地点的。早先版本让
  // 填充块保持深灰，结果整张图一大半是黑的，看着像地图没加载完。
  // 真实地图里每一块地都有归属：远离城镇的荒野也是「荒野」，不是「未知」。
  // 所以每个填充块按就近原则继承地形，只有颜色略暗一点表示「没名字」。
  const count = list.length * perSite
  if (count > 0) {
    const cols = Math.ceil(Math.sqrt(count * (width / height)))
    const rows = Math.ceil(count / cols)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const corner = (r + c) % 2 === 0
        const jx = (hash01(`${seed}:${r}:${c}:x`, r * 7919 + c) - 0.5) * 1.6
        const jy = (hash01(`${seed}:${r}:${c}:y`, r * 104729 + c) - 0.5) * 1.6
        const x = ((c + 0.5 + (corner ? 0.18 : -0.18) + jx * 0.5) / cols) * width
        const y = ((r + 0.5 + jy * 0.5) / rows) * height
        const seedX = Math.min(width - 0.01, Math.max(0.01, x))
        const seedY = Math.min(height - 0.01, Math.max(0.01, y))
        seeds.push({
          key: `~${r}.${c}`,
          x: seedX,
          y: seedY,
          terrainKind: nearestKind(seedX, seedY, seeds),
          height: 0.12 + hash01(`${seed}:${r}:${c}:h`, 31) * 0.2,
          filler: true,
        })
      }
    }
  }

  return {
    cells: seeds.map((s) => clipToBox(seedCell(s, seeds, width, height), width, height)),
    width,
    height,
  }
}

/**
 * 离这个坐标最近的真实地点是哪种地形。
 *
 * 填充块用它继承地形。没有真实地点时返回 undefined，调用方落回中性色。
 */
function nearestKind(x, y, seeds) {
  let best
  let bestD = Infinity
  for (const s of seeds) {
    if (s.filler) continue
    const d = (s.x - x) ** 2 + (s.y - y) ** 2
    if (d < bestD) { bestD = d; best = s }
  }
  return best?.terrainKind
}

/**
 * 一个种子的 Voronoi 单元：与其它每个种子的垂直平分线切出的半平面求交。
 *
 * 直接从「到本种子比到别人近」出发，用半平面逐个裁剪多边形。
 * 种子少的时候（几十个）这是最直观也最稳的写法，不会出现 Delaunay
 * 三角剖分那种退化共线问题。
 */
function seedCell(seed, seeds, width, height) {
  let polygon = [
    [0, 0], [width, 0], [width, height], [0, height],
  ]
  for (const other of seeds) {
    if (other === seed) continue
    // 垂直平分线：满足 |p-a|² < |p-b|² 的半平面
    // 展开后就是 2(b-a)·p < |b|²-|a|²
    const dx = other.x - seed.x
    const dy = other.y - seed.y
    const d2 = dx * dx + dy * dy
    if (d2 < 1e-9) continue
    const c = (other.x * other.x + other.y * other.y - seed.x * seed.x - seed.y * seed.y) / 2
    polygon = clipHalfPlane(polygon, dx, dy, c)
    if (polygon.length < 3) break
  }
  return {
    key: seed.key,
    x: seed.x,
    y: seed.y,
    points: polygon,
    terrainKind: seed.terrainKind,
    height: seed.height,
    filler: seed.filler,
  }
}

/**
 * 用半平面 dx·p.x + dy·p.y <= c 裁剪凸多边形。
 * Sutherland–Hodgman，凸对凸裁剪后仍是凸的，所以可以反复裁。
 */
function clipHalfPlane(points, dx, dy, c) {
  const out = []
  const inside = (p) => dx * p[0] + dy * p[1] <= c + 1e-9
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const ina = inside(a)
    const inb = inside(b)
    if (ina) out.push(a)
    if (ina !== inb) {
      // 线段与平分线的交点
      const fa = dx * a[0] + dy * a[1] - c
      const fb = dx * b[0] + dy * b[1] - c
      const t = fa / (fa - fb)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  // 去掉重复点，否则 SVG path 里会出现零长度边，某些渲染器会画毛刺
  return out.filter((p, i) => {
    const q = out[(i + out.length - 1) % out.length]
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6
  })
}

/** 暴力裁剪出边界框内的部分。上面已经保证在框内，这里只兜底。 */
function clipToBox(cell, width, height) {
  cell.points = cell.points.map((p) => [
    Math.min(width, Math.max(0, p[0])),
    Math.min(height, Math.max(0, p[1])),
  ])
  return cell
}

/** 单元转成 SVG path 的 d 串。 */
export function cellPath(cell) {
  const points = cell?.points ?? []
  if (points.length < 3) return ''
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
  return `${d}Z`
}
