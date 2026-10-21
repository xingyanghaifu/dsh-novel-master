import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { studyCommand } from '../src/cmd-study.js'
import { withProjectsDirectory } from '../src/project.js'

/**
 * /novel-study 的参数是**参考文件**，不是项目名。
 *
 * 这个区别曾经让用户以为插件坏了：他把项目名当参数传进去，只得到一句
 * 「读不到文件」，完全看不出该怎么用。这几条盯住的就是「把误用说清楚」，
 * 而不是让人自己猜。
 */

function tempRoot() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-study-'))
  const root = path.join(cwd, 'novel_projects')
  fs.mkdirSync(path.join(root, '测试小说'), { recursive: true })
  fs.writeFileSync(path.join(root, '测试小说', '设定.md'), '# 设定\n', 'utf8')
  return { cwd, root, cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) }
}

/** 跑一次命令，把结果规整成 {kind, text}。 */
async function run(cwd, rawInput) {
  const cmd = studyCommand()
  return withProjectsDirectory('novel_projects', () => cmd.handler({
    cwd,
    rawInput,
    attachments: [],
    agent: { id: 'x', followup: () => {} },
  }))
}

test('把项目名当参考文件时，直接点明参数含义', async () => {
  const { cwd, cleanup } = tempRoot()
  try {
    const result = await run(cwd, '测试小说')
    assert.equal(result.kind, 'error')
    // 必须说清「这是项目名」，而不是只说读不到文件
    assert.match(result.text, /是项目名，不是参考文件/u)
    // 并且给出可以直接照抄的正确写法
    assert.match(result.text, /--to 测试小说/u)
    // 还要指出另一条路：想看项目数据该用哪个命令
    assert.match(result.text, /novel-stats/u)
  } finally { cleanup() }
})

test('文件真的不存在时仍报读不到，不误报成项目名', async () => {
  const { cwd, cleanup } = tempRoot()
  try {
    const result = await run(cwd, './不存在的参考.txt')
    assert.equal(result.kind, 'error')
    assert.match(result.text, /读不到文件/u)
    // 不能把普通路径也硬说成项目名
    assert.doesNotMatch(result.text, /是项目名，不是参考文件/u)
  } finally { cleanup() }
})

test('给的是真实文件时正常往下走', async () => {
  const { cwd, cleanup } = tempRoot()
  try {
    const ref = path.join(cwd, '参考.txt')
    fs.writeFileSync(ref, '# 第一章\n\n他说：“走吧。”\n', 'utf8')
    const result = await run(cwd, '参考.txt')
    // 成功路径会排队一个任务，不该是错误
    assert.notEqual(result.kind, 'error', `不该报错：${result.text}`)
    assert.match(result.text, /开始拆书/u)
  } finally { cleanup() }
})
