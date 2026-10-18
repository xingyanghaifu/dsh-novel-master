/**
 * 工具注册/注销配对：注册了多少个，dispose 时就该撤掉多少个。
 * 这条测试锁住过一个真实 bug —— 新增的只读工具注册后没有对应清理，会泄漏。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')

test('只读工具注册后会在 dispose 时撤销', () => {
  // 注册侧
  assert.match(source, /disposeReadonly = readonlyTools\(\)\.map\(\(definition\) => tools\.register\(definition\)\)/u)
  // 清理侧
  assert.match(source, /for \(const off of disposeReadonly\)/u)
})

test('每个工具句柄都有对应的清理调用', () => {
  for (const handle of ['disposeProbe', 'disposeBatch']) {
    assert.match(source, new RegExp(`try \\{ ${handle}\\?\\.\\(\\) \\}`, 'u'), `${handle} 缺清理`)
  }
})

test('只读工具不包含任何写文件的命令', () => {
  const tools = fs.readFileSync(new URL('../src/project-tools.js', import.meta.url), 'utf8')
  // 只读工具里不该出现写文件调用
  for (const writer of ['writeFileSync', 'renameSync', 'mkdirSync', 'writeState', 'unlinkSync']) {
    assert.ok(!tools.includes(writer), `只读工具里出现了写操作：${writer}`)
  }
})

test('novel_read 用白名单而不是直接拼路径', () => {
  const tools = fs.readFileSync(new URL('../src/project-tools.js', import.meta.url), 'utf8')
  assert.match(tools, /const allowed = \[/u)
  assert.match(tools, /if \(!allowed\.includes\(file\)\)/u)
})
