import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

/**
 * 主题令牌的取值约束。
 *
 * 这一组测试存在的理由很具体：`--nm-accent` 一度取的是
 * `--dsw-alias-brand-primary`，而宿主里它是中性色（浅色 #0f1115 / 深色 #f9fafb），
 * 不是品牌蓝。结果 137 处 `var(--nm-accent)` 在真机上全部退化成黑白：
 * 徽章灰底黑字、进度条黑白渐变、主按钮黑底黑边。这类错误不会报错，
 * 只会「看着说不出哪里不对」，靠肉眼看图很难发现 —— 只能锁死取值来源。
 */
const SOURCE = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const CSS = SOURCE.match(/const CSS = `([\s\S]*?)`\n/)[1]

// 取某个选择器的声明块。这里刻意只做最简单的字面量匹配：
// 一开始想用「正则转义再匹配」，结果转义叠加导致永远匹配不到，
// 测试报了「缺令牌」的假警 —— 断言写错比没断言更浪费时间。
const scopeBlock = (literalSelector) => {
  const idx = CSS.indexOf(`${literalSelector}{`)
  if (idx < 0) return ''
  const open = idx + literalSelector.length
  const close = CSS.indexOf('}', open)
  return close < 0 ? '' : CSS.slice(open + 1, close)
}

test('强调色取自品牌蓝 state-business-primary，不能用中性色 brand-primary', () => {
  const declarations = [...CSS.matchAll(/--nm-accent:([^;}]+)/g)].map((m) => m[1].trim())
  assert.ok(declarations.length >= 2, '设置页与侧边栏两个作用域都要定义强调色')

  for (const value of declarations) {
    assert.doesNotMatch(
      value,
      /--dsw-alias-brand-primary/,
      `强调色不能取 brand-primary（宿主里它是中性色，会让全部强调色变黑白）：${value}`,
    )
    assert.match(
      value,
      /--dsw-alias-state-business-primary/,
      `强调色应取 state-business-primary：${value}`,
    )
  }
})

test('三个视觉作用域都要重新定义令牌，只改一个侧栏仍是灰的', () => {
  // .nm-atlas 独立定义了一整套变量；只改 .nm-settings 时侧边栏不受影响。
  for (const selector of ['.nm-settings', '.nm-atlas']) {
    const block = scopeBlock(selector)
    assert.ok(block.includes('--nm-accent:'), `${selector} 必须定义 --nm-accent`)
    assert.ok(block.includes('--nm-text:'), `${selector} 必须定义 --nm-text`)
  }
})

test('raised 表面不能取 bg-overlay（浅色下它比卡片更暗）', () => {
  const block = scopeBlock('.nm-settings')
  const raised = block.match(/--nm-raised:([^;}]+)/)
  assert.ok(raised, '--nm-raised 必须定义')
  assert.doesNotMatch(
    raised[1],
    /bg-overlay/,
    'bg-overlay 浅色是 #e9ecf2，比卡片 #fff 更暗，会让 Hero 看着是凹的',
  )
  assert.match(raised[1], /color-mix|bg-layer-3/, '应用 color-mix 相对卡片提亮')
})

test('圆角收敛到有限阶梯，不留手调奇数像素', () => {
  const values = new Set(
    [...CSS.matchAll(/border-radius:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])),
  )
  // 7/9/11/13/15 这类手调值在视觉上分辨不出来，只会让声明散乱，
  // 也是「AI 生成感」最强的来源之一。
  const odd = [...values].filter((v) => [3, 5, 7, 9, 11, 13, 15, 18, 22, 24].includes(v))
  assert.deepEqual(odd, [], `发现手调圆角值：${odd.join(', ')}`)
})

test('不使用 transition:all', () => {
  // all 会把 font-weight、border-width 一起插值，中文 hover 时能看到重排。
  const hits = [...CSS.matchAll(/transition:\s*all\b/g)]
  assert.equal(hits.length, 0, `transition:all 出现 ${hits.length} 次`)
})

test('动效时长走统一令牌，不散落裸时长', () => {
  assert.match(CSS, /--nm-t-fast:120ms/, '缺少快速时长令牌')
  assert.match(CSS, /--nm-t-base:200ms/, '缺少基础时长令牌')
  assert.match(CSS, /--nm-ease-out:cubic-bezier/, '缺少缓出曲线令牌')
})

test('尊重减少动效偏好', () => {
  assert.match(CSS, /prefers-reduced-motion/, '必须处理 prefers-reduced-motion')
})
