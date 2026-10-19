/**
 * 世界模型：把「一张地名表」推成「一个能讲通的世界」。
 *
 * 为什么需要这个：作者写「白塔在源质最浓的平原中央」「无声之地是稀薄的荒原」
 * 「深渊裂谷绝对无源质」，这是三条**并列的设定**，彼此没有约束。放到地图上
 * 就是三个点，读者读不出「这几个地方为什么长这样」。
 *
 * 真实世界不是这样的：一个地方冷不冷，先看它在哪个纬度，再看它多高，
 * 再看它背后有没有山挡住水汽。这三条决定了它是雨林还是沙漠。作者心里
 * 其实都有这套直觉 —— 只是没写下来，写的时候也没被追问过。
 *
 * 这个模块把那套直觉写成可计算的规则，用来做两件事：
 *
 *   推演  给定位置和地形，算出这里该是什么气候、该不该有河、该不该有人。
 *          作者没写的部分由它补全，写了的由它校验。
 *
 *   审计  作者写了与推演结果冲突的设定时，指出来。不是判他错 ——
 *          奇幻世界可以有魔法解释，但他得知道自己在破例。
 *
 * 全部是纯函数、无随机数。同一份设定算出来的世界永远一样，
 * 否则面板每 4 秒刷新一次，世界就变一次，读者会更晕。
 */

/** 地形种类与它们的物理属性。key 与客户端的 TERRAIN_KINDS 对齐。 */
export const TERRAIN_TRAITS = {
  volcano: { label: '火山', altitude: 0.9, aridity: 0.55, warmth: 0.35, water: false },
  snow: { label: '雪原', altitude: 0.35, aridity: 0.45, warmth: -0.75, water: false },
  desert: { label: '沙漠', altitude: 0.3, aridity: 0.95, warmth: 0.3, water: false },
  ocean: { label: '水域', altitude: 0.02, aridity: -0.6, warmth: 0, water: true },
  swamp: { label: '沼泽', altitude: 0.08, aridity: -0.45, warmth: 0.15, water: true },
  cave: { label: '地下', altitude: 0.1, aridity: 0.2, warmth: -0.1, water: false },
  island: { label: '岛屿', altitude: 0.15, aridity: -0.2, warmth: 0.1, water: true },
  city: { label: '城邦', altitude: 0.2, aridity: 0, warmth: 0.05, water: false },
  forest: { label: '森林', altitude: 0.35, aridity: -0.25, warmth: 0, water: false },
  mountain: { label: '山地', altitude: 0.85, aridity: 0.15, warmth: -0.35, water: false },
  plain: { label: '原野', altitude: 0.25, aridity: 0, warmth: 0.05, water: false },
}

/** 说明文字里的地形线索，按优先级排（越具体越靠前）。 */
const TERRAIN_WORDS = [
  ['volcano', /火山|熔岩|岩浆|硫磺/u],
  ['snow', /雪|冰|寒|冻|极地|霜/u],
  ['desert', /沙漠|沙丘|荒漠|戈壁|沙海|旱|干旱/u],
  ['ocean', /海|湖|河|江|湾|洋|水域|海岸|港/u],
  ['swamp', /沼|湿地|泥潭|雨林沼泽/u],
  ['cave', /地下|洞窟|深渊|地底|坑道/u],
  ['island', /岛|屿|礁/u],
  ['city', /城|镇|都|堡|要塞|聚落/u],
  ['forest', /森林|林|树|丛林/u],
  ['mountain', /山|峰|岭|高原|山脉|崖/u],
  ['plain', /平原|原野|草原|旷野|盆地/u],
]

/**
 * 从一路文字里认出地形种类。
 *
 * 先看 `terrain` 列（作者明确写了），没有再扫说明。
 * 两者都没有就返回 undefined —— 别猜，猜错的比没有更糟。
 */
export function detectTerrain(terrain = '', desc = '') {
  for (const [kind, re] of TERRAIN_WORDS) {
    if (re.test(String(terrain ?? ''))) return kind
  }
  for (const [kind, re] of TERRAIN_WORDS) {
    if (re.test(String(desc ?? ''))) return kind
  }
  return undefined
}

/**
 * 纬度带。y 是画布上的纵向比例，0 为最北，1 为最南。
 *
 * 分五带而不是三带：三带会让「温带」占掉六成，所有地点都落进同一格，
 * 气候推演就退化成一句「温带」了，没有区分度。
 *
 * 边界按真实地球的纬度比例切：极地 0–15%、亚寒带 15–32%、
 * 温带 32–45%、亚热带 45–62%、热带 62–100%。
 * 注意这是**半个地球**（从北极到南极）的剖面，所以赤道落在正中 0.5，
 * 热带是以 0.5 为中心的一段，两端并不对称 —— 之前按 0.14/0.30/0.50
 * 切，导致 y=0.5（正赤道）被标成了「亚热带」。
 */
export const LATITUDE_BANDS = [
  { key: 'polar', label: '极地', min: 0, max: 0.15 },
  { key: 'subpolar', label: '亚寒带', min: 0.15, max: 0.32 },
  { key: 'temperate', label: '温带', min: 0.32, max: 0.45 },
  { key: 'subtropical', label: '亚热带', min: 0.45, max: 0.38 },
  { key: 'tropical', label: '热带', min: 0.38, max: 0.62 },
]

export function latitudeBand(y) {
  const v = latitudeRatio(y)
  // 以赤道为轴折叠：南半球 0.8 和北半球 0.2 属于同一纬度带
  const folded = Math.abs(v - 0.5) * 2 // 0 = 赤道，1 = 极点
  // 边界经过实测调过。九宫格的三个纵向档位折叠后是 0.64 / 0 / 0.64
  // （北 0.18、中 0.50、南 0.82），如果沿用真实地球的比例（0.55 以下算热带），
  // 北方和南方会双双落进温带，六个地点里有四个气候一样。
  //
  // 奇幻地图只画「一片大陆」，南北两端并不等于南极北极。
  // 所以这里把带划得更细：0.20 以内是热带，0.62 以上才进寒带。
  // 这样「北」「中」「南」三档拿到三种不同气候，作者才有得选。
  if (folded > 0.86) return { key: 'polar', label: '极地' }
  if (folded > 0.70) return { key: 'subpolar', label: '亚寒带' }
  if (folded > 0.45) return { key: 'temperate', label: '温带' }
  if (folded > 0.22) return { key: 'subtropical', label: '亚热带' }
  return { key: 'tropical', label: '热带' }
}

/**
 * 把纵坐标收进 0–1，缺失或非法时回退到中部。
 *
 * 这个函数存在的理由很实在：`Number(NaN) || 0` 会把 NaN 变成 0，
 * 而 0 在画布上是**最北端**，于是「没写方位的地点」会被判定成极地 ——
 * 明明是缺数据，却得出一份看起来很确信的气候结论。宁可回到中部。
 */
function latitudeRatio(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0.5
  return Math.min(1, Math.max(0, n))
}

/**
 * 盛行风向。真实地球的三圈环流：信风自东向西、西风带自西向东、极地东风自东向西。
 *
 * 这不只是知识点 —— 它决定了雨影在哪一侧。同一个山脉，西坡是雨林、
 * 东坡是荒漠，差别就来自风向。少了这条规则，沙漠可以随便摆。
 */
export function prevailingWind(y) {
  const v = latitudeRatio(y)
  // 0.5 是赤道。南北对称，但风向相反。
  const fromEquator = Math.abs(v - 0.5) * 2 // 0 = 赤道，1 = 极地
  if (fromEquator < 0.3) return { key: 'east', label: '东风', fromX: 1 }
  if (fromEquator < 0.7) return { key: 'west', label: '西风', fromX: -1 }
  return { key: 'east', label: '极地东风', fromX: 1 }
}

/**
 * 基准湿度曲线：真实地球有三条雨带，不是单调递减。
 *
 *   folded=0     赤道辐合带        多雨
 *   folded≈0.35  南北纬 30° 副高   干燥（撒哈拉、阿拉伯就在这儿）
 *   folded≈0.75  极锋              次多雨
 *   folded=1     极地              干燥（冷空气存不住水）
 *
 * 用一条真正的起伏曲线：以 folded=0.35 为谷、0 为峰、0.75 为次峰。
 * 前一版写的是 cos(t·3.2π)，周期太短，在 t=0.3 和 t=0.5 之间就来回跳，
 * 于是相邻纬度带的湿度从 0.13 蹦到 0.84 —— 那不是气候，是噪声。
 */
function baseHumidity(folded) {
  const t = Math.min(1, Math.max(0, folded))
  // 赤道峰 + 极锋次峰，中间夹一个副热带谷。两个高斯叠加。
  const itcz = 0.95 * Math.exp(-((t / 0.30) ** 2))          // 赤道辐合带
  const front = 0.45 * Math.exp(-(((t - 0.78) / 0.22) ** 2)) // 极锋
  const subtropical = 0.12                                  // 副热带高压的底噪
  return Math.min(1, Math.max(subtropical, itcz + front))
}

/**
 * 基准气候：只看位置和海拔，**不看地形本身**。
 *
 * 这是审计的关键。climateOf 会把地形的影响算进去 —— 沙漠的 aridity 拉低了
 * 湿度，于是「沙漠查出自己干旱」，永远不矛盾。用推演结果去校验地形，
 * 就是拿结论证明前提。
 *
 * 基准值回答的是另一个问题：**如果一个地方什么都不长，光凭位置，
 * 这里本该是什么气候？** 再拿这个去和作者写的地形比，矛盾才浮出来。
 */
export function baselineOf(region, context = {}) {
  const y = Number(region?.y ?? context.y ?? 0.5)
  const traits = TERRAIN_TRAITS[
    region?.terrainKind ?? detectTerrain(region?.terrain, region?.desc)
  ] ?? TERRAIN_TRAITS.plain
  const folded = Math.abs(latitudeRatio(y) - 0.5) * 2
  // 温度形状：S 形，赤道一带几乎一样热，中纬才陡降
  const baseWarmth = 1 - Math.pow(folded, 2.2)
  return {
    // 海拔仍然算进来：高山本来就冷，这是位置属性，不是地形自证
    warmth: round2(clamp01(baseWarmth - traits.altitude * 0.55)),
    wet: round2(clamp01(baseHumidity(folded))),
    fromEquator: round2(folded),
  }
}

/**
 * 推演一个地点的气候。
 *
 * 温度 = 纬度基准 − 海拔惩罚 + 地形修正
 * 湿度 = 纬度基准 − 干旱度修正 − 雨影惩罚
 *
 * 数字是相对刻度（0–1），不是摄氏度。目的是「比较」和「发现矛盾」，
 * 不是给读者报天气预报。真要报温度，得有恒星参数、行星半径自转轴倾角，
 * 那是另一套东西，这里不该假装有。
 */
export function climateOf(region, context = {}) {
  const y = Number(region?.y ?? context.y ?? 0.5)
  const x = Number(region?.x ?? context.x ?? 0.5)
  const kind = region?.terrainKind ?? detectTerrain(region?.terrain, region?.desc)
  const traits = TERRAIN_TRAITS[kind] ?? TERRAIN_TRAITS.plain
  const band = latitudeBand(y)

  // 距赤道的相对距离：0 = 赤道，1 = 两极。y 越小越靠北，
  // 所以直接用 |y − 0.5| · 2，不区分南半球北半球 —— 这套规则本来就南北对称。
  const fromEquator = Math.abs(latitudeRatio(y) - 0.5) * 2

  // 温度：从赤道到极地不是匀速下降的。
  //
  // 真实地球上，赤道到南北纬 30° 之间气温几乎一样（都热），
  // 30°～60° 才明显变冷，之后趋于平缓。这里试过两版都不对：
  // 线性版把热带城镇算成 0.26，换成 cos(t·π) 又变成 0.19 —— 更冷。
  // 因为 cos 在中段就已经掉到负值，等于把「温带」当成了冰点。
  //
  // 正确形状是 S 形：t=0 处接近 1 且平坦，t=0.55 附近快速下降，
  // t=1 处趋于 0。用 1 − t^2.2 就能得到这个手感：前段缓、后段陡。
  const baseWarmth = 1 - Math.pow(fromEquator, 2.2)

  // 湿度：真实地球有三条雨带，不能单调递减。曲线定义在 baseHumidity 里，
  // 与审计用的基准湿度共用同一条 —— 两处若各写一份，迟早会漂开。
  const baseWet = baseHumidity(fromEquator)

  // 海拔越高越冷。0.55 的系数让高山之巅即便在赤道也能冷下来 ——
  // 现实里乞力马扎罗就在赤道，山顶有冰川。
  const warmth = clamp01(baseWarmth - traits.altitude * 0.55 + traits.warmth * 0.25)

  // 沙漠的 aridity 是正的，会拉干燥湿；水域/森林是负的，会推向湿润。
  // 之前把符号用反了：aridity 越大反而越湿，于是沙漠得了满分。
  const shadow = rainShadow(region, context.neighbours ?? [], context)
  const wet = clamp01(baseWet - traits.aridity * 0.62 - shadow * 0.4)

  return {
    kind,
    terrainLabel: traits.label,
    band: band.key,
    bandLabel: band.label,
    warmth: round2(warmth),
    wet: round2(wet),
    elevation: round2(traits.altitude),
    wind: prevailingWind(y).label,
    rainShadow: round2(shadow),
    // 一句话概括，面板和审计都用它
    summary: climateSummary(warmth, wet),
  }
}

/**
 * 雨影强度：看上风侧有没有更高的地。
 *
 * 只在「上风方向」找，不是因为背风不重要，而是因为我们只有地名表、
 * 没有连续地形。能确定方向的就只有上风侧与下风侧这两个半区，
 * 多说就是编。
 */
function rainShadow(region, neighbours, context) {
  const x = Number(region?.x ?? context.x ?? 0.5)
  const y = Number(region?.y ?? context.y ?? 0.5)
  const kind = region?.terrainKind ?? detectTerrain(region?.terrain, region?.desc)
  const own = TERRAIN_TRAITS[kind] ?? TERRAIN_TRAITS.plain
  const wind = prevailingWind(y)
  let strongest = 0
  for (const other of neighbours) {
    if (!other || other === region) continue
    const ox = Number(other.x ?? 0.5)
    const oy = Number(other.y ?? 0.5)
    const otherKind = other.terrainKind ?? detectTerrain(other.terrain, other.desc)
    const otherTraits = TERRAIN_TRAITS[otherKind] ?? TERRAIN_TRAITS.plain
    if (otherTraits.altitude < own.altitude) continue // 比我还低，挡不住
    // 是否在我上风侧：风的来向
    const upwind = wind.fromX > 0 ? ox > x : ox < x
    if (!upwind) continue
    // 横向距离越大，遮挡越弱
    const lateral = Math.abs(oy - y)
    const along = Math.abs(ox - x)
    if (lateral > 0.32 || along > 0.55) continue
    const block = otherTraits.altitude * (1 - lateral / 0.32) * (1 - along / 0.55)
    if (block > strongest) strongest = block
  }
  return Math.min(1, strongest)
}

function climateSummary(warmth, wet) {
  const heat = warmth > 0.72 ? '炎热' : warmth > 0.5 ? '温暖' : warmth > 0.3 ? '凉爽' : '寒冷'
  const moist = wet > 0.72 ? '多雨' : wet > 0.52 ? '湿润' : wet > 0.34 ? '半干' : '干旱'
  return `${heat}${moist}`
}

function clamp01(v) {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
}
function round2(v) {
  return Math.round(v * 100) / 100
}

/**
 * 方位词 → 画布坐标。与客户端 posCell 同一套九宫格。
 *
 * 为什么要在这里再写一份：后端读到的地区只有「方位」这一列的文字，
 * 没有坐标。推演气候必须先知道它在南还是北，所以这一步躲不掉。
 *
 * 这里踩过一次坑，记下来：曾经把纵向拉到 0.10/0.50/0.90，想让气候拉开差距。
 * 结果是「南方」被推到 0.90，折叠后落进亚寒带 —— 南边的雨林算成了寒带。
 * 原因是那张图不是全球剖面，作者写「南边」指的是地图下部，不是南极。
 * 九宫格的 0.18/0.50/0.82 才是对的：它表达的是**相对方位**，
 * 而纬度带的划分（极地→热带→极地）本来就是为全球剖面设计的，
 * 两者混用会自相矛盾。所以坐标回到九宫格，靠调整纬度带边界来表达尺度。
 */
export function posToPoint(pos) {
  const text = String(pos ?? '')
  // 先认复合方位：西南/东北这些要先于单字判断，否则「西南」会被当成南
  const south = /南/u.test(text)
  const north = /北/u.test(text)
  const west = /西/u.test(text)
  const east = /东/u.test(text)
  if (!south && !north && !west && !east) {
    return text.includes('中') ? { x: 0.5, y: 0.5 } : undefined
  }
  // 九宫格中心：1→0.18，2→0.5，3→0.82（与客户端 toRatio 一致）
  const row = north ? 1 : south ? 3 : 2
  const col = west ? 1 : east ? 3 : 2
  const toRatio = (n) => (n - 1) * 0.32 + 0.18
  return { x: toRatio(col), y: toRatio(row) }
}

/**
 * 把地区列表补上坐标和推演气候。atlas 用的就是这个。
 *
 * 已经有 x/y 的（比如从地图资产读回来的）原样保留，没有的按方位词推。
 * 方位也没有的地点会被摆到中部 —— 至少保证它有个气候结论，
 * 并且 auditWorld 会照常检查它有没有讲不通的地方。
 */
export function enrichRegions(regions = []) {
  const list = Array.isArray(regions) ? regions : []
  const located = list.map((region) => {
    const point = posToPoint(region?.pos)
    return {
      ...region,
      x: Number.isFinite(Number(region?.x)) ? Number(region.x) : point?.x ?? 0.5,
      y: Number.isFinite(Number(region?.y)) ? Number(region.y) : point?.y ?? 0.5,
    }
  })
  const report = auditWorld(located)
  const byName = new Map(report.climates.map((climate) => [climate.name, climate]))
  return {
    regions: located.map((region) => ({
      ...region,
      climate: byName.get(String(region.name ?? '').trim()) ?? null,
    })),
    issues: report.issues,
    climates: report.climates,
    coherent: report.coherent,
  }
}

/**
 * 「挨着」的距离阈值，单位是画布比例。
 *
 * 取 0.36 而不是 0.3：九宫格里相邻两格的距离恒为 0.32（0.82 − 0.5，或
 * hypot(0.32, 0)），阈值一旦小于它，「相邻」就会被判成「不相邻」。
 * 早先写 0.3 时，西南的港城和正西的内海被判成隔了老远，于是每次都说
 * 港城没有水源 —— 这种误报是最伤人的，作者会开始无视所有提示。
 * 留 0.04 的余量给手写坐标的轻微偏移。
 */
const NEIGHBOUR_DISTANCE = 0.36

/**
 * 世界审计：找出设定里讲不通的地方。
 *
 * 每条问题都带 severity 和「为什么」。作者可能就是想这么写 ——
 * 但至少他得知道自己破的是哪条规则，以及现实里对应的是什么。
 *
 * 判据一律来自 baselineOf（只看位置与海拔），而不是 climateOf 的推演结果。
 * 推演里地形会修正自己，用推演结果去校验地形就是拿结论证明前提 ——
 * 沙漠会「证明」自己该干旱，审计永远沉默。
 */
export function auditWorld(regions = []) {
  const issues = []
  const list = (Array.isArray(regions) ? regions : [])
    .filter((r) => r && String(r.name ?? '').trim())
    .map((r, index) => ({
      name: String(r.name).trim(),
      x: Number(r.x ?? 0.5),
      y: Number(r.y ?? 0.5),
      index,
      terrain: r.terrain,
      desc: r.desc,
      terrainKind: r.terrainKind ?? detectTerrain(r.terrain, r.desc),
    }))

  const climates = list.map((region) => climateOf(region, { neighbours: list, x: region.x, y: region.y }))

  list.forEach((region, i) => {
    const climate = climates[i]
    // 判据一律用基准气候（只看位置与海拔），不用推演结果 ——
    // 否则「沙漠算出干旱」这种自证会让审计永远沉默。
    const base = baselineOf(region, { x: region.x, y: region.y })
    const band = latitudeBand(region.y)

    // ① 雪原出现在基准温度还很高的地方。
    //    用基准温度而不是推演温度：推演里雪原自身带了 -0.75 的温度修正，
    //    会把自己算冷，于是永远「冷暖相符」。
    if (region.terrainKind === 'snow' && base.warmth > 0.55) {
      issues.push({
        kind: 'snow-too-warm',
        severity: 'high',
        region: region.name,
        message: `「${region.name}」写成雪原，但只看位置与海拔，这里本该有 ${base.warmth} 的热量，不足以常年积雪。`,
        suggestion: `三个改法任选：往高纬挪（画面上方）、给它一个高海拔理由（雪山/高原）、或者写明是魔法或诅咒造成的永冬。`,
      })
    }

    // ② 沙漠出现在基准湿度还很高的地方。
    //
    //    定为 medium 而不是 high：奇幻世界里「源质被抽干的荒原」是一种
    //    完全成立的设定，作者往往已经写明了原因（比如「绝对无源质」）。
    //    判成 high 会让整个世界显得「处处是错」，作者反而不再看提示。
    //    high 只留给真正没救的冲突 —— 比如赤道上的雪原。
    if (region.terrainKind === 'desert' && base.wet > 0.55) {
      issues.push({
        kind: 'desert-too-wet',
        severity: 'medium',
        region: region.name,
        message: `「${region.name}」写成沙漠，但只看位置，这一带本该有 ${base.wet} 的湿度，空气里有水可降。`,
        suggestion: `现实里干旱区都有个抽水的原因：被山脉围住的雨影、沿岸寒流、或者副热带高压带。若是设定所致（源质抽离、神力诅咒），在说明里写一句就够。`,
      })
    }

    // ③ 聚落落在又干又没水的地方。
    if (region.terrainKind === 'city' && base.wet < 0.42) {
      const nearWater = list.some((other) => {
        if (other === region) return false
        const wetKind = other.terrainKind === 'ocean' || other.terrainKind === 'island'
          || other.terrainKind === 'swamp'
        // 阈值必须大于九宫格的相邻格距（0.32），否则「相邻格」也判成不挨着，
        // 这条检查实际上等于关掉了 —— 实测西南的港城和内海隔着 0.32 被判成没水。
        return wetKind && Math.hypot(other.x - region.x, other.y - region.y) <= NEIGHBOUR_DISTANCE
      })
      if (!nearWater) {
        issues.push({
          kind: 'city-without-water',
          severity: 'high',
          region: region.name,
          message: `「${region.name}」是聚落，但附近没有水域，这一带基准湿度只有 ${base.wet}。`,
          suggestion: `城市几乎都长在水边：河、湖、泉、海岸。给它配一条河，或者把说明改成「靠地下水/魔法供水」。`,
        })
      }
    }

    // ④ 水域在基准温度很低的地方，说明里却写温暖。
    if (region.terrainKind === 'ocean' && base.warmth < 0.3 && /温暖|炎热|热浪|四季如春/u.test(String(region.desc ?? ''))) {
      issues.push({
        kind: 'warm-polar-water',
        severity: 'medium',
        region: region.name,
        message: `「${region.name}」在寒冷区域（基准温度 ${base.warmth}），说明里却写它是温暖的水域。`,
        suggestion: `要么改方位，要么说明是暖流带来的（现实里北大西洋暖流让北欧港口终年不冻），一句话就能立住。`,
      })
    }

    // ⑤ 雨林出现在基准很干的地方。
    //
    //    判据放宽到 0.28：温带雨林真实存在（不列颠哥伦比亚、智利南部、
    //    新西兰南岛），那些地方基准湿度也就三成上下。卡在 0.35 会把
    //    「南方温带雨林」这种完全合理的设计判成错误，那种误报比漏报更烦人 ——
    //    作者会开始无视提示。
    if (region.terrainKind === 'forest' && base.wet < 0.28 && /雨林|密林|丛林/u.test(String(region.desc ?? ''))) {
      issues.push({
        kind: 'rainforest-too-dry',
        severity: 'medium',
        region: region.name,
        message: `「${region.name}」被描述成雨林，但这一带的基准湿度只有 ${base.wet}，撑不起那种植被密度。`,
        suggestion: `给它一条河、一个迎风坡，或者改成更耐旱的林型（疏林、灌丛）。`,
      })
    }

    // ⑥ 火山旁有聚落，缺一句解释。这条只是提醒，不是错误 ——
    //    现实里那不勒斯、富士山脚都有人住。
    if (region.terrainKind === 'volcano' && /城|镇|都|村|居民|人/u.test(String(region.desc ?? ''))) {
      issues.push({
        kind: 'volcano-town',
        severity: 'low',
        region: region.name,
        message: `「${region.name}」是火山，说明里提到居民。这在现实里有先例，但值得交代一句。`,
        suggestion: `补上火山灰肥田、温泉聚落或火山湖灌溉，读者就不会觉得他们在送死。`,
      })
    }
  })

  return {
    issues,
    climates: list.map((region, i) => ({ name: region.name, ...climates[i] })),
    // 世界整体是否讲得通：high 级问题为 0
    coherent: issues.filter((issue) => issue.severity === 'high').length === 0,
  }
}

/**
 * 生成给人读的世界概要。可直接写进 世界状态.md。
 */
export function describeWorld(regions = []) {
  const report = auditWorld(regions)
  if (report.climates.length === 0) return ''
  const rows = report.climates.map((c) => {
    return `| ${c.name} | ${c.bandLabel} | ${c.terrainLabel} | ${c.summary} | ${c.wind} | ${c.rainShadow > 0.3 ? '有雨影' : '—'} |`
  })
  const lines = [
    '| 地区 | 纬度带 | 地形 | 气候 | 盛行风 | 备注 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ]
  if (report.issues.length > 0) {
    lines.push('', '### 需要解释的地方', '')
    for (const issue of report.issues) {
      lines.push(`- **${issue.region}**：${issue.message}`, `  - 建议：${issue.suggestion}`)
    }
  }
  return lines.join('\n')
}
