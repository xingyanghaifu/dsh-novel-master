import fs from 'node:fs'
import path from 'node:path'

/**
 * 从 DSH 宿主包里把真实的主题令牌抽出来，写成 preview/tokens.json。
 *
 * 之前 tools/preview.mjs 里的颜色是我手打的占位值 —— 其中
 * `--dsw-alias-brand-primary:#6b8ff0` 恰好是蓝色，而宿主真实值是中性色，
 * 于是把「强调色全变黑白」这个 bug 完整地掩盖掉了。预览环境一旦不忠实，
 * 看着再漂亮也只是自欺欺人。
 */
const ASAR = 'E:\\deepseek dsh\\resources\\app.asar'
const fd = fs.openSync(ASAR, 'r')
const size = fs.fstatSync(fd).size

function read(offset, length) {
  const buf = Buffer.alloc(length)
  fs.readSync(fd, buf, 0, length, offset)
  return buf.toString('utf8')
}

// 定位 design-platform.css：静态调色板 + 两套别名都在同一段里
let anchor = -1
const probe = Buffer.from('--dsw-static-deepseek-450', 'utf8')
for (let off = 0; off < size && anchor < 0; off += 8 * 1024 * 1024) {
  const len = Math.min(8 * 1024 * 1024 + probe.length, size - off)
  const chunk = Buffer.alloc(len)
  fs.readSync(fd, chunk, 0, len, off)
  const i = chunk.indexOf(probe)
  if (i !== -1) anchor = off + i
}
if (anchor < 0) throw new Error('找不到 design-platform.css')

// 这一段大约 40KB 足够覆盖调色板与两套别名
const region = read(Math.max(0, anchor - 2000), 90000)
fs.closeSync(fd)

// 这段代码是打包后的 JS，注释里也有大括号（例如 `//#region ...{...}`），
// 用括号配对去找内层声明会跑偏。改成：从每个选择器的 `{` 起，一直取到
// 该选择器声明块结束的 `}`，步进时只认「成对出现在同一层」的花括号。
function blockAfter(index) {
  const open = region.indexOf('{', index)
  if (open < 0) return ''
  let depth = 0
  for (let j = open; j < region.length; j++) {
    const c = region[j]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return region.slice(open + 1, j)
    }
  }
  return ''
}

function decls(css) {
  const out = {}
  for (const part of css.split(';')) {
    const idx = part.indexOf(':')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (!k.startsWith('--dsw-')) continue
    // 去掉 `--dsw-` 之后还要再去掉 `alias-` / `static-` 这一层分类前缀，
    // 否则拿 `bg-base` 去查表永远查不到 —— 值全是 undefined，而且是静默的。
    out[k.replace(/^--dsw-(?:alias-|static-)/, '')] = v
  }
  return out
}

// 静态调色板：body{...} 与 body[data-ds-dark-theme]{...} 两段
const lightStatic = decls(blockAfter(region.indexOf('design_platform_css_default')))
const darkOverride = decls(blockAfter(region.indexOf('body[data-ds-dark-theme]')))

// 别名：浅色在 body{--dsw-alias-bg-base...}，深色在 data-ds-dark-theme 之后
const lightAlias = decls(blockAfter(region.indexOf('body{--dsw-alias-bg-base')))
// 深色别名块在第二个 data-ds-dark-theme 之后（第一个是静态色覆盖）
const firstDark = region.indexOf('body[data-ds-dark-theme]')
const darkAlias = decls(blockAfter(region.indexOf('body[data-ds-dark-theme]', firstDark + 1)))

// 只保留插件实际用到的别名，避免产出一个巨大的文件
const WANTED = [
  'bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-layer-3', 'bg-overlay', 'bg-raised',
  'border-l1', 'border-l2', 'border-l3', 'border-l4',
  'label-primary', 'label-secondary', 'label-tertiary', 'label-caption',
  'brand-primary', 'brand-text', 'state-business-primary', 'state-success-primary',
  'state-error-primary', 'state-warning-primary', 'link',
]

function resolvePalette(aliases, dark) {
  const statics = dark ? { ...lightStatic, ...darkOverride } : lightStatic
  const out = {}
  for (const key of WANTED) {
    const raw = aliases[key]
    if (!raw) continue
    // 形如 var(--dsw-static-xxx)，再查一层
    const m = raw.match(/^var\(--dsw-static-([\w-]+)\)$/)
    if (m) {
      const hit = statics[m[1]]
      if (hit) { out[key] = hit; continue }
    }
    if (raw.startsWith('var(')) continue   // 解析不出的就不写，宁可缺也别给错值
    out[key] = raw
  }
  return out
}

const tokens = {
  light: resolvePalette(lightAlias, false),
  dark: resolvePalette(darkAlias, true),
  statics: {
    'deepseek-450': lightStatic['deepseek-450'],
    'deepseek-500': lightStatic['deepseek-500'],
    'deepseek-400': lightStatic['deepseek-400'],
  },
}

if (process.env.NMDEBUG) {
  console.log('lightAlias keys:', Object.keys(lightAlias).length)
  console.log('darkAlias keys:', Object.keys(darkAlias).length)
  console.log('lightStatic keys:', Object.keys(lightStatic).length)
  console.log('lightAlias 前 5 个 key:', Object.keys(lightAlias).slice(0, 5))
  console.log('lightStatic 前 5 个 key:', Object.keys(lightStatic).slice(0, 5))
}

fs.writeFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..', 'preview', 'tokens.json'),
  JSON.stringify(tokens, null, 2) + '\n',
  'utf8',
)

for (const theme of ['light', 'dark']) {
  console.log(`=== ${theme} ===`)
  for (const [k, v] of Object.entries(tokens[theme])) console.log('  ', k.padEnd(24), v)
}
