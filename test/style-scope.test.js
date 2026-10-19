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
const CSS = SOURCE.match(/const CSS = `([\s\S]*?)`\n/)[1]

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

test('世界生成区块图使用官方区块状态色', () => {
  // 取自 Minecraft Wiki 的区块状态色表。用同一色会把图退化成普通点阵，
  // 这是「世界生成」这个隐喻能否成立的关键。
  const m = CSS.match(/\.nm-world\{([^}]*)\}/)
  assert.ok(m, '必须存在 .nm-world 规则')
  for (const hex of ['#80B252', '#D1D1D1', '#5F6191', '#303572', '#726809', '#21C600', '#FFE0A0']) {
    assert.ok(SOURCE.includes(hex), `缺少官方区块色 ${hex}`)
  }
})

test('未生成格子要与背景区分得开', () => {
  const empty = CSS.match(/\.nm-world-grid i\[data-state=empty\]\{([^}]*)\}/)
  const missing = CSS.match(/\.nm-world-grid i\[data-state=missing\]\{([^}]*)\}/)
  assert.ok(empty && missing, '未生成的两档都要有样式')
  // 早先用 #3a3a2a / #2a2a2a，在近黑底上糊成一片，看着像没画出来
  for (const [name, decl] of [['empty', empty[1]], ['missing', missing[1]]]) {
    assert.doesNotMatch(decl, /#3a3a2a|#2a2a2a|background:#000/, `${name} 不能是近黑色`)
    assert.match(decl, /color-mix|#[0-9a-f]{6}/i, `${name} 要有可见的亮度`)
  }
})

test('区块格子不用圆角，保住方块语感', () => {
  const m = CSS.match(/\.nm-world-grid i\{([^}]*)\}/)
  assert.ok(m, '必须存在格子规则')
  const radius = m[1].match(/border-radius:([^;]+)/)
  assert.ok(radius, '应显式声明圆角')
  // 允许 0–2px：1px 是为了消除方块边缘的抗锯齿毛边，视觉上仍是直角。
  // 一旦上到常见的 6/8/12px，格子就变成圆点阵，方块语感整个丢掉。
  const px = Number(radius[1].replace(/[^\d.]/g, ''))
  assert.ok(px <= 2, `圆角必须是 2px 以内，当前 ${radius[1]}`)
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
