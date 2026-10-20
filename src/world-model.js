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
  // 火山：海拔给了 0.45 而不是山地的 0.85。
  //
  // 早先写 0.9，结果每一座火山都被算成「寒冷」—— 海拔惩罚 -0.495
  // 把地热那 +0.0875 完全盖住，TERRAIN_TRAITS 里写的 warmth 0.35
  // 等于白写。物理上「雪顶火山」确实很冷，但作者写「火山」时想的是
  // 熔岩和地热，不是乞力马扎罗的冰盖。火山是地貌区域，不是单一峰顶。
  volcano: { label: '火山', altitude: 0.45, aridity: 0.55, warmth: 0.35, water: false },
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
  // 聚落。除了城/镇/都，还得认村、庄、寨、屯、营、哨、驿 ——
  // 中文里最常见的聚落恰恰是「李家庄」「王寨」这种一个字，
  // 只认「城」的话，「城邦该有水」这条检查对大部分村子直接失效。
  //
  // 顺序上排在 mountain/forest 之后会漏： 「青木寨」会先被 mountain 的
  // 「山」类词抢走吗？不会，山不在里面。但「山脚村」会被 mountain 抢，
  // 所以聚落要排在 mountain 前面。
  ['city', /城|镇|都|堡|要塞|聚落|村|庄|寨|屯|营|哨|驿|邑|关/u],
  ['forest', /森林|林|树|丛林/u],
  ['mountain', /山|峰|岭|高原|山脉|崖/u],
  ['plain', /平原|原野|草原|旷野|盆地/u],
]

/**
 * 说明里的「超自然限定」。
 *
 * 作者写「绝对无源质」「被诅咒的永冬」「死地」的时候，是在明确告诉你：
 * 这个地方不遵守常理。模型如果照常推演出「温暖干旱」，等于把他写的
 * 那句话当耳旁风 —— 而那句话往往才是这个世界最好玩的地方。
 *
 * 认出这些词之后，不再硬推一个正常气候，而是把设定本身摆出来，
 * 并标注「此地的气候来自设定，不来自位置」。这样面板既没有撒谎，
 * 也不会去审计一个本来就不打算讲道理的地点。
 */
export const SUPERNATURAL_MARKS = [
  { key: 'barren', label: '无源质', re: /无源质|绝源|源质抽离|源质稀薄|死地|不毛/u },
  { key: 'eternal-winter', label: '永冬', re: /永冬|永冻|终年冰封|不化的冰|寒冬不止/u },
  { key: 'eternal-summer', label: '永夏', re: /永夏|四季如夏|终年酷热|不落的太阳/u },
  { key: 'cursed', label: '受诅咒', re: /诅咒|封印|禁忌|被神弃|神罚/u },
  { key: 'blight', label: '枯萎', re: /枯萎|枯死|腐化|衰败|寸草不生/u },
]

/** 从说明里认出超自然限定。可能有多条（既有诅咒又终年冰封）。 */
export function detectMarks(desc = '') {
  const text = String(desc ?? '')
  return SUPERNATURAL_MARKS.filter((mark) => mark.re.test(text)).map((mark) => mark.key)
}

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

  // 作者在说明里写了超自然限定时，不要硬推一个正常气候。
  //
  // 「深渊裂谷：绝对无源质」原先被算成「温暖干旱」—— 温暖？那是个
  // 连源质都没有的地方。模型只认地形词，把人写的那句话当耳旁风。
  // 这里改成：认出限定后，气候就照设定说，并标明来源是设定而非位置。
  const marks = detectMarks(region?.desc)
  const supernatural = marks.map((key) => SUPERNATURAL_MARKS.find((m) => m.key === key)).filter(Boolean)

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
    // 设定级限定：有值时面板要显示它们，审计要放过这个地点。
    marks: supernatural.map((mark) => mark.label),
    // 这条气候是推出来的还是作者写死的。面板据此决定要不要说「不是你写的」。
    derived: supernatural.length === 0,
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
 * 水系：这一带的水从哪来。
 *
 * 这里刻意**不**画河流。河流需要一张连续的高程面 —— 水从高处往低处连成
 * 一条线，而这套数据只有九宫格里的若干个点加一句说明。真要硬画，画出来的
 * 河会立刻和地形打架（「河穿过了一座山」），作者一眼就能看出来是假的。
 * 假的比没有更糟：它会让整块推演都不可信。
 *
 * 所以只回答一个它能答的问题：这里有没有地表水，来源是哪一种。
 * 四个来源对应现实里全部的内陆供水方式，答完作者就知道该补什么。
 *
 * 返回 { kind, label, detail }，kind 取值：
 *   coastal  挨着海（最省事，也最不容易写错）
 *   lake     旁边有湖沼
 *   river    在湿润带、有山有林，推断有河（注意这是推断，不是确定）
 *   dry      什么都没有 —— 这种地方要么靠地下水，要么根本不该有聚落
 */
export function waterSource(region, neighbours = []) {
  const self = region ?? {}
  const kind = self.terrainKind ?? detectTerrain(self.terrain, self.desc)
  const traits = TERRAIN_TRAITS[kind]
  const desc = String(self.desc ?? '')
  const x = Number(self.x ?? 0.5)
  const y = Number(self.y ?? 0.5)

  // 自己就是水体，或者说明里直接写了河湖海
  if (traits?.water) {
    return { kind: 'self', label: senseWater(kind), detail: '本地就是水体' }
  }
  const named = /河|江|溪|湖|泉|井|湾|港|海岸/u.exec(desc)
  if (named) {
    // 只截到单字会说出「有港」这种话 —— 读者要的是「靠海」或「有河」。
    // 「港」和「湾」本来就意味着海，换个说法更直接。
    const word = named[0]
    const label = word === '港' || word === '湾' || word === '海岸' ? '靠海'
      : word === '湖' ? '有湖'
        : word === '泉' || word === '井' ? '有泉'
          : '有河'
    return { kind: 'named', label, detail: `说明里写了「${word}」` }
  }

  // 说明里写了超自然供水（魔法泉、圣泉之类）也认，但要标明来源是设定
  const marks = detectMarks(desc)
  if (marks.includes('barren')) {
    return { kind: 'none', label: '无水', detail: '设定写明此地无源质' }
  }

  // 看邻居。海/湖/沼算水源，河不算（那需要连续地形）。
  const wetNeighbour = neighbours
    .filter((other) => other && String(other.name ?? '') !== String(self.name ?? ''))
    .map((other) => ({
      other,
      kind: other.terrainKind ?? detectTerrain(other.terrain, other.desc),
    }))
    .filter(({ other, kind: k }) => {
      if (!TERRAIN_TRAITS[k]?.water && k !== 'ocean' && k !== 'swamp' && k !== 'island') return false
      const ox = Number(other.x ?? 0.5)
      const oy = Number(other.y ?? 0.5)
      return Math.hypot(ox - x, oy - y) <= NEIGHBOUR_DISTANCE
    })

  if (wetNeighbour.length > 0) {
    const near = wetNeighbour[0]
    const nearKind = near.other.terrainKind ?? detectTerrain(near.other.terrain, near.other.desc)
    return {
      kind: nearKind === 'swamp' ? 'swamp' : 'coastal',
      label: nearKind === 'swamp' ? '近沼泽' : '近水域',
      detail: `挨着「${String(near.other.name ?? '').trim()}」`,
    }
  }

  // 没有水域，但足够湿、又有山（山能集水）。
  // 自己就是高地也算 —— 山地自己就是那条河的源头，不该往外找山。
  const selfIsHighland = kind === 'mountain' || kind === 'volcano'
  const hasHighland = selfIsHighland || neighbours.some((other) => {
    if (!other || String(other.name ?? '') === String(self.name ?? '')) return false
    const k = other.terrainKind ?? detectTerrain(other.terrain, other.desc)
    return k === 'mountain' || k === 'volcano'
  })
  const folded = Math.abs(latitudeRatio(y) - 0.5) * 2
  const wet = baseHumidity(folded)
  // 湿度门槛只管「山在别处」的情况：借别人的水要看那一带降不降水。
  //
  // 高地自己不需要这个门槛。原来的写法一视同仁，于是「霜脊山脉」被判成
  // 无地表水 —— 一座横贯北境的山脉没有水，这话说出来就没人信了。
  // 雪山靠融雪供水，与全局湿度无关；现实里干旱区的山反而是唯一的水源。
  //
  // 雨林带又是一类：年降水足够多，没有山也会有河，亚马逊和刚果都是这样。
  // 原来只认「山」，于是赤道腹地被判成无地表水 —— 那是全地球水最多的地方。
  if (hasHighland && (selfIsHighland || wet > 0.4)) {
    return {
      kind: 'river',
      label: '推断有河',
      detail: selfIsHighland ? '本地就是高地，河流该从这里发源' : '附近有山且不干旱，水会流下来',
    }
  }
  if (wet > 0.7) {
    return { kind: 'river', label: '推断有河', detail: '降水丰沛，地面自然会有水系' }
  }

  return { kind: 'dry', label: '无地表水', detail: '附近既没有水域也没有集水的山' }
}

/** 水体自身的种类说具体一点，光写「水域」等于没说。 */
function senseWater(kind) {
  if (kind === 'ocean') return '水体'
  if (kind === 'swamp') return '沼泽'
  if (kind === 'island') return '环海'
  return '水体'
}

/**
 * 给一条审计问题生成「该搜什么」。
 *
 * 为什么不让模型自己想去搜什么：作者打字提问时用的词往往搜不到答案。
 * 「赤道雪原怎么回事」返回旅游攻略，「赤道 高山 冰川 成因」才返回地质学。
 * 检索词是这套东西和现实资料之间唯一的那根线，断了就等于没联网。
 *
 * 每条问题都已经带 research（见 auditWorld），这里只做拼接与去重，
 * 不再二次判断 —— 判据只该有一个地方。
 */
export function researchQueryFor(issue) {
  const base = String(issue?.research ?? '').trim()
  if (!base) return ''
  // 带上地区名会让搜索结果跑偏到「这个虚构地名」，搜索引擎不认识它。
  // 只有问题是关于某个真实地貌时才加限定词。
  //
  // 限定词也必须和 base 去重：base 已经是「古代城市 选址 水源」，
  // 再拼一个「选址原则」就成了「选址 水源 选址原则」，明显是机器凑的。
  const qualifier = issue?.kind === 'city-without-water' ? '原则'
    : issue?.kind === 'snow-too-warm' ? '低纬'
      : ''
  if (!qualifier || base.includes(qualifier)) return base
  return `${base} ${qualifier}`.trim()
}

/**
 * 地区列表 → 一组适合直接丢给检索服务的问句。
 *
 * 只取 high/medium，且按地区去重：同一个地点三条提示，
 * 检索三次拿回三份高度重复的结论，纯属浪费。
 */
export function researchPlan(issues = []) {
  const seen = new Set()
  const plan = []
  for (const issue of Array.isArray(issues) ? issues : []) {
    if (!issue || issue.severity === 'low') continue
    const query = researchQueryFor(issue)
    if (!query) continue
    const key = `${issue.region}::${query}`
    if (seen.has(key)) continue
    seen.add(key)
    plan.push({ region: issue.region, kind: issue.kind, query })
  }
  return plan
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
      // 水系要先知道地形，靠说明推的和写明的都得认
      terrainKind: region?.terrainKind ?? detectTerrain(region?.terrain, region?.desc),
    }
  })
  const report = auditWorld(located)
  const byName = new Map(report.climates.map((climate) => [climate.name, climate]))
  return {
    regions: located.map((region) => ({
      ...region,
      climate: byName.get(String(region.name ?? '').trim()) ?? null,
      water: waterSource(region, located),
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

    // 作者已经用「无源质」「永冬」「受诅咒」这类话解释了异常，就别再问他一遍。
    //
    // 审计的价值在于「你没想到的地方」，不在于「你没写的地方」。
    // 他写了原因，这条就不是疏漏；重复提示只会训练他把面板当真空气。
    // 但限定要真的覆盖问题：永冬能解释雪原不该在赤道，解释不了城邦没水。
    const marks = climate.marks ?? []
    const explains = (...keys) => marks.length > 0 && keys.some((key) => marks.includes(key))

    // ① 雪原出现在基准温度还很高的地方。
    //    用基准温度而不是推演温度：推演里雪原自身带了 -0.75 的温度修正，
    //    会把自己算冷，于是永远「冷暖相符」。
    if (region.terrainKind === 'snow' && base.warmth > 0.55 && !explains('永冬', '受诅咒')) {
      issues.push({
        kind: 'snow-too-warm',
        research: '赤道 高山 冰川 成因',
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
    if (region.terrainKind === 'desert' && base.wet > 0.55 && !explains('无源质', '枯萎', '受诅咒')) {
      issues.push({
        kind: 'desert-too-wet',
        research: '沿海沙漠 成因 寒流',
        severity: 'medium',
        region: region.name,
        message: `「${region.name}」写成沙漠，但只看位置，这一带本该有 ${base.wet} 的湿度，空气里有水可降。`,
        suggestion: `现实里干旱区都有个抽水的原因：被山脉围住的雨影、沿岸寒流、或者副热带高压带。若是设定所致（源质抽离、神力诅咒），在说明里写一句就够。`,
      })
    }

    // ③ 聚落落在又干又没水的地方。
    //
    //    水源判断统一交给 waterSource，不再在这里另写一份。
    //    两处各写一套的下场是：面板说「有条河」，审计说「没水」，
    //    作者不知道该信哪个，索性两个都不信。
    if (region.terrainKind === 'city' && base.wet < 0.42 && !explains('无源质')) {
      const source = waterSource(region, list)
      // 只有确实没水才报。推断有河（river）也算有水 —— 那是「大概有」，
      // 作者没写河不代表这条设定错了，不该判成硬伤。
      if (source.kind === 'dry' || source.kind === 'none') {
        issues.push({
          kind: 'city-without-water',
          research: '古代城市 选址 水源',
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
        research: '北大西洋暖流 不冻港',
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
        research: '温带雨林 分布 降水',
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
        research: '火山 聚落 火山灰 农业',
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
