import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { configuredProjectsDirectory, withProjectsDirectory, projectRelativeDir, projectsRoot, projectDir } from '../src/project.js'
import { ensureProject, prepareRun } from '../src/workflow.js'
import { finishObjective } from '../src/prompts.js'
import { novelCommand } from '../src/cmd-write.js'
import { outlineCommand, statsCommand } from '../src/cmd-tools.js'
import { marketCommand } from '../src/cmd-market.js'
import { conflictCommand } from '../src/cmd-analysis.js'

function temporary(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-directory-'))
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
  return cwd
}

function invocation(cwd, rawInput = '') {
  const messages = []
  return { agent: { session: { header: { cwd } }, followup: (message) => messages.push(message) }, rawInput, messages }
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('directories reject absolute, empty and traversal paths before operation executes', () => {
  for (const value of [undefined, null, 42, '', '  ', '.', '..', '../books', 'books/../other', 'books/./other', '/books', 'C:/books', 'C:books', '\\\\server\\books', 'books\\..\\other', 'books/.. /outside', 'books/a./other', 'books\0bad']) {
    let executed = false
    assert.throws(() => withProjectsDirectory(value, () => { executed = true }), /项目目录/u, JSON.stringify(value))
    assert.equal(executed, false)
  }
  withProjectsDirectory(' books\\fiction/ ', () => {
    assert.equal(configuredProjectsDirectory(), 'books/fiction')
    assert.equal(projectRelativeDir('书名'), 'books/fiction/书名')
  })
  assert.equal(configuredProjectsDirectory(), 'novel_projects')
})

test('two concurrent async requests retain isolated directory snapshots and persisted workflows', async (t) => {
  const cwd = temporary(t)
  const firstReady = deferred()
  const secondReady = deferred()
  const firstDone = deferred()
  const first = withProjectsDirectory('books/first', async () => {
    ensureProject(cwd, '同名书')
    firstReady.resolve()
    await secondReady.promise
    assert.equal(projectsRoot(cwd), path.join(cwd, 'books', 'first'))
    prepareRun(cwd, '同名书', { target: 3, mode: 'finish', branchMode: 'auto' })
    firstDone.resolve()
    return finishObjective('同名书', 3)
  })
  const second = withProjectsDirectory('books/second', async () => {
    await firstReady.promise
    ensureProject(cwd, '同名书')
    secondReady.resolve()
    await firstDone.promise
    assert.equal(projectsRoot(cwd), path.join(cwd, 'books', 'second'))
    prepareRun(cwd, '同名书', { target: 7, mode: 'finish', branchMode: 'auto' })
    return finishObjective('同名书', 7)
  })
  const objectives = await Promise.all([first, second])
  for (const [i, directory] of ['first', 'second'].entries()) {
    const root = path.join(cwd, 'books', directory, '同名书')
    assert.match(fs.readFileSync(path.join(root, '完本流程.md'), 'utf8'), new RegExp(`books/${directory}/同名书/`, 'u'))
    assert.ok(objectives[i].includes(`books/${directory}/同名书/完本流程.md`))
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '项目.json'), 'utf8')).target, i ? 7 : 3)
  }
  assert.equal(configuredProjectsDirectory(), 'novel_projects')
  assert.equal(fs.existsSync(path.join(cwd, 'novel_projects')), false)
})

test('configured directory agrees across writing receipts, fallback, analysis and model prompts', (t) => {
  const cwd = temporary(t)
  withProjectsDirectory('我的书/项目', () => {
    const start = invocation(cwd, '测试书 3章')
    const result = novelCommand({ get: () => undefined }).handler(start)
    assert.equal(result.kind, 'success')
    assert.ok(result.text.includes('我的书/项目/测试书/'))
    assert.ok(JSON.stringify(start.messages).includes('我的书/项目/测试书/完本流程.md'))
    const dir = projectDir(cwd, '测试书')
    fs.writeFileSync(path.join(dir, '正文', '第1章_起.md'), '# 第1章 起\n\n正文。')
    for (const [command, input] of [[outlineCommand(), '测试书'], [marketCommand(), 'qidian 测试书'], [conflictCommand(), '测试书']]) {
      const request = invocation(cwd, input)
      assert.equal(command.handler(request).kind, 'success')
      const prompt = JSON.stringify(request.messages)
      assert.ok(prompt.includes('我的书/项目/测试书'))
      assert.equal(prompt.includes('novel_projects'), false)
    }
  })
  assert.equal(fs.existsSync(path.join(cwd, 'novel_projects')), false)
})

test('detailed stats reports actual prose counts, extrema and quote ratios including empty chapters', (t) => {
  const cwd = temporary(t)
  withProjectsDirectory('books', () => {
    const dir = ensureProject(cwd, '统计')
    for (const [file, text] of [
      ['第1章_标题含“对话”但不计入.md', '# 第1章 “标题不能计入”\n\n“你好”你好'],
      ['第2章_空章.md', '# 第2章 空章\n\n'],
      ['第3章_最长.md', '# 第3章 最长\n\n这是一段没有任何对话的文字。'],
    ]) fs.writeFileSync(path.join(dir, '正文', file), text)
    const basic = statsCommand().handler(invocation(cwd, '统计'))
    assert.equal(basic.text.includes('详细统计'), false)
    const result = statsCommand().handler(invocation(cwd, '统计 --detailed'))
    assert.equal(result.kind, 'success')
    assert.match(result.text, /第 1 章.*：6 字；对话占比 33\.3%/u)
    assert.match(result.text, /第 2 章 空章：0 字；对话占比 0\.0%（空章）/u)
    assert.match(result.text, /第 3 章 最长：14 字；对话占比 0\.0%/u)
    assert.match(result.text, /最短章：第 2 章，0 字/u)
    assert.match(result.text, /最长章：第 3 章，14 字/u)
    assert.match(result.text, /全书对话占比：10\.0%/u)
    assert.doesNotMatch(result.text, /NaN|Infinity/u)
  })
})

test('detailed stats handles a project without chapters', (t) => {
  const cwd = temporary(t)
  withProjectsDirectory('books', () => {
    ensureProject(cwd, '空书')
    const result = statsCommand().handler(invocation(cwd, '空书 --detailed'))
    assert.equal(result.kind, 'success')
    assert.match(result.text, /暂无章节；最短\/最长章：无；全书对话占比：0\.0%/u)
    assert.doesNotMatch(result.text, /NaN|Infinity/u)
  })
})
