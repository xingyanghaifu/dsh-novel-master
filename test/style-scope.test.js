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

test('地图不再画高程场和等高线', () => {
  // 这一整块是用程序噪声编出来的地形，和作者的设定无关。
  // 删掉之后不许再悄悄长回来 —— 伪造的地形比空白更糟，
  // 空白表示「这里还没设定」，编出来的山会被当成设定的一部分。
  for (const gone of ['terraLayers', 'terraContour', 'terraNoise', 'terraColor']) {
    assert.doesNotMatch(SOURCE, new RegExp(`function ${gone}\\(`), `不该再有 ${gone}`)
  }
  assert.doesNotMatch(SOURCE, /domain warp|域扭曲/u, '不该再有域扭曲')
  // 只认这条具体表达式。`const coast = []` 在别处还有一个无关的
  // 同名局部变量，按 /const coast = / 断言会误伤。
  assert.doesNotMatch(SOURCE, /const r = Math\.hypot\(nx, ny\) \+ coast/u, '不该再有海岸线扰动')
})

test('地图只画地区多边形和地名', () => {
  // 图上每一样东西都必须对应 『地区.md』 里的一行
  assert.match(SOURCE, /className: 'nm-terra-cells'/, '要画地貌块')
  assert.match(SOURCE, /className: 'nm-terra-sites'/, '要画地名')
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
