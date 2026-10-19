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
// 重新渲染一个组件前要把下标归零，否则 hook 槽位会往后错。
// 但**不能清空 states** —— 进度面板的数据正是靠 effect 里的 setState 灌进来的，
// 清掉就退回到首帧的空状态，截图只剩一个空壳。
const rewindHooks = () => { si = 0 }
// 第二轮重画时把 useEffect 关掉：组件的 effect 返回清理函数会置
// alive.current=false，重跑会让上一轮请求的回调自我否决，数据永远落不了地。
let silentHooks = false
let loaded = null
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(initial) {
    const i = si++
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
    return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }]
  },
  useRef(initial) { return { current: initial } },
  useEffect(fn) { if (silentHooks) return; try { return fn() } catch { return undefined } },
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

/**
 * 设置接口的响应形状：`{ value, revision }`。字段名要跟 client.js 里读的一致，
 * 否则缺哪个字段界面就少一块 —— 预览看不出是「设计如此」还是「数据没给」。
 */
const SETTINGS_PAYLOAD = {
  revision: 7,
  value: {
    enabled: true,
    projectsDir: 'novel_projects',
    updateProxy: '',
    commands: {},
    guidance: { enabled: false },
    learning: { enabled: false },
    decision: { enabled: false },
    research: { enabled: false },
    batch: { enabled: false },
    persona: { enabled: false, draft: '' },
    image: { enabled: false },
  },
}

vm.runInNewContext(src, {
  window: { __ModuleLoader__: { load: bundle => { loaded = bundle } } },
  location: { reload() {} },
  document: { baseURI: 'http://localhost/', visibilityState: 'visible', hidden: false },
  URL, AbortController, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
  // 按路径分发。早先一律返回 ATLAS_PAYLOAD，设置页请求 settings/status 时
  // 拿到的是项目数据，字段全对不上，渲染出一条空的成功提示 —— 看着像产品
  // 有 bug，其实是 mock 在乱喂数据。
  fetch: async (url) => {
    const u = String(url)
    const pick = u.includes('atlas') ? ATLAS_PAYLOAD
      : u.includes('status') ? { version: '2.10.0', enabled: true, application: 'idle' }
      : u.includes('settings') ? SETTINGS_PAYLOAD
      : {}
    return { ok: true, status: 200, json: async () => pick }
  },
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
const progressBody = slots['sidebar.right.pane.tab']['dsh-novel-master/progress']
// 两趟渲染：第一趟跑 effect 把请求发出去，等数据回来；第二趟带着已落地的
// 状态重新画一遍。这里只归位下标，不清状态槽 —— 进度面板的内容就存在里面。
rewindHooks()
progressBody({ sessionId: 's1', useSessions })
await new Promise(r => setTimeout(r, 80))
rewindHooks()
const progressHtml = toHtml(progressBody({ sessionId: 's1', useSessions }))

// 设置页：拿真实的 tab 与卡片结构。
// 状态槽必须清空（否则会读到进度面板存下的 payload），但清空后要重新跑一遍
// effect 把数据灌回来 —— 只清不跑，页面就是一屏空卡片。
// 注意第二轮不能再跑 effect：组件里的 effect 会 alive.current=false 清理，
// 重跑会让第一轮已发出的请求在回调里自我否决，数据永远落不了地。
states.length = 0
rewindHooks()
const page = slots['settings.section']['novel-master']
// 注册进来的是 `props => h(SettingsPage, {...props, ctx})`。toHtml 第 149 行
// 遇到函数型 type 会自己调一次，所以这里直接把元素交给它，不要再手工展开。
//
// 首轮必须真的走一遍 toHtml —— 只调 page({}) 拿到的是「待渲染元素」，
// 组件函数压根没执行，effect 不会触发，等多久都等不到数据。渲染产物丢掉即可，
// 目的是让请求发出去、setState 落进状态槽；第二轮重画才能读到。
const mountSettings = () => {
  rewindHooks()
  return page({})
}
toHtml(mountSettings())         // 第一趟：真正渲染一次，触发 effect 与请求
await new Promise(r => setTimeout(r, 200))
const settingsHtml = toHtml(mountSettings())

/**
 * 宿主主题令牌 —— 必须从 app.asar 里读真值，不能手打。
 *
 * 早先这里写的是一组手挑的占位色，其中 `--dsw-alias-brand-primary:#6b8ff0`
 * 恰好是蓝色，而宿主真实值是中性色（浅色 #0f1115 / 深色 #f9fafb）。于是
 * 「插件强调色在真机上全部退化成黑白」这个 bug 被预览完整地掩盖了整整一轮。
 * 预览环境不忠实，看图越满意，离真机越远。
 */
const tokens = JSON.parse(fs.readFileSync(path.join(OUT, 'tokens.json'), 'utf8'))

const hostVars = (dark) => {
  const t = tokens[dark ? 'dark' : 'light']
  const map = {
    'bg-base': 'bg-base',
    'bg-layer-1': 'bg-layer-1',
    'bg-layer-2': 'bg-layer-2',
    'bg-layer-3': 'bg-layer-3',
    'bg-overlay': 'bg-overlay',
    'label-primary': 'label-primary',
    'label-secondary': 'label-secondary',
    'label-tertiary': 'label-tertiary',
    'label-caption': 'label-caption',
    'border-l1': 'border-l1',
    'border-l2': 'border-l2',
    'border-l3': 'border-l3',
    'border-l4': 'border-l4',
    'state-business-primary': 'state-business-primary',
    'state-success-primary': 'state-success-primary',
    'state-error-primary': 'state-error-primary',
    'link': 'link',
    'brand-primary': 'brand-primary',
  }
  return Object.entries(map)
    .filter(([, key]) => t[key])
    .map(([css, key]) => `--dsw-alias-${css}:${t[key]}`)
    .join(';')
}

const shell = (title, body, extra = '', dark = true) => `<!doctype html>
<html lang="zh-CN" data-theme="${dark ? 'dark' : 'light'}"><head>
<meta charset="utf-8"><title>${title}</title>
<style>
/* 宿主主题变量：全部来自 app.asar 实测值（preview/tokens.json）。 */
:root{color-scheme:${dark ? 'dark' : 'light'};${hostVars(dark)}}
*{box-sizing:border-box}
body{margin:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
${CSS}
${extra}
</style></head><body>${body}</body></html>`

// 侧边栏宽度按真实值（约 330px）来，才能判断排版是否挤
fs.writeFileSync(path.join(OUT, 'progress-dark.html'),
  shell('生成进度 · 深色', `<div style="width:330px;height:720px;background:var(--dsw-alias-bg-base)">${progressHtml}</div>`), 'utf8')
fs.writeFileSync(path.join(OUT, 'progress-light.html'),
  shell('生成进度 · 浅色', `<div style="width:330px;height:720px;background:var(--dsw-alias-bg-base)">${progressHtml}</div>`, '', false), 'utf8')
fs.writeFileSync(path.join(OUT, 'settings-dark.html'), shell('设置页 · 深色', settingsHtml), 'utf8')
fs.writeFileSync(path.join(OUT, 'settings-light.html'), shell('设置页 · 浅色', settingsHtml, '', false), 'utf8')

console.log('已生成:')
for (const f of fs.readdirSync(OUT)) console.log('  preview/' + f)
