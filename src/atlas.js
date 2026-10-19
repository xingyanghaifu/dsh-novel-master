/**
 * 设定树（Atlas）：把项目里既有的世界观 / 人设 / 大纲 / 世界状态 / 伏笔 /
 * 剧情树 / 写作规范文档和正文进度整理成结构化 JSON，供 Web 端右侧栏的树状
 * 面板渲染。只读、有界、纯派生：不写任何文件，读取上限防止超大文档拖垮面板。
 */
import {
  RULES_FILE,
  latestProject,
  listChapters,
  listProjects,
  projectDir,
  readProjectFile,
  readState,
  withProjectsDirectory,
} from './project.js'
import { listAssets } from './assets.js'
import fs from 'node:fs'
import path from 'node:path'

/** 批量写作阶段文件：由 cmd-batch 在每批开始/结束时写盘，进度面板只读它。 */
export const BATCH_STATUS_FILE = '批量写作状态.json'

/** 单个文档最多解析的标题节点数。 */
export const MAX_HEADING_NODES = 400
/** 正文节点最多列出的章节数。 */
export const MAX_CHAPTER_NODES = 500
/** 最多列出的项目数。 */
export const MAX_PROJECTS = 50
/** 单个文档的读取上限（超出部分不解析）。 */
export const MAX_FILE_CHARS = 512 * 1024
/** 地区最多列出的数量。 */
export const MAX_REGIONS = 40
/** 事件最多列出的数量。 */
export const MAX_EVENTS = 300

/** 树的一级分区：固定顺序，缺失的文档也占一格（显示“未创建”）。 */
export const ATLAS_SECTIONS = [
  { key: 'setting', file: '设定.md', label: '世界观' },
  { key: 'cast', file: '角色.md', label: '人设' },
  { key: 'outline', file: '大纲.md', label: '大纲' },
  { key: 'worldstate', file: '世界状态.md', label: '世界状态' },
  { key: 'foreshadow', file: '伏笔.md', label: '伏笔' },
  { key: 'plot', file: '剧情树.md', label: '剧情树' },
  { key: 'rules', file: RULES_FILE, label: '写作规范' },
]

/** 去掉标题里的 Markdown 装饰，树上显示干净文本。 */
export function cleanLabel(raw) {
  return String(raw)
    .replace(/\s*#+\s*$/u, '')
    .replace(/\*\*(.+?)\*\*/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * 把 Markdown 标题层级折叠成树。返回节点带稳定 id（父 id + 下标），
 * 供前端做展开状态的 key。超出 MAX_HEADING_NODES 截断并标记。
 */
export function headingTree(text) {
  const roots = []
  const stack = [{ level: 0, children: roots, id: '' }]
  let total = 0
  let truncated = false
  for (const line of String(text).split('\n')) {
    const match = /^(#{1,4})\s+(.+?)\s*$/u.exec(line)
    if (match === null) continue
    if (total >= MAX_HEADING_NODES) { truncated = true; break }
    const level = match[1].length
    while (stack.length > 1 && stack.at(-1).level >= level) stack.pop()
    const parent = stack.at(-1)
    const id = `${parent.id}/${parent.children.length}`
    const node = { id, label: cleanLabel(match[2]), level, children: [] }
    parent.children.push(node)
    stack.push({ level, children: node.children, id })
    total += 1
  }
  return { nodes: roots, total, truncated }
}

function sectionTree(cwd, name, section) {
  const text = readProjectFile(cwd, name, section.file)
  if (text === undefined) {
    return { ...section, exists: false, headings: 0, chars: 0, truncated: false, docTitle: '', nodes: [] }
  }
  const { nodes, total, truncated } = headingTree(text.slice(0, MAX_FILE_CHARS))
  // 文档自己的 H1 标题（如「# 设定」）只是包装，把它的子标题提升一级，
  // 避免每个分支下都挂着一层同名空壳节点。
  const hoisted = nodes.length === 1 && nodes[0].children.length > 0 ? nodes[0].children : nodes
  const docTitle = nodes.length === 1 && nodes[0].children.length > 0 ? nodes[0].label : ''
  // chars 是给「资产是否写好」用的，不看标题数：伏笔.md 是纯表格文档，
  // 内容再多也没有一个标题，只按 headings 判断会把它当成空文档。
  return { ...section, exists: true, headings: total, chars: text.length, truncated, docTitle, nodes: hoisted }
}

/** 伏笔表统计：与 /novel-stats 同口径（表行数、未回收数）。 */
function foreshadowStats(text) {
  const rows = String(text).split('\n').filter((line) => /^\|/u.test(line) && !/^\|\s*-|伏笔\s*\|\s*埋于/u.test(line))
  const open = rows.filter((line) => !/(已回收|已收|✓|✅)/u.test(line)).length
  return { total: rows.length, open }
}

/** 从第 1 章到最后已写章节之间的缺号（最多记录 50 个）。 */
function missingChapters(chapters) {
  const missing = []
  const last = chapters.at(-1)
  for (let i = 1, j = 0; last && i <= last.number && missing.length < 50; i++) {
    while (j < chapters.length && chapters[j].number < i) j++
    if (chapters[j]?.number !== i) missing.push(i)
  }
  return missing
}

/** 从文本提取章号：`第12章`、`12章`、纯数字均可。 */
export function extractChapter(value) {
  const text = String(value ?? '')
  const withUnit = /(\d{1,4})\s*章/u.exec(text)
  if (withUnit) return Number(withUnit[1])
  if (/^\s*\d{1,4}\s*$/u.test(text)) return Number(text.trim())
  return null
}

/** 解析 Markdown 表格为 { header, rows }；非表格文本返回 null。 */
export function parseTable(text) {
  if (typeof text !== 'string') return null
  const lines = text.split('\n').filter((line) => /^\|/u.test(line))
  if (lines.length < 2) return null
  const cells = (line) => line.replace(/^\||\|$/gu, '').split('|').map((cell) => cleanLabel(cell.trim()))
  const header = cells(lines[0])
  const rows = []
  for (const line of lines.slice(1)) {
    if (/^\|[\s:|-]+\|$/u.test(line)) continue
    const row = cells(line)
    if (row.every((cell) => cell === '')) continue
    rows.push(row)
  }
  return { header, rows }
}

const pickColumn = (header, patterns, fallback = -1) => {
  const index = header.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)))
  return index >= 0 ? index : fallback
}

function flattenHeadings(nodes, out = []) {
  for (const node of nodes) {
    out.push(node)
    flattenHeadings(node.children ?? [], out)
  }
  return out
}

/** 地区：优先 `地区.md` 表格（地区/方位/说明/人物），回退到 设定.md「地理」分支的子条目。 */
export function regionsOf(cwd, name) {
  const table = parseTable(readProjectFile(cwd, name, '地区.md'))
  if (table && table.rows.length) {
    const nameCol = pickColumn(table.header, [/地区|地点|区域|名称|名字/u], 0)
    const posCol = pickColumn(table.header, [/方位|位置|方向|坐标/u])
    const terrainCol = pickColumn(table.header, [/地形|地貌|地表|景观|植被/u])
    const descCol = pickColumn(table.header, [/说明|描述|简介|备注/u])
    const peopleCol = pickColumn(table.header, [/人物|角色|相关/u])
    return table.rows.slice(0, MAX_REGIONS)
      .map((row) => ({
        name: row[nameCol] ?? '',
        pos: posCol >= 0 ? row[posCol] ?? '' : '',
        terrain: terrainCol >= 0 ? row[terrainCol] ?? '' : '',
        desc: descCol >= 0 ? row[descCol] ?? '' : '',
        people: peopleCol >= 0 ? row[peopleCol] ?? '' : '',
      }))
      .filter((region) => region.name)
  }
  const text = readProjectFile(cwd, name, '设定.md')
  if (text === undefined) return []
  const { nodes } = headingTree(text.slice(0, MAX_FILE_CHARS))
  const hoisted = nodes.length === 1 && nodes[0].children.length > 0 ? nodes[0].children : nodes
  const geo = hoisted.find((node) => /地理|地图|地点|地区|世界地图/u.test(node.label))
  return (geo?.children ?? []).slice(0, MAX_REGIONS)
    .map((child) => ({ name: cleanLabel(child.label), pos: '', terrain: '', desc: '', people: '' }))
}

/** 世界状态.md「世界时钟」段落的正文行（背景/史前事件）。 */
export function worldClockLines(text) {
  const lines = String(text ?? '').split('\n')
  const start = lines.findIndex((line) => /^#{2,4}\s*.*世界时钟/u.test(line))
  if (start < 0) return []
  const out = []
  for (let i = start + 1; i < lines.length && out.length < 20; i++) {
    const line = lines[i].trim()
    if (/^#{1,4}\s/u.test(line)) break
    if (line && !/^[>|*-]/u.test(line)) out.push(cleanLabel(line))
  }
  return out
}

const RANGE_RE = /\d{1,4}\s*[–~—-]\s*\d{1,4}\s*章/u

/** 章节条目标题：取 `**第N章 标题**` 的加粗段，去掉章号前缀，其余截到句读。 */
function chapterTitle(raw) {
  const bold = /\*\*([^*]+?)\*\*/u.exec(String(raw))
  const base = bold ? bold[1] : String(raw).replace(/^[#>\s-]*\**/u, '').split(/[：:。]/u)[0]
  return cleanLabel(base.replace(/^第\s*\d{1,4}\s*章[\s：:、.-]*/u, '')) || cleanLabel(base)
}

/** 大纲里的逐章事件：标题行与「第N章 xxx」条目行都算（区间卷名不算）。 */
function outlineEvents(text) {
  const events = []
  const seen = new Set()
  const add = (raw) => {
    const label = String(raw)
    const chapter = extractChapter(label)
    if (chapter === null || RANGE_RE.test(label) || seen.has(chapter)) return
    seen.add(chapter)
    events.push({ id: `outline/${chapter}`, title: chapterTitle(label), chapter, region: '', people: '', status: '', source: '大纲' })
  }
  for (const node of flattenHeadings(headingTree(text.slice(0, MAX_FILE_CHARS)).nodes)) add(node.label)
  for (const line of String(text).split('\n').slice(0, 800)) {
    const trimmed = line.trim()
    if (/^#{1,6}\s/u.test(trimmed)) continue
    if (/^(?:[-*]\s*)?\**第\s*\d{1,4}\s*章/u.test(trimmed)) add(trimmed)
  }
  return events
}

/** 事件：优先 `事件.md` 表格（事件/章号/地区/人物/状态），否则从大纲/剧情树/伏笔/世界时钟推导。 */
export function eventsOf(cwd, name, regions = []) {
  const events = []
  const push = (event) => { if (events.length < MAX_EVENTS && event.title) events.push(event) }
  const table = parseTable(readProjectFile(cwd, name, '事件.md'))
  if (table && table.rows.length) {
    const titleCol = pickColumn(table.header, [/事件|名称|标题|事项/u], 0)
    const chapterCol = pickColumn(table.header, [/章|时间|时间点|发生/u])
    const regionCol = pickColumn(table.header, [/地区|地点|位置/u])
    const peopleCol = pickColumn(table.header, [/人物|角色|参与/u])
    const statusCol = pickColumn(table.header, [/状态|结果/u])
    table.rows.forEach((row, index) => {
      push({
        id: `event/${index}`,
        title: row[titleCol] ?? '',
        chapter: chapterCol >= 0 ? extractChapter(row[chapterCol]) : null,
        region: regionCol >= 0 ? row[regionCol] ?? '' : '',
        people: peopleCol >= 0 ? row[peopleCol] ?? '' : '',
        status: statusCol >= 0 ? row[statusCol] ?? '' : '',
        source: '事件',
      })
    })
    return attachRegions(events, regions)
  }
  for (const event of outlineEvents(readProjectFile(cwd, name, '大纲.md') ?? '')) push(event)
  const plot = flattenHeadings(headingTree((readProjectFile(cwd, name, '剧情树.md') ?? '').slice(0, MAX_FILE_CHARS)).nodes)
  for (const node of plot) {
    const chapter = extractChapter(node.label)
    if (chapter !== null && !RANGE_RE.test(node.label) && !events.some((event) => event.chapter === chapter && event.source === '大纲')) {
      push({ id: `plot/${events.length}`, title: cleanLabel(node.label), chapter, region: '', people: '', status: '', source: '剧情树' })
    }
  }
  const foreshadow = parseTable(readProjectFile(cwd, name, '伏笔.md') ?? '')
  if (foreshadow) {
    const titleCol = pickColumn(foreshadow.header, [/伏笔|名称|事件|标题/u], 0)
    const chapterCol = pickColumn(foreshadow.header, [/埋于|埋设|首次|出现|章/u])
    foreshadow.rows.forEach((row, index) => {
      push({
        id: `foreshadow/${index}`, title: row[titleCol] ?? '',
        chapter: chapterCol >= 0 ? extractChapter(row[chapterCol]) : null,
        region: '', people: '', status: '', source: '伏笔',
      })
    })
  }
  worldClockLines(readProjectFile(cwd, name, '世界状态.md') ?? '').forEach((line, index) => {
    push({ id: `clock/${index}`, title: line, chapter: null, region: '', people: '', status: '', source: '世界时钟' })
  })
  return attachRegions(events, regions)
}

/** 事件按标题里出现的地区名归位（显式地区列优先）。 */
export function attachRegions(events, regions) {
  return events.map((event) => {
    if (event.region || !Array.isArray(regions)) return event
    const hit = regions.find((region) => region.name && event.title.includes(region.name))
    return hit ? { ...event, region: hit.name } : event
  })
}

/** 单个项目的完整树数据 + 进度画像。 */
export function projectAtlas(cwd, name) {
  const state = readState(cwd, name) ?? {}
  const chapters = listChapters(cwd, name)
  const chars = chapters.reduce((sum, chapter) => sum + chapter.chars, 0)
  const last = chapters.at(-1)
  const goal = Number(state.target) || 0
  const avg = chapters.length ? Math.round(chars / chapters.length) : 0
  const foreshadow = foreshadowStats(readProjectFile(cwd, name, '伏笔.md') ?? '')
  const branches = (readProjectFile(cwd, name, '剧情树.md')?.match(/^#{2,3}\s/gmu) ?? []).length
  const regions = regionsOf(cwd, name)
  const events = eventsOf(cwd, name, regions)
  const chapterNodes = chapters.slice(0, MAX_CHAPTER_NODES).map((chapter) => ({
    id: `chapters/${chapter.number}`,
    label: `第${chapter.number}章${chapter.title ? ` ${chapter.title}` : ''}`,
    meta: `${chapter.chars} 字`,
    level: 1,
    children: [],
  }))
  const sections = ATLAS_SECTIONS.map((section) => sectionTree(cwd, name, section))
  return {
    name,
    title: state.title ?? name,
    progress: {
      chapters: chapters.length,
      goal,
      last: last?.number ?? 0,
      chars,
      avg,
      percent: goal ? Math.min(100, Math.round(((last?.number ?? 0) / goal) * 100)) : null,
      missing: missingChapters(chapters),
      foreshadowTotal: foreshadow.total,
      foreshadowOpen: foreshadow.open,
      branches,
    },
    sections,
    // 生成进度面板要的是「哪些基础资产已经有了」，而不是每份文档的完整标题树。
    // 单独给一份轻量汇总：扇区数据本来就为设定树算过，这里只是换一种口径讲出来，
    // 不额外读盘。
    readiness: assetReadiness(sections, chapters.length),
    // 批量写作有真实的阶段文件（写盘时机由 cmd-batch 控制），进度面板直接读它。
    batch: readBatchStatus(cwd, name),
    regions,
    events,
    // 已绑定的 AI 插图：kind+name 对应 relation 让前端能按地区/角色取图
    assets: safeAssets(cwd, name),
    chapterList: {
      count: chapters.length,
      truncated: chapters.length > MAX_CHAPTER_NODES,
      nodes: chapterNodes,
    },
  }
}

/**
 * 把各扇区的存在性汇总成一份「基础资产完成度」。
 *
 * 为什么不让前端自己数：扇区顺序是后端定义的（世界观→人设→大纲…），前端
 * 复制一份就会出现两处不一致。而且「章节」不在 ATLAS_SECTIONS 里，单独补一项
 * 才能让进度条的 7 项和实际能做的 7 件事对上。
 *
 * @param {Array<object>} sections - sectionTree 结果。
 * @param {number} chapterCount - 已有章节数。
 */
export function assetReadiness(sections, chapterCount = 0) {
  const items = sections.map((section) => ({
    key: section.key,
    label: section.label,
    // 判断「写好了」看正文字符数而不是标题数：伏笔.md / 世界状态.md 这类文档
    // 主体是表格，标题可能一个都没有，按 headings 判会把写好当成没写。
    exists: section.exists === true && (section.chars ?? 0) > 0,
    created: section.exists === true,
    headings: section.headings ?? 0,
    chars: section.chars ?? 0,
    truncated: section.truncated === true,
  }))
  items.push({
    key: 'chapters',
    label: '正文',
    exists: chapterCount > 0,
    created: chapterCount > 0,
    headings: chapterCount,
    chars: 0,
    truncated: false,
  })
  const done = items.filter((item) => item.exists).length
  return {
    items,
    done,
    total: items.length,
    percent: items.length === 0 ? 0 : Math.round((done / items.length) * 100),
    // 下一步该做什么：按顺序取第一个缺失项。前端据此给出一个可点的建议，
    // 而不是让用户自己判断「现在该跑哪条命令」。
    next: items.find((item) => !item.exists)?.key ?? null,
  }
}

/** 批量写作阶段的中文名，前端和回执共用一份，避免两边说法不一致。 */
export const BATCH_PHASE_LABELS = {
  running: '正在写',
  complete: '已完成',
  error: '出错停了',
  aborted: '已中止',
}

/**
 * 读项目根的批量写作状态文件。
 *
 * 文件不存在是正常情况（没跑过批量写作），返回 null 而不是空对象，让前端
 * 能区分「没跑过」和「跑过但字段缺失」。坏文件也当没跑过——进度面板属于
 * 辅助信息，不该因为一份手改坏的 JSON 就整块报错。
 *
 * @returns {null | {phase: string, phaseLabel: string, done: number, target: number, percent: number, requestSize: number, lastError: string, updatedAt: string, staleMs: number}}
 */
export function readBatchStatus(cwd, name, now = Date.now()) {
  let raw
  try {
    raw = fs.readFileSync(path.join(projectDir(cwd, name), BATCH_STATUS_FILE), 'utf8')
  } catch {
    return null
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const done = Number(parsed.done) || 0
  const target = Number(parsed.target) || 0
  const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
  const stamped = updatedAt ? Date.parse(updatedAt) : Number.NaN
  return {
    phase: typeof parsed.phase === 'string' ? parsed.phase : 'unknown',
    phaseLabel: BATCH_PHASE_LABELS[parsed.phase] ?? '状态未知',
    done,
    target,
    percent: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : null,
    requestSize: Number(parsed.requestSize) || 0,
    lastError: typeof parsed.lastError === 'string' ? parsed.lastError : '',
    updatedAt,
    // 上次更新距今多久。运行中的任务每写完一批就会更新，超过几分钟没动静
    // 通常意味着进程已经没了，前端可以据此把「正在写」降级成「可能已中断」。
    staleMs: Number.isFinite(stamped) ? Math.max(0, now - stamped) : null,
  }
}

/**
 * 资产台账读取失败绝不能拖垮设定树：没有插图就当作空列表。
 */
function safeAssets(cwd, name) {
  try {
    return listAssets({ projectDir: projectDir(cwd, name) }).assets ?? []
  } catch {
    return []
  }
}

function isAbsolute(directory) {  return pathWinIsAbsolute(String(directory).replace(/\\/gu, '/')) || pathWinIsAbsolute(String(directory))
}

function pathWinIsAbsolute(value) {
  return value.startsWith('/') || /^[A-Za-z]:[/\\]/u.test(value)
}

/**
 * 构建整个项目目录的设定树。
 *
 * @param {{ cwd?: string, projectsDirectory?: string }} options
 *   cwd：会话工作目录（相对型 projectsDir 以它为根）；projectsDir 为绝对路径时可省略。
 * @returns 项目树 JSON；无法定位项目根时返回带 error/message 的对象，不抛出。
 */
export function buildAtlas({ cwd = '', projectsDirectory = 'novel_projects' } = {}) {
  const rawCwd = typeof cwd === 'string' ? cwd.trim() : ''
  const usableCwd = rawCwd.length > 0 && rawCwd.length < 1024 && !rawCwd.includes('\0') && isAbsolute(rawCwd)
  const configured = typeof projectsDirectory === 'string' && projectsDirectory.trim() ? projectsDirectory.trim() : 'novel_projects'
  if (!usableCwd && !isAbsolute(configured)) {
    return {
      error: 'no-cwd',
      message: '无法定位 novel_projects：会话工作目录不可用，且插件设置里的 projectsDir 不是绝对路径。请在插件设置中指定绝对路径的项目目录。',
    }
  }
  try {
    return withProjectsDirectory(configured, () => {
      const names = listProjects(usableCwd ? rawCwd : '').slice(0, MAX_PROJECTS)
      const projects = names.map((name) => projectAtlas(usableCwd ? rawCwd : '', name))
      return {
        generatedAt: new Date().toISOString(),
        projectsDirectory: configured,
        defaultProject: latestProject(usableCwd ? rawCwd : '') ?? names[0] ?? null,
        projects,
      }
    })
  } catch (error) {
    return { error: 'atlas-failed', message: error?.message ?? String(error) }
  }
}
