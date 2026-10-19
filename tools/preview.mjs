/**
 * 把 client.js 里的 CSS 抽出来，配合真机渲染的 HTML 结构，生成一个可以截图
 * 的静态预览页。改视觉时用它对齐，比在真实界面里反复点开设置页快得多。
 *
 *   node tools/preview.mjs          生成 preview/ 下的几个页面
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const src = fs.readFileSync(path.join(root, 'client.js'), 'utf8')

// CSS 在 `const CSS = \`` 与下一行独占的反引号之间
const start = src.indexOf('const CSS = `') + 'const CSS = `'.length
const end = src.indexOf('\n`', start)
const CSS = src.slice(start, end)

const OUT = path.join(root, 'preview')
fs.mkdirSync(OUT, { recursive: true })

// ── 用真实组件渲染出 HTML ────────────────────────────────────────
const states = []
let si = 0
let loaded = null
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(initial) {
    const i = si++
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
    return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }]
  },
  useRef(initial) { return { current: initial } },
  useEffect(fn) { try { return fn() } catch { return undefined } },
  Fragment: 'fragment',
}

const ATLAS_PAYLOAD = {
  defaultProject: '长夜将至',
  projects: [{
    name: '长夜将至', title: '长夜将至',
    progress: { chapters: 5, goal: 12, chars: 23400 },
    readiness: {
      done: 5, total: 8, percent: 63, next: 'outline',
      items: [
        { key: 'setting', label: '世界观', exists: true, created: true, headings: 4, chars: 2100 },
        { key: 'cast', label: '人设', exists: true, created: true, headings: 6, chars: 3400 },
        { key: 'outline', label: '大纲', exists: false, created: false, headings: 0, chars: 0 },
        { key: 'worldstate', label: '世界状态', exists: false, created: false, headings: 0, chars: 0 },
        { key: 'foreshadow', label: '伏笔', exists: true, created: true, headings: 0, chars: 860 },
        { key: 'plot', label: '剧情树', exists: true, created: true, headings: 3, chars: 1400 },
        { key: 'rules', label: '写作规范', exists: true, created: true, headings: 2, chars: 900 },
        { key: 'chapters', label: '正文', exists: true, created: true, headings: 5, chars: 0 },
      ],
    },
    batch: { phase: 'running', phaseLabel: '正在写', done: 5, target: 12, percent: 42, requestSize: 2, lastError: '', updatedAt: new Date().toISOString(), staleMs: 12000 },
  }],
}

vm.runInNewContext(src, {
  window: { __ModuleLoader__: { load: bundle => { loaded = bundle } } },
  location: { reload() {} },
  document: { baseURI: 'http://localhost/', visibilityState: 'visible', hidden: false },
  URL, AbortController, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
  fetch: async () => ({ ok: true, status: 200, json: async () => ATLAS_PAYLOAD }),
})

const plugin = loaded.factory(() => React)
const slots = {}
plugin.apply({
  slots: { inject: (_, m) => m(), register: (meta, c) => { slots[meta.name] = slots[meta.name] ?? {}; slots[meta.name][meta.key ?? meta.id] = c; return () => {} } },
  sidebarRightTabs: { register: () => () => {} },
  effect: () => {},
  remote: {},
})

const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * React 的 SVG 属性写法转成浏览器认的名字。
 *
 * 规则不是简单的「驼峰转短横线」：viewBox / preserveAspectRatio / gradientTransform
 * 这类在 HTML 里本来就是驼峰，转成 view-box 浏览器完全不认，整个 SVG 的坐标系
 * 就没了（预览里表现为进度弧彻底消失）。只有 strokeDasharray 这种确实以短横线
 * 存在的才需要转换。这一份是规范里的驼峰名单，其余一律转短横线。
 */
const SVG_CAMEL = new Set([
  'viewBox', 'preserveAspectRatio', 'gradientTransform', 'gradientUnits', 'patternTransform',
  'patternUnits', 'patternContentUnits', 'clipPathUnits', 'maskUnits', 'maskContentUnits',
  'textLength', 'lengthAdjust', 'spreadMethod', 'startOffset', 'markerWidth', 'markerHeight',
  'markerUnits', 'refX', 'refY', 'filterUnits', 'primitiveUnits', 'baseFrequency', 'numOctaves',
  'stdDeviation', 'surfaceScale', 'specularConstant', 'specularExponent', 'diffuseConstant',
  'kernelMatrix', 'kernelUnitLength', 'tableValues', 'targetX', 'targetY', 'pathLength',
  'attributeName', 'attributeType', 'repeatCount', 'repeatDur', 'keyPoints', 'keySplines',
  'keyTimes', 'calcMode',
])

function svgAttr(name) {
  if (SVG_CAMEL.has(name)) return name
  if (name.includes('-')) return name
  return name.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}

// 把 hyperscript 树转成 HTML：只处理样式足够用的子集
function toHtml(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (Array.isArray(node)) return node.map(toHtml).join('')
  if (typeof node !== 'object') return escape(node)
  if (typeof node.type === 'function') return toHtml(node.type({ ...node.props, children: node.children }))
  if (node.type === 'fragment') return (node.children ?? []).map(toHtml).join('')
  const { className, style, ...rest } = node.props ?? {}
  const attrs = []
  if (className) attrs.push(`class="${escape(className)}"`)
  if (style) attrs.push(`style="${Object.entries(style).map(([k, v]) => `${k.startsWith('--') ? k : k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';')}"`)
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || v === null || v === false) continue
    // 事件处理器、React 内部字段不进 HTML。其余属性一律保留 —— 早先只放行
    // 白名单，结果 SVG 的 viewBox/d/stroke 和 data-state 全被丢掉，预览里
    // 环形图和状态图标消失，还以为是自己 CSS 写错了。
    if (typeof v === 'function' || k === 'children' || k === 'key' || k === 'ref') continue
    attrs.push(`${svgAttr(k)}="${escape(v)}"`)
  }
  const inner = toHtml(node.children)
  // SVG 里的空元素必须自闭合。写成 `<circle ...>` 时 HTML 解析器会把它当
  // 普通开标签，后面的兄弟节点全被吞成子节点 —— 表现为「环形背景在、进度弧
  // 不见」，而且 getBBox 返回 0，极难反推。
  const voidTags = new Set(['input', 'img', 'br', 'hr', 'circle', 'path', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'use', 'stop'])
  if (voidTags.has(node.type)) return `<${node.type} ${attrs.join(' ')}/>`
  return `<${node.type} ${attrs.join(' ')}>${inner}</${node.type}>`
}

const useSessions = () => undefined
si = 0
const progressBody = slots['sidebar.right.pane.tab']['dsh-novel-master/progress']
progressBody({ sessionId: 's1', useSessions })
await new Promise(r => setTimeout(r, 60))
si = 0
const progressHtml = toHtml(progressBody({ sessionId: 's1', useSessions }))

// 设置页：拿真实的 tab 与卡片结构
si = 0
const page = slots['settings.section']['novel-master']
const settingsHtml = toHtml(page({}))

const shell = (title, body, extra = '', dark = true) => `<!doctype html>
<html lang="zh-CN" data-theme="${dark ? 'dark' : 'light'}"><head>
<meta charset="utf-8"><title>${title}</title>
<style>
/* 模拟宿主的主题变量。真实环境里这些由 DSH 提供，这里按官方深色/浅色各给一套。 */
:root{color-scheme:${dark ? 'dark' : 'light'};--dsw-alias-bg-layer-1:${dark ? '#0f1115' : '#ffffff'};--dsw-alias-bg-layer-2:${dark ? '#161a21' : '#f7f8fa'};--dsw-alias-bg-layer-3:${dark ? '#1c222b' : '#eef0f4'};--dsw-alias-bg-overlay:${dark ? '#1c222b' : '#ffffff'};--dsw-alias-label-primary:${dark ? '#e8ebf0' : '#16181d'};--dsw-alias-label-secondary:${dark ? '#939bab' : '#5f6674'};--dsw-alias-border-l2:${dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)'};--dsw-alias-brand-primary:#6b8ff0;--dsw-alias-state-business-primary:#6b8ff0;--dsw-alias-state-success-primary:${dark ? '#3fbf8f' : '#1f8f66'};--dsw-alias-state-error-primary:${dark ? '#f0717a' : '#c84d55'}}
*{box-sizing:border-box}
body{margin:0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
${CSS}
${extra}
</style></head><body>${body}</body></html>`

// 侧边栏宽度按真实值（约 330px）来，才能判断排版是否挤
fs.writeFileSync(path.join(OUT, 'progress-dark.html'),
  shell('生成进度 · 深色', `<div style="width:330px;height:720px;background:var(--dsw-alias-bg-layer-1)">${progressHtml}</div>`), 'utf8')
fs.writeFileSync(path.join(OUT, 'progress-light.html'),
  shell('生成进度 · 浅色', `<div style="width:330px;height:720px;background:var(--dsw-alias-bg-layer-1)">${progressHtml}</div>`, '', false), 'utf8')
fs.writeFileSync(path.join(OUT, 'settings-dark.html'), shell('设置页 · 深色', settingsHtml), 'utf8')
fs.writeFileSync(path.join(OUT, 'settings-light.html'), shell('设置页 · 浅色', settingsHtml, '', false), 'utf8')

console.log('已生成:')
for (const f of fs.readdirSync(OUT)) console.log('  preview/' + f)
