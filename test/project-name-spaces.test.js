import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { personaCommand } from '../src/cmd-persona.js'
import { studyCommand } from '../src/cmd-study.js'
import { withProjectsDirectory } from '../src/project.js'

/**
 * 项目名带空格（「国运：方块降临 2026」）不该被拆成两半。
 *
 * 这类名字很常见，而按空格切参数的老代码会把它切开：/novel-persona 把 2026
 * 当成风格 id，/novel-persona-study 把 --to 的值截成「国运：方块降临」，
 * 两者都报一个跟真实原因无关的错。
 */

function tempRoot() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-space-'))
  const root = path.join(cwd, 'novel_projects')
  const name = '国运：方块降临 2026'
  fs.mkdirSync(path.join(root, name, '正文'), { recursive: true })
  fs.writeFileSync(path.join(root, name, '设定.md'), '# 设定\n', 'utf8')
  return { cwd, name, cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) }
}

const run = (cmd, cwd, rawInput, extra = {}) => withProjectsDirectory('novel_projects', () => cmd.handler({
  cwd, rawInput, attachments: [], signal: new AbortController().signal,
  agent: { id: 'x', followup: () => {} }, ...extra,
}))

test('novel-persona 认得带空格的项目名', async () => {
  const { cwd, name, cleanup } = tempRoot()
  try {
    const r = await run(personaCommand(), cwd, name)
    // 不该出现「没有内置风格「2026」」这种把书名当风格 id 的错误
    assert.doesNotMatch(r.text, /没有内置风格/u)
    assert.match(r.text, new RegExp(name, 'u'))
  } finally { cleanup() }
})

test('novel-persona 仍然认得真正的风格 id', async () => {
  const { cwd, name, cleanup } = tempRoot()
  try {
    const r = await run(personaCommand(), cwd, `${name} wangyu-classic`)
    assert.doesNotMatch(r.text, /没有内置风格/u)
  } finally { cleanup() }
})

test('novel-persona 对真的不存在的风格仍然报错', async () => {
  const { cwd, name, cleanup } = tempRoot()
  try {
    const r = await run(personaCommand(), cwd, `${name} 不存在的风格`)
    assert.match(r.text, /没有内置风格/u)
  } finally { cleanup() }
})

test('novel-study 的 --to 保留带空格的项目名', async () => {
  const { cwd, name, cleanup } = tempRoot()
  try {
    const ref = path.join(cwd, '参考.txt')
    fs.writeFileSync(ref, '# 第一章\n\n' + '他说：“走吧。”\n\n'.repeat(200), 'utf8')
    const r = await run(studyCommand(), cwd, `参考.txt --to ${name}`)
    // 项目名被截断时这里会报「没有叫…的项目」
    assert.doesNotMatch(r.text, /没有叫/u)
    assert.notEqual(r.kind, 'error', `不该报错：${r.text}`)
  } finally { cleanup() }
})

test('novel-study 的 --to 仍然能识别不存在的项目', async () => {
  const { cwd, cleanup } = tempRoot()
  try {
    const ref = path.join(cwd, '参考.txt')
    fs.writeFileSync(ref, '# 第一章\n\n' + '他说：“走吧。”\n\n'.repeat(200), 'utf8')
    const r = await run(studyCommand(), cwd, `参考.txt --to 没有这本书`)
    assert.match(r.text, /没有叫/u)
  } finally { cleanup() }
})
