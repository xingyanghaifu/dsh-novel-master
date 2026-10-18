/**
 * 只读工具实测：真实建项目目录、真实读写，验证工具不是空壳。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { readonlyTools } from '../src/project-tools.js'

/** 造一个真实项目结构。 */
function makeWorkspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-tools-'))
  const root = path.join(cwd, 'novel_projects')

  const book = path.join(root, '测试书', '正文')
  fs.mkdirSync(book, { recursive: true })
  fs.writeFileSync(path.join(root, '测试书', '设定.md'), '# 设定\n\n灰烬边境，终年落灰。\n', 'utf8')
  fs.writeFileSync(path.join(root, '测试书', '角色.md'), '# 角色\n\n- 琳雅：红袍弓箭手\n', 'utf8')
  fs.writeFileSync(path.join(root, '测试书', '大纲.md'), '', 'utf8')
  fs.writeFileSync(path.join(book, '第1章.md'), '第一章正文内容。'.repeat(100), 'utf8')
  fs.writeFileSync(path.join(book, '第2章.md'), '第二章正文内容。'.repeat(50), 'utf8')

  const other = path.join(root, '另一本', '正文')
  fs.mkdirSync(other, { recursive: true })
  fs.writeFileSync(path.join(other, '第1章.md'), '短篇。', 'utf8')

  return cwd
}

const cwd = makeWorkspace()
const exec = { cwd }
const byName = Object.fromEntries(readonlyTools().map((tool) => [tool.name, tool]))

test.after(() => fs.rmSync(cwd, { recursive: true, force: true }))

test('只读工具集齐全且结构合法', () => {
  assert.equal(readonlyTools().length, 4)
  for (const tool of readonlyTools()) {
    assert.ok(tool.name, '缺 name')
    assert.ok(tool.description, `${tool.name} 缺 description`)
    assert.ok(tool.parameters, `${tool.name} 缺 parameters`)
    assert.equal(typeof tool.execute, 'function', `${tool.name} 缺 execute`)
    assert.ok(tool.output?.schema, `${tool.name} 缺 output.schema`)
    assert.equal(typeof tool.output.render, 'function', `${tool.name} 缺 render`)
  }
})

test('工具名不重复', () => {
  const names = readonlyTools().map((tool) => tool.name)
  assert.equal(new Set(names).size, names.length)
})

test('novel_projects 列出真实项目并统计章数字数', async () => {
  const result = await byName.novel_projects.execute({}, exec)
  assert.equal(result.total, 2)
  const mine = result.projects.find((item) => item.name === '测试书')
  assert.equal(mine.chapters, 2)
  assert.ok(mine.chars > 0, '字数应大于 0')
})

test('没有项目目录时返回空列表而不抛错', async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-empty-'))
  try {
    const result = await byName.novel_projects.execute({}, { cwd: empty })
    assert.equal(result.total, 0)
    assert.deepEqual(result.projects, [])
  } finally {
    fs.rmSync(empty, { recursive: true, force: true })
  }
})

test('novel_status 给出进度与缺失文件', async () => {
  const result = await byName.novel_status.execute({ project: '测试书' }, exec)
  assert.equal(result.chapters, 2)
  assert.ok(result.chars > 0)
  assert.ok(result.averageChars > 0)
  assert.ok(result.missing.includes('世界状态.md'))
  // 已有文件不该被列为缺失
  assert.ok(!result.missing.includes('设定.md'))
})

test('novel_status 拒绝不存在的项目', async () => {
  await assert.rejects(
    () => byName.novel_status.execute({ project: '查无此书' }, exec),
    /项目/u,
  )
})

test('novel_status 缺 project 参数时提示怎么找项目', async () => {
  await assert.rejects(
    () => byName.novel_status.execute({}, exec),
    /novel_projects/u,
  )
})

test('novel_read 读到真实内容', async () => {
  const result = await byName.novel_read.execute({ project: '测试书', file: '设定.md' }, exec)
  assert.equal(result.exists, true)
  assert.ok(result.content.includes('灰烬边境'))
  assert.ok(result.chars > 0)
})

test('novel_read 区分空文件与不存在的文件', async () => {
  const empty = await byName.novel_read.execute({ project: '测试书', file: '大纲.md' }, exec)
  assert.equal(empty.exists, true, '空文件确实存在')
  assert.equal(empty.chars, 0)
  assert.equal(empty.content, '')

  const absent = await byName.novel_read.execute({ project: '测试书', file: '伏笔.md' }, exec)
  assert.equal(absent.exists, false)
})

test('novel_read 拒绝路径穿越与白名单外文件', async () => {
  const attacks = ['../../../etc/passwd', '../设定.md', '正文/第1章.md', '随便.txt', '..\\设定.md', '', '设定.md\u0000.txt']
  for (const file of attacks) {
    await assert.rejects(
      () => byName.novel_read.execute({ project: '测试书', file }, exec),
      /不支持读取/u,
      `应拒绝：${file}`,
    )
  }
})

test('项目名参数拒绝路径穿越', async () => {
  // projectExists 只判断路径存在，`..` 会指到真实目录，必须单独校验
  const attacks = ['..', '.', '../../', '测试书/../../', '测试书\\..', 'C:\\Windows', '/etc', '']
  for (const project of attacks) {
    await assert.rejects(
      () => byName.novel_status.execute({ project }, exec),
      /项目名不合法|请提供 project/u,
      `应拒绝项目名：${JSON.stringify(project)}`,
    )
  }
})

test('项目名穿越无法读出项目外文件', async () => {
  // 项目外放一个诱饵文件，确认读不到
  const outside = path.join(cwd, 'secret.txt')
  fs.writeFileSync(outside, '不该被读到', 'utf8')
  try {
    for (const project of ['..', '../..', '测试书/..']) {
      await assert.rejects(() => byName.novel_read.execute({ project, file: 'secret.txt' }, exec))
    }
    // 正文工具同样要拦住
    await assert.rejects(() => byName.novel_chapter_read.execute({ project: '..' }, exec))
  } finally {
    fs.rmSync(outside, { force: true })
  }
})

test('novel_chapter_read 只列章节时不返回正文', async () => {
  const result = await byName.novel_chapter_read.execute({ project: '测试书' }, exec)
  assert.equal(result.total, 2)
  assert.deepEqual(result.chapters, ['第1章.md', '第2章.md'])
  assert.equal(result.content, undefined, '没指定章节就不该给正文')
})

test('novel_chapter_read 读单章正文', async () => {
  const result = await byName.novel_chapter_read.execute({ project: '测试书', chapter: '第1章.md' }, exec)
  assert.ok(result.content.includes('第一章正文'))
  assert.equal(result.truncated, false)
  assert.ok(result.chars > 0)
})

test('novel_chapter_read 超长时截断并标注', async () => {
  const result = await byName.novel_chapter_read.execute({ project: '测试书', chapter: '第1章.md', maxChars: 500 }, exec)
  assert.equal(result.truncated, true)
  assert.ok(result.content.includes('已截断'))
  assert.ok(result.content.length < 700, '截断后不该还很长')
})

test('novel_chapter_read 缺章节时列出可选章节', async () => {
  await assert.rejects(
    () => byName.novel_chapter_read.execute({ project: '测试书', chapter: '第99章.md' }, exec),
    /第1章\.md/u,
  )
})

test('工具输出能被 render 成文本块', async () => {
  const result = await byName.novel_projects.execute({}, exec)
  const blocks = byName.novel_projects.output.render({}, result)
  assert.ok(Array.isArray(blocks))
  assert.equal(blocks[0].type, 'text')
  assert.ok(blocks[0].text.length > 0)
})
