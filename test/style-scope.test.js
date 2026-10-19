import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

/**
 * 样式作用域与覆盖规则。
 *
 * 这一组针对一个真实踩过的坑：`.nm-settings button`（优先级 0,1,1）会盖掉
 * 单独写的 `.nm-help-btn`（0,1,0）。表现是圆形按钮变成圆角方形、问号被
 * padding 挤得偏右上 —— 光看 CSS 里写着 border-radius:50% 完全看不出问题，
 * 必须把「选择器优先级」本身当成可断言的对象。
 */
const SOURCE = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
// 换行可能是 LF 也可能是 CRLF —— Windows 上 git 检出会转成 CRLF，
// 正则只写 `\n` 会在 CRLF 工作副本上整体失配，报成「找不到 CSS」。
const CSS = SOURCE.match(/const CSS = `([\s\S]*?)`\r?\n/)[1]

/** 粗略计算选择器优先级：[id, class, tag] 三元组，够用于本文件的判断。 */
function specificity(selector) {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length
  const classes = (selector.match(/\.[\w-]+/g) ?? []).length
  const tags = (selector.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length
  return [ids, classes, tags]
}

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

test('信息性小按钮的选择器要能压过 .nm-settings button', () => {
  const generic = specificity('.nm-settings button')
  const specific = specificity('.nm-settings .nm-help-btn')
  assert.ok(
    compare(specific, generic) > 0,
    `.nm-help-btn 必须带上 .nm-settings 前缀，否则 border-radius 与 padding 被通用按钮规则覆盖（当前比不过 ${generic.join(',')}）`,
  )
})

test('帮助按钮是正圆且不被通用按钮内边距撑变形', () => {
  const m = CSS.match(/\.nm-settings \.nm-help-btn\{([^}]*)\}/)
  assert.ok(m, '必须存在 .nm-settings .nm-help-btn 规则')
  const decl = m[1]
  assert.match(decl, /border-radius:50%/, '必须是正圆')
  assert.match(decl, /width:34px;height:34px/, '宽高必须相等，否则不是正圆')
  // 通用按钮的 9px 16px 内边距会把问号挤偏，必须显式压回 0
  assert.match(decl, /padding:0 0 1px/, '内边距必须清零（保留 1px 做光学微调）')
  assert.match(decl, /line-height:1\b/, '必须写 line-height:1，否则字框高于圆形导致偏心')
})

test('帮助按钮不再带旋转变形', () => {
  assert.doesNotMatch(CSS, /\.nm-help-btn:hover\{[^}]*rotate\(/u, 'hover 不应旋转按钮')
})

test('地貌画布有底色与内边框，不是透明浮在面板上', () => {
  // 等高线是细亮线，必须落在明确的深底上才读得出层次。没有底色时
  // 线条看起来像直接描在面板上，整块区域没有「这是张地图」的边界感。
  const m = CSS.match(/\.nm-terra-canvas\{([^}]*)\}/)
  assert.ok(m, '必须存在 .nm-terra-canvas 规则')
  assert.match(m[1], /background:/, '画布要有底色')
  assert.match(m[1], /aspect-ratio:1/, '画布要接近正方，地形图不能是窄条')
})

test('等高线只描边，不能整片填充', () => {
  // 试过给每层做半透明填充：11 层同色叠起来，中间糊成一坨实心圆饼，
  // 等高线全被盖住。高程的观感必须来自「线的疏密」—— 地形图本来就是
  // 靠间距读坡度的。这条测试锁住「只画线」这个决定。
  assert.match(SOURCE, /fill: 'none'/, '等高线路径必须是 fill:none')
  assert.doesNotMatch(SOURCE, /fill: terraColor/, '不能拿高程色整片填充')
})

test('地形场必须有域扭曲，否则等高线会收成同心环', () => {
  // 前几版都是洋葱：一圈套一圈的规整环。根源是高度场以径向掩膜为主。
  // 必须先扭曲采样坐标再取噪声，山脊才会弯、会分叉、会出现鞍部。
  assert.match(SOURCE, /domain warp|域扭曲/, '需要域扭曲')
  const warp = SOURCE.match(/const wx = x \+ ([\d.]+) \* \(terraNoise/)
  assert.ok(warp, '采样点必须被噪声推开')
  assert.ok(Number(warp[1]) >= 20, `扭曲幅度需 ≥20 格才打散得开，当前 ${warp[1]}`)
})

test('海岸线不能被纯径向收缩，否则外圈仍是同心圆', () => {
  // 掩膜一旦是纯 r，等值线收到边界必然收成圆。必须把半径本身推歪，
  // 形成半岛与海湾，边界那一圈才跟着歪。
  assert.match(SOURCE, /const coast = /, '需要海岸线扰动项')
  assert.match(SOURCE, /const r = Math\.hypot\(nx, ny\) \+ coast/, '半径要叠加海岸扰动')
})

test('揭示范围随进度扩张，且用面积映射', () => {
  // 语义是「一块已探明的地域在扩大」：地形完整存在，进度决定看清多少。
  // 半径若按线性映射，前 20% 只覆盖 4% 面积，观感上像卡住不动。
  const m = SOURCE.match(/const reach = Math\.sqrt\(pct\) \* S \* ([\d.]+)/)
  assert.ok(m, '揭示半径必须用 sqrt 映射面积')
  // 系数要留边：给满 1.0 时 100% 会有半圈超出画布
  assert.ok(Number(m[1]) <= 0.9, `半径系数需留边，当前 ${m[1]}`)
})

test('进度面板自己注入样式，不依赖设置页', () => {
  // 侧边栏页签独立渲染时设置页并不存在。早先样式只在设置页注入，
  // 结果进度面板是一坨裸的圆点列表。
  const body = SOURCE.slice(SOURCE.indexOf('function ProgressBody'))
  const frame = body.slice(0, body.indexOf('function ProgressTitle'))
  assert.match(frame, /h\('style', null, CSS\)/, 'ProgressBody 必须注入 CSS')
  // 所有返回分支都要走同一个包裹，否则出错态/空态会漏掉样式
  const rawReturns = [...frame.matchAll(/return h\('div', \{ className: 'nm-atlas nm-prog'/g)]
  assert.equal(rawReturns.length, 0, '不应有绕过 frame 直接返回的分支')
})

test('面板子块不许被 flex 压缩，否则会互相叠住', () => {
  // flex 容器的 flex-shrink 默认是 1。侧边栏高度不够时，地图、环形卡、
  // 清单会按比例一起被压扁，视觉上表现为「正文 40/40 章」那行插进清单
  // 中间、压住「伏笔」「剧情树」。必须先钉死子块高度，再让外层滚动。
  assert.match(CSS, /\.nm-prog > \*\{flex:0 0 auto\}/, '必须有 .nm-prog > *{flex:0 0 auto}')
  assert.match(CSS, /\.nm-prog\{[^}]*overflow-y:auto/, '溢出交给 .nm-prog 自己滚')
})

test('中间区块与页脚都不能用 auto 外边距抢高度', () => {
  // flex:1 + min-height:0 会把容器压到「剩余空间」，内容溢出后盖住下一个
  // 元素；margin-top:auto 在剩余高度为负时同理。两者都会造成重叠。
  const sections = CSS.match(/\.nm-prog-sections\{([^}]*)\}/)
  assert.ok(sections, '必须有 .nm-prog-sections 规则')
  assert.doesNotMatch(sections[1], /flex:1(?!\d)/, '不能再用 flex:1')
  assert.doesNotMatch(sections[1], /min-height:0/, 'min-height:0 会允许被压到更矮')

  const foot = CSS.match(/\.nm-prog-foot\{([^}]*)\}/)
  assert.ok(foot, '必须有 .nm-prog-foot 规则')
  assert.doesNotMatch(foot[1], /margin-top:auto/, '页脚不能用 auto 外边距')
})
