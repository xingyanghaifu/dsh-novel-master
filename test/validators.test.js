import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateChapterTarget } from '../src/validators.js'

/**
 * 校验函数的契约是「永远返回 {valid, error}」，不抛异常。
 *
 * 这不是形式主义：调用方拿到 valid:false 就能把 error 直接念给用户，
 * 拿到一个 TypeError 就只能显示堆栈。区别在用户看到的是一句人话还是一屏报错。
 *
 * 下面这些输入原先都会抛 TypeError —— 上游把命令参数解析成数字、
 * 或者某条分支漏传参数，都会踩到。
 */
const NOT_STRINGS = [
  ['undefined', undefined],
  ['null', null],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['0', 0],
  ['负数', -5],
  ['大数', 1e9],
  ['小数', 3.7],
  ['对象', {}],
  ['数组', [1, 2]],
  ['布尔', true],
]

for (const [label, value] of NOT_STRINGS) {
  test(`validateChapterTarget 遇到${label}返回错误而不是抛异常`, () => {
    const result = validateChapterTarget(value)
    assert.equal(result.valid, false)
    assert.equal(typeof result.error, 'string')
    assert.ok(result.error.length > 0, '错误信息不能是空串')
  })
}

test('validateChapterTarget 仍然认识合法格式', () => {
  assert.deepEqual(validateChapterTarget('80章'), { valid: true, type: 'chapters', value: 80 })
  assert.deepEqual(validateChapterTarget('20万字'), { valid: true, type: 'words', value: 67 })
  // 两侧空白要容忍，用户从别处复制过来常带空格
  assert.deepEqual(validateChapterTarget('  80章  '), { valid: true, type: 'chapters', value: 80 })
})

test('validateChapterTarget 拒绝越界与不认识的值', () => {
  assert.equal(validateChapterTarget('0章').valid, false)
  assert.equal(validateChapterTarget('99999章').valid, false)
  assert.equal(validateChapterTarget('随便什么').valid, false)
  assert.equal(validateChapterTarget('').valid, false)
  assert.equal(validateChapterTarget('   ').valid, false)
})
