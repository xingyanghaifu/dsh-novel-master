import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeProjectDirectory, validateProjectDirectory } from '../src/path-helper.js'
import { configuredProjectsDirectory, withProjectsDirectory, projectRelativeDir, projectsRoot, projectDir, readState } from '../src/project.js'
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

test('directory suggestions are safe, strict and preserve path meaning', () => {
  const workspace = path.resolve(os.tmpdir(), 'novel-workspace')
  const safe = validateProjectDirectory('books/../archive', workspace)
  assert.equal(safe.valid, false)
  assert.equal(safe.suggestion, 'archive')
  assert.equal(path.resolve(workspace, safe.suggestion), path.resolve(workspace, 'books/../archive'))
  assert.equal(normalizeProjectDirectory('books/../archive', workspace).value, 'archive')

  for (const input of ['../outside', 'x:../outside', 'folder?/../../outside']) {
    const result = validateProjectDirectory(input, workspace)
    assert.equal(result.valid, false, input)
    assert.equal(result.suggestion, undefined, input)
    const normalized = normalizeProjectDirectory(input, workspace)
    assert.equal(normalized.value, input, input)
    assert.ok(normalized.warnings.some(warning => warning.includes('未自动修改')), input)
  }

  const insideAbsolute = process.platform === 'win32'
    ? path.win32.join(workspace, 'books')
    : path.posix.join(workspace, 'books')
  const converted = validateProjectDirectory(insideAbsolute, workspace)
  assert.equal(converted.suggestion, 'books')
  assert.equal(path.resolve(workspace, converted.suggestion), path.resolve(insideAbsolute))

  const outside = validateProjectDirectory(path.resolve(workspace, '..', 'other-workspace'), workspace)
  assert.equal(outside.suggestion, undefined)
  assert.equal(normalizeProjectDirectory(path.resolve(workspace, '..', 'other-workspace'), workspace).value,
    path.resolve(workspace, '..', 'other-workspace'))
})

test('directories reject empty, traversal and unsafe paths before operation executes', () => {
  for (const value of [undefined, null, 42, '', '  ', '.', '..', '../books', 'books/../other', 'books/./other', 'books\\..\\other', 'books/.. /outside', 'books/a./other', 'books\0bad', 'C:/', '/']) {
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

/**
 * Regression: the settings page offers a browse-for-custom-path control and its
 * copy promises an absolute directory, but the command rejected it with
 * "项目目录不能使用绝对路径". The UI and the executor must agree.
 */
test('an absolute projects directory is accepted and used verbatim', () => {
  const absolute = path.win32.isAbsolute(process.cwd())
    ? path.win32.join(process.cwd(), 'absolute-books')
    : path.posix.join(process.cwd(), 'absolute-books')
  withProjectsDirectory(absolute, () => {
    assert.equal(path.resolve(projectsRoot('/some/other/cwd')), path.resolve(absolute))
    // Receipts name the real location instead of inventing a relative path.
    assert.equal(projectRelativeDir('书名'), `${absolute.replace(/\\/gu, '/')}/书名`)
  })
  // Escaping with '..' inside an absolute path is still refused.
  assert.throws(() => withProjectsDirectory(`${absolute}/../escape`, () => {}), /项目目录/u)
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

test('a corrupt 项目.json is an error, not an empty project', (t) => {
  // 曾经：解析失败被当成「没有状态」，调用方随即用 {} 重写，
  // 进度、字数、更新时间一并丢掉，而且用户看不到任何提示。
  const cwd = temporary(t)
  withProjectsDirectory('books', () => {
    ensureProject(cwd, '坏书')
    const file = path.join(projectDir(cwd, '坏书'), '项目.json')
    fs.writeFileSync(file, '{ 这不是合法 JSON', 'utf8')

    assert.throws(() => readState(cwd, '坏书'), /项目状态文件已损坏/u)
    // 文件本身没有被改写
    assert.equal(fs.readFileSync(file, 'utf8'), '{ 这不是合法 JSON')
  })
})

test('a missing 项目.json still reads as a new project', (t) => {
  const cwd = temporary(t)
  withProjectsDirectory('books', () => {
    ensureProject(cwd, '新书')
    fs.rmSync(path.join(projectDir(cwd, '新书'), '项目.json'), { force: true })
    assert.equal(readState(cwd, '新书'), undefined)
  })
})
