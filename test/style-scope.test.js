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

test('未生成区必须接近纯黑，与已生成区拉开亮度', () => {
  // 参考画面里约三分之二是纯黑。未生成区如果发灰，整张图就失去
  // 「还没长出来」的对比，看着像一片均匀的贴图。
  const dim1 = CSS.match(/\.nm-world-map i\[data-dim="1"\]\{([^}]*)\}/)
  const dim2 = CSS.match(/\.nm-world-map i\[data-dim="2"\]\{([^}]*)\}/)
  assert.ok(dim1 && dim2, '未生成的两档都要有样式')
  // 最深一档必须是纯黑：参考画面的底就是黑的
  assert.match(dim2[1], /#000\b/i, '最深一档应为纯黑')
  // 紧贴已生成区的那一档只能极暗，不能到中灰
  const hex = dim1[1].match(/#([0-9a-f]{6})/i)
  assert.ok(hex, '需为十六进制色')
  const lum = parseInt(hex[1].slice(0, 2), 16) + parseInt(hex[1].slice(2, 4), 16) + parseInt(hex[1].slice(4, 6), 16)
  assert.ok(lum < 120, `紧邻生成区的那档必须很暗（当前总和 ${lum}），否则边界看着像画的线`)
})

test('地图格数够密，且区块之间不留缝', () => {
  // 真实加载屏里区块是紧贴的。加缝隙会立刻从「地形」变成「点阵图」。
  assert.match(SOURCE, /const SIZE = (?:2[4-9]|3\d)/, '地图边长至少 24 格，太粗就变成色卡')
  const map = CSS.match(/\.nm-world-map\{([^}]*)\}/)[1]
  assert.doesNotMatch(map, /gap:/, '不能有缝隙，区块是紧贴的')
  assert.doesNotMatch(map, /padding:/, '不能有内边距，否则外圈多出一道框')
})

test('彩色必须是极小比例，不能变成迷彩', () => {
  // 第一次按参考重做时把阈值定低了，绿紫铺满整片，读起来像迷彩服。
  // 参考画面里 1032 格中彩色不到十格 —— 密度本身就是这个效果的关键。
  const biome = SOURCE.match(/if \(n > ([\d.]+) && n2 > ([\d.]+)\) color = BIOME/)
  const struct = SOURCE.match(/else if \(n < ([\d.]+) && n2 > ([\d.]+)\) color = STRUCT/)
  assert.ok(biome && struct, '生物群系与结构的判定必须存在')
  assert.ok(Number(biome[1]) >= 0.8, `生物群系阈值需 ≥0.8，当前 ${biome[1]}`)
  assert.ok(Number(struct[1]) <= 0.2, `结构阈值需 ≤0.2，当前 ${struct[1]}`)
})

test('地形用噪声塑形，不能是按距离分层的同心方框', () => {
  // 只按「离中心多远」上色会渲成靶心：一圈套一圈的规整方框，
  // 完全不像地形。必须有噪声参与且权重足够大才能打散成斑块。
  assert.match(SOURCE, /valueNoise/, '需要值噪声')
  // 注意要抓含 dist 的那一行：文件里还有一个同名的表单辅助函数 field，
  // 用 /const field = / 会先命中它，取出来的权重是 NaN。
  const field = SOURCE.match(/const field = dist \* ([\d.]+) \+ fieldAt\([^)]*\) \* ([\d.]+)/)
  assert.ok(field, '必须用 dist 与噪声场混合出 field')
  const noiseWeight = Number(field[2])
  assert.ok(noiseWeight >= 0.3, `噪声权重需 ≥0.3 才能打散同心感，当前 ${noiseWeight}`)
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
