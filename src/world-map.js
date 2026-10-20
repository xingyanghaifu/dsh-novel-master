/**
 * 世界地图落盘。
 *
 * 客户端在设定树里画出的等高线地形，可以一键存成项目资产：
 *
 *   地图.svg  纯矢量，能塞进任何文档，也能直接丢给模型当参考图
 *   地图.md   人读的版本：地名 + 说明 + 它们在画面上的大致方位
 *
 * 为什么存 SVG 而不是 PNG：这张图的价值在于「哪块地方叫什么」，是结构信息
 * 不是像素。SVG 缩放不糊，而且换主题时前端能改色重绘。真正的位图更适合
 * 交给生图模型去画，不该由等高线冒充。
 *
 * 落盘内容全部由服务端生成。客户端只提交「叫什么项目、有哪些地方、
 * 各自多高」，不提交 SVG 字符串 —— 否则一个手滑的前端就能往项目里写
 * 任意内容，也让这个接口变成了通用的文件写入器。
 */
import { regionsOf } from './atlas.js'
import { readProjectFile, writeProjectFile } from './project.js'
import { detectTerrain } from './world-model.js'
import { terrainCells, cellPath } from './terrain-cells.js'

const SVG_FILE = '地图.svg'
const DOC_FILE = '地图.md'
const MAX_SITES = 40

/** 把名字转成 SVG 里安全、且能当 CSS id 用的片段。 */
function slug(text, index) {
  const cleaned = String(text ?? '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/gu, '')
  return cleaned ? `r-${cleaned}` : `r-${index}`
}

function escapeXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 生成整张世界地图的两个副本。
 *
 * @param {object} input
 * @param {string[][]} input.layers  每层的 SVG path（客户端算好的等高线）
 * @param {{name:string,desc?:string,x:number,y:number,height?:number}[]} input.sites
 * @param {string} input.project
 * @param {number} [input.size]      画布边长，默认 84（与客户端网格一致）
 * @returns {{svg:string, doc:string}}
 */
export function renderWorldMap(input) {
  const size = Number(input?.size) > 0 ? Number(input.size) : 84
  const project = String(input?.project ?? '未命名小说')
  const rawSites = Array.isArray(input?.sites) ? input.sites.slice(0, MAX_SITES) : []
  const layers = Array.isArray(input?.layers) ? input.layers : []

  const sites = rawSites
    .filter((site) => site && String(site.name ?? '').trim())
    .map((site, index) => ({
      name: String(site.name).trim(),
      desc: String(site.desc ?? '').trim(),
      // 归一化到 0–1，超范围的值夹回来，避免画到画布外
      x: Math.min(1, Math.max(0, Number(site.x) || 0)),
      y: Math.min(1, Math.max(0, Number(site.y) || 0)),
      height: Math.min(1, Math.max(0, Number(site.height) || 0)),
      // 地形种类：配色用。客户端会传，没传就从名字和说明推。
      terrainKind: site.terrainKind ?? undefined,
      id: slug(site.name, index),
    }))

  const px = (v) => (v * size).toFixed(2)

  // 地形块：和界面上同一套 Voronoi 单元。
  //
  // 界面上那层是 canvas 逐像素渐变，这里不能那么干 —— PNG 塞进 SVG 会让
  // 文件体积翻几十倍，服务端也没有 canvas。但地形块的几何是纯向量，
  // 两边算出来完全一致（有测试盯着），所以这里直接画多边形，
  // 存下来的资产和作者在界面上看到的形状是同一张。
  const TINTS = {
    volcano: '#8c3a26', snow: '#c8dbea', desert: '#b89a62', ocean: '#2f6a94',
    swamp: '#42603c', cave: '#3a3c42', island: '#4a8a7e', city: '#8a8072',
    forest: '#4a7440', mountain: '#6e7480', plain: '#7d8850',
  }
  const grid = terrainCells(
    sites.map((site) => ({
      name: site.name,
      x: site.x,
      y: site.y,
      // 客户端没传地形就从名字和说明推，和服务端别处用的是同一个函数
      terrainKind: site.terrainKind ?? detectTerrain(site.name, site.desc),
      height: site.height,
    })),
    { width: size, height: size, seed: String(input?.seed ?? project) },
  )
  const cellShapes = grid.cells.map((cell) => {
    const color = TINTS[cell.terrainKind]
    // 认不出地形就不铺色 —— 猜一个颜色比不涂更误导
    if (!color) return ''
    // 填充块完全不描边。都描边的话整张图会布满网格线，像行政区划图；
    // 真实地貌的边界只在「两个地区交界」处出现。
    const stroke = cell.filler ? '' : ' stroke="#080d12" stroke-width=".22"'
    return `    <path class="cell${cell.filler ? ' filler' : ''}" d="${cellPath(cell)}" fill="${color}" fill-opacity="${cell.filler ? 0.3 : 0.55}"${stroke}/>`
  }).filter(Boolean).join('\n')

  // 等高线：每层描两遍（暗底 + 亮线），和界面上看到的一致。
  // 只保留 path 数据，不信任客户端给的其他属性。
  const contours = layers
    .filter((d) => typeof d === 'string' && d.length > 0 && d.length < 200000)
    .map((d) => `    <path class="base" d="${escapeXml(d)}"/>\n    <path class="line" d="${escapeXml(d)}"/>`)
    .join('\n')

  const markers = sites.map((site) => {
    const cx = (site.x * size).toFixed(2)
    const cy = (site.y * size).toFixed(2)
    const r = (1.6 + site.height * 1.4).toFixed(2)
    // 标签朝画面内侧放，避免贴边被裁掉
    const anchor = site.x > 0.62 ? 'end' : 'start'
    const dx = site.x > 0.62 ? -3.2 : 3.2
    const tx = (Number(cx) + dx).toFixed(2)
    return `    <g class="site" id="${escapeXml(site.id)}">
      <circle cx="${cx}" cy="${cy}" r="${r}"/>
      <text x="${tx}" y="${cy}" text-anchor="${anchor}">${escapeXml(site.name)}</text>
    </g>`
  }).join('\n')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 由「小说创作大师」根据 世界状态.md / 设定.md 的地理段生成。
     地名与位置来自项目设定，等高线由这些地点的完整性推演而来。 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="720" height="720">
  <title>${escapeXml(project)} · 世界地图</title>
  <style>
    .ocean { fill: #070b0f; }
    .base  { fill: none; stroke: #0a1219; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; opacity: .85; }
    .line  { fill: none; stroke: #9ec9e8; stroke-width: .55; stroke-linecap: round; stroke-linejoin: round; opacity: .62; }
    .site circle { fill: #e8f7ff; stroke: #bfe7ff; stroke-width: .5; }
    .site text { fill: #cfe6f5; font-size: 3.1px; font-family: "PingFang SC","Microsoft YaHei",system-ui,sans-serif; letter-spacing: .1px; }
  </style>
  <rect class="ocean" x="0" y="0" width="${size}" height="${size}"/>
  <g class="cells">
${cellShapes}
  </g>
  <g class="contours">
${contours}
  </g>
  <g class="sites">
${markers}
  </g>
</svg>
`

  // 人读版本：列表 + 方位。方位用九宫格表达，比坐标好读。
  const bearing = (x, y) => {
    const ew = x < 0.38 ? '偏西' : x > 0.62 ? '偏东' : '居中'
    const ns = y < 0.38 ? '偏北' : y > 0.62 ? '偏南' : '中段'
    return `${ns}${ew === '居中' ? '' : `·${ew}`}`
  }
  const rows = sites.map((site) => {
    const parts = [`- **${site.name}**`]
    parts.push(`方位：${bearing(site.x, site.y)}`)
    if (site.desc) parts.push(`说明：${site.desc}`)
    return parts.join('｜')
  })

  const doc = `# ${project} · 世界地图

> 由「小说创作大师」根据项目里已有的地理设定生成。
> 等高线的高低反映各处设定的完整程度：写得越厚的地方山越高。
> 配图见同目录下的 \`${SVG_FILE}\`。

${sites.length ? `## 地点（${sites.length} 处）\n\n${rows.join('\n')}` : '## 地点\n\n项目里还没有可识别的地点。可以在 `世界状态.md` 的「地理」段按 `- **地名**：说明` 格式补充。'}

## 怎么维护

- 地名直接来自 \`世界状态.md\` 的「地理」段（也认 \`地区.md\` 表格与 \`设定.md\` 的地理分支）
- 改完设定后回到设定树点一次「存为地图资产」即可刷新
- 这张图是**结构示意**，不是美术稿；真正的插画请走「AI 生图」
`

  return { svg, doc }
}

/**
 * 把地图写进项目目录。
 *
 * 只允许覆盖这两个固定文件名 —— 文件名不是调用方给的，所以不存在路径穿越；
 * writeProjectFile 里还会再比一次绝对路径前缀，双保险。
 */
export function saveWorldMap(cwd, project, input) {
  const name = String(project ?? '').trim()
  if (!name) throw new Error('缺少项目名')
  // 项目必须真的存在，避免往任意目录里写文件
  if (readProjectFile(cwd, name, '设定.md') === undefined
    && readProjectFile(cwd, name, '世界状态.md') === undefined
    && readProjectFile(cwd, name, '大纲.md') === undefined) {
    throw new Error(`找不到项目「${name}」，请确认它在项目目录下`)
  }

  const { svg, doc } = renderWorldMap({ ...input, project: name })
  const wroteSvg = writeProjectFile(cwd, name, SVG_FILE, svg)
  const wroteDoc = writeProjectFile(cwd, name, DOC_FILE, doc)
  if (!wroteSvg && !wroteDoc) throw new Error('地图写入失败，请检查项目目录是否可写')

  return {
    ok: true,
    project: name,
    files: [wroteSvg ? SVG_FILE : null, wroteDoc ? DOC_FILE : null].filter(Boolean),
    sites: (input?.sites ?? []).length,
  }
}

/** 从项目设定里取地点，供客户端在保存前预览。 */
export function worldSites(cwd, project) {
  return regionsOf(cwd, project).map((region) => ({
    name: region.name,
    desc: region.desc ?? '',
  }))
}
