import fs from 'node:fs'
import path from 'node:path'

/**
 * 视觉规范化：把散落的手调值收敛成一套阶梯。
 *
 * 只做「同名同义」的机械替换，不碰布局和逻辑。每一条都打印改动计数，
 * 数字对不上就说明模式写错了，宁可停下来看也不要盲改。
 */
const FILE = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..', 'client.js')
let src = fs.readFileSync(FILE, 'utf8')

const m = src.match(/(const CSS = `)([\s\S]*?)(`\n)/)
if (!m) throw new Error('找不到 CSS 模板')
let css = m[2]
const report = []
const bump = (label, n) => report.push(`${String(n).padStart(4)}  ${label}`)

// ── 1. 圆角收敛到 6 / 10 / 14 / 20 ＋ 三个功能值 ──────────────────────────
// 手调的 7/9/11/13/15 在视觉上分辨不出来，只会让声明散乱。
const RADIUS = { 3: 4, 5: 6, 7: 6, 9: 10, 11: 10, 13: 14, 15: 14, 16: 14, 18: 14, 24: 20, 22: 20 }
let nRadius = 0
css = css.replace(/border-radius:\s*([\d.]+)px/g, (all, px) => {
  const to = RADIUS[px]
  if (!to) return all
  nRadius++
  return `border-radius:${to}px`
})
bump('圆角收敛（px 手调值 → 阶梯）', nRadius)

// ── 2. transition: all → 明确属性 ─────────────────────────────────────────
// `all` 会把 font-weight、border-width 一起插值，中文 hover 时能看到重排。
const T_PROPS = 'background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)'
let nTrans = 0
css = css.replace(/transition:\s*all\s+[^;}]+/g, () => {
  nTrans++
  return `transition:${T_PROPS}`
})
bump('transition:all → 显式属性列表', nTrans)

// ── 3. 去掉静态区块的 hover 上浮 ──────────────────────────────────────────
// 卡片不是可点元素，浮起来会让整屏「呼吸」，也误导点击预期。
let nLift = 0
css = css.replace(/(\.nm-settings \.(?:nm-feature|nm-quick-card|nm-pipeline-step|nm-logo)[^{]*:hover)\{transform:translateY\(-?\d+px\);?/g, (all, sel) => {
  nLift++
  return `${sel}{`
})
bump('移除静态卡片的 hover 上浮', nLift)

// 单独处理散落的 translateY(-2px) 于非交互卡
const beforeLift = css
css = css.replace(/\.nm-settings \.nm-logo:hover\{transform:translateY\(-?\d+px\);/g, '.nm-settings .nm-logo:hover{')
bump('移除 logo hover 上浮', beforeLift === css ? 0 : 1)

// ── 4. 卡片边框 → 0.5px 边环 + 双阴影 ─────────────────────────────────────
// 深色下 1px 实色边框在任何底色上都一样硬；0.5px 边环在 2x 屏是 1 物理像素。
// 这里必须逐字替换整条声明 —— 之前用 `linear-gradient\([^}]*?\)` 想省事，
// 结果非贪婪匹配在 color-mix 的第一个 `)` 就收尾，把背景值切成了残渣。
const CARD_RING = 'border:0;box-shadow:var(--nm-ring),0 1px 2px color-mix(in srgb,var(--nm-text) 7%,transparent),0 8px 24px -12px color-mix(in srgb,var(--nm-text) 20%,transparent)'
const CARD_OLD = 'border:1px solid var(--nm-border);border-radius:20px;background:linear-gradient(180deg,color-mix(in srgb,var(--nm-card) 98%,white 1%),var(--nm-card));box-shadow:0 4px 20px -6px color-mix(in srgb,CanvasText 6%,transparent)'
const CARD_NEW = `${CARD_RING};border-radius:20px;background:var(--nm-card)`
let nCard = 0
if (css.includes(CARD_OLD)) { css = css.replace(CARD_OLD, CARD_NEW); nCard = 1 }
bump('卡片改边环 + 双阴影', nCard)

// 卡片 hover 不再改描边色（静态区不该提示可点），只加深阴影
const CARD_HOVER_OLD = '.nm-settings .nm-card:hover{box-shadow:0 8px 28px -6px color-mix(in srgb,CanvasText 9%,transparent);border-color:color-mix(in srgb,var(--nm-accent) 20%,var(--nm-border))}'
const CARD_HOVER_NEW = '.nm-settings .nm-card:hover{box-shadow:var(--nm-ring),0 2px 4px color-mix(in srgb,var(--nm-text) 8%,transparent),0 14px 32px -14px color-mix(in srgb,var(--nm-text) 24%,transparent)}'
let nHover = 0
if (css.includes(CARD_HOVER_OLD)) { css = css.replace(CARD_HOVER_OLD, CARD_HOVER_NEW); nHover = 1 }
bump('卡片 hover 去掉强调色描边', nHover)

// ── 5. 小字对比度：caption 一律用 secondary ───────────────────────────────
// label-caption 在白底只有 2.13:1，11-12px 完全读不清。
let nCap = 0
css = css.replace(/var\(--nm-caption\)/g, () => { nCap++; return 'var(--nm-muted)' })
bump('caption 色 → secondary（提升小字对比度）', nCap)

src = src.slice(0, m.index) + m[1] + css + m[3] + src.slice(m.index + m[0].length)
fs.writeFileSync(FILE, src, 'utf8')

console.log('改动统计：')
for (const r of report) console.log('  ' + r)
const left = { radius: (css.match(/border-radius:[\d.]+px/g) || []).length, all: (css.match(/transition:\s*all/g) || []).length }
console.log('\n剩余 数值圆角:', left.radius, '| 剩余 transition:all:', left.all)
