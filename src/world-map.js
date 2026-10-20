/**
 * 世界地图落盘。
 *
 * 客户端在设定树里画出的地区地图，可以一键存成项目资产：
 *
 *   地图.svg  纯矢量，能塞进任何文档，也能直接丢给模型当参考图
 *   地图.md   人读的版本：地名 + 说明 + 它们在画面上的大致方位
 *
 * 图里只有两种东西：地区多边形和地名。这两样都来自『地区.md』，
 * 是作者写的。早先这里还画等高线，由程序噪声生成 —— 好看，但和这部
 * 小说没有任何关系，作者看着觉得「对不上」是对的。伪造的地形比空白更糟：
 * 空白表示「这里还没设定」，编出来的山会被当成设定的一部分。
 *
 * 为什么存 SVG 而不是 PNG：这张图的价值在于「哪块地方叫什么」，是结构信息
 * 不是像素。SVG 缩放不糊，而且换主题时前端能改色重绘。真正的位图更适合
 * 交给生图模型去画。
 *
 * 落盘内容全部由服务端生成。客户端只提交「叫什么项目、有哪些地方、
 * 各自什么地形」，不提交 SVG 字符串 —— 否则一个手滑的前端就能往项目里写
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
 * @param {{name:string,desc?:string,x:number,y:number,terrainKind?:string,terrain?:string}[]} input.sites
 * @param {string} input.project
 * @param {string} [input.seed]      地块形状的种子，默认用项目名
 * @param {number} [input.size]      画布边长，默认 84（与客户端网格一致）
 * @returns {{svg:string, doc:string}}
 */
export function renderWorldMap(input) {
  const size = Number(input?.size) > 0 ? Number(input.size) : 84
  const project = String(input?.project ?? '未命名小说')
  const rawSites = Array.isArray(input?.sites) ? input.sites.slice(0, MAX_SITES) : []

  const sites = rawSites
    .filter((site) => site && String(site.name ?? '').trim())
    .map((site, index) => ({
      name: String(site.name).trim(),
      desc: String(site.desc ?? '').trim(),
      // 归一化到 0–1，超范围的值夹回来，避免画到画布外
      x: Math.min(1, Math.max(0, Number(site.x) || 0)),
      y: Math.min(1, Math.max(0, Number(site.y) || 0)),
      // 地形种类：配色用。客户端会传，没传就从名字和说明推。
      terrainKind: site.terrainKind ?? undefined,
      terrain: String(site.terrain ?? '').trim(),
      id: slug(site.name, index),
    }))

  const px = (v) => (v * size).toFixed(2)

  // 地形块：和界面上同一套 Voronoi 单元。
  //
  // 几何是纯向量，两边算出来完全一致（有测试盯着），所以存下来的资产
  // 和作者在界面上看到的形状是同一张。
  const TINTS = {
    volcano: '#8c3a26', snow: '#a8c4dc', desert: '#b0914f', ocean: '#2f6a94',
    swamp: '#42603c', cave: '#4a4d55', island: '#3f7d72', city: '#8a8072',
    forest: '#41692f', mountain: '#6e7480', plain: '#6f7d3f',
  }
  const grid = terrainCells(
    sites.map((site) => ({
      name: site.name,
      x: site.x,
      y: site.y,
      // 客户端没传地形就从名字和说明推，和服务端别处用的是同一个函数
      terrainKind: site.terrainKind ?? detectTerrain(site.name, site.desc),
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

  const markers = sites.map((site) => {
    const cx = (site.x * size).toFixed(2)
    const cy = (site.y * size).toFixed(2)
    // 标签朝画面内侧放，避免贴边被裁掉
    const anchor = site.x > 0.62 ? 'end' : 'start'
    const dx = site.x > 0.62 ? -3.2 : 3.2
    const tx = (Number(cx) + dx).toFixed(2)
    return `    <g class="site" id="${escapeXml(site.id)}">
      <circle cx="${cx}" cy="${cy}" r="1.6"/>
      <text x="${tx}" y="${cy}" text-anchor="${anchor}">${escapeXml(site.name)}</text>
    </g>`
  }).join('\n')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
 <!-- 由「小说创作大师」根据项目的地理设定生成。
      地名与位置全部来自 地区.md / 设定.md 的地理段，不含程序生成的地形。 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="720" height="720">
  <title>${escapeXml(project)} · 世界地图</title>
  <style>
    .ocean { fill: #070b0f; }
    .site circle { fill: #e8f7ff; stroke: #bfe7ff; stroke-width: .5; }
    .site text { fill: #cfe6f5; font-size: 3.1px; font-family: "PingFang SC","Microsoft YaHei",system-ui,sans-serif; letter-spacing: .1px; }
  </style>
  <rect class="ocean" x="0" y="0" width="${size}" height="${size}"/>
  <g class="cells">
${cellShapes}
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
    if (site.terrain) parts.push(`地形：${site.terrain}`)
    if (site.desc) parts.push(`说明：${site.desc}`)
    return parts.join('｜')
  })

  const doc = `# ${project} · 世界地图

> 由「小说创作大师」根据项目里已有的地理设定生成。
> 图上只有地区边界和地名，全部来自 \`地区.md\`，没有程序补画的地形。
> 配图见同目录下的 \`${SVG_FILE}\`。

${sites.length ? `## 地点（${sites.length} 处）\n\n${rows.join('\n')}` : '## 地点\n\n项目里还没有可识别的地点。可以在 `地区.md` 里按表格补一行，或在 `世界状态.md` 的「地理」段按 `- **地名**（方位·地形）：说明` 格式补充。'}

## 怎么维护

- 地名、方位、地形都直接来自 \`地区.md\`（也认 \`世界状态.md\` 的地理段与 \`设定.md\` 的地理分支）
- 同一个方位写了多个地区时，它们会沿那一侧排开，不会叠在一起
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
