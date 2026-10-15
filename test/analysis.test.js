import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { conflictCommand, emotionCommand, readerCommand, paceCommand, dialogueCommand } from '../src/cmd-analysis.js'
import { marketCommand } from '../src/cmd-market.js'
import { countChars } from '../src/project.js'

let cwd
let bookDir
const project = '测试小说'
const bodies = ['# 开篇\n你好世界。', '甲乙丙丁戊己庚辛。', '最后一章\n完。']
const files = ['第1章_开头.md', '第2章 非通配标题.txt', '第3章_终章.md']
beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-analysis-'))
  bookDir = path.join(cwd, 'novel_projects', project)
  fs.mkdirSync(path.join(bookDir, '正文'), { recursive: true })
  files.forEach((file, index) => fs.writeFileSync(path.join(bookDir, '正文', file), bodies[index]))
})
afterEach(() => fs.rmSync(cwd, { recursive: true, force: true }))

function run(factory, rawInput = '') {
  const followups = []
  const result = factory().handler({
    rawInput, attachments: [], signal: new AbortController().signal,
    agent: { session: { header: { cwd } }, followup: message => followups.push(message) },
  })
  return { result, followups, prompt: followups[0]?.content.at(-1).text ?? '' }
}
const chapterPath = number => `novel_projects/${project}/正文/${files[number - 1]}`

test('reader bare chapter number selects that exact chapter, not latest', () => {
  const { result, prompt } = run(readerCommand, `${project} 2 --persona 挑剔`)
  assert.equal(result.kind, 'success')
  assert.match(prompt, /第 2 章/u)
  assert.match(prompt, /挑剔读者/u)
  assert.ok(prompt.includes(chapterPath(2)))
  assert.ok(!prompt.includes(chapterPath(1)))
  assert.ok(!prompt.includes(chapterPath(3)))
})

test('reader defaults to latest chapter only and supports explicit ranges', () => {
  const latest = run(readerCommand)
  assert.equal(latest.result.kind, 'success')
  assert.ok(latest.prompt.includes(chapterPath(3)))
  assert.ok(!latest.prompt.includes(chapterPath(1)))
  const range = run(readerCommand, '1-2 --persona 老读者')
  assert.equal(range.result.kind, 'success')
  assert.ok(range.prompt.includes(chapterPath(1)))
  assert.ok(range.prompt.includes(chapterPath(2)))
  assert.ok(!range.prompt.includes(chapterPath(3)))
})

for (const [name, factory] of [['reader', readerCommand], ['conflict', conflictCommand], ['emotion', emotionCommand]]) {
  test(`${name} rejects nonexistent, reversed and malformed explicit selections without followup`, () => {
    for (const input of ['9', '3-1', '8-10', '1-4', '0', '1-', '-2', '1-2-3', '1 2']) {
      const { result, followups } = run(factory, input)
      assert.equal(result.kind, 'error', input)
      assert.equal(followups.length, 0, input)
    }
  })
  test(`${name} rejects a missing interior chapter instead of narrowing the range`, () => {
    fs.unlinkSync(path.join(bookDir, '正文', files[1]))
    const { result, followups } = run(factory, '1-3')
    assert.equal(result.kind, 'error')
    assert.equal(followups.length, 0)
  })
  test(`${name} includes only selected exact paths in its prompt`, () => {
    const { result, prompt } = run(factory, '2-3')
    assert.equal(result.kind, 'success')
    assert.ok(prompt.includes(chapterPath(2)))
    assert.ok(prompt.includes(chapterPath(3)))
    assert.ok(!prompt.includes(chapterPath(1)))
  })
}

test('pace and dialogue prompts use actual chapter filenames', () => {
  const pace = run(paceCommand)
  files.forEach((_, index) => assert.ok(pace.prompt.includes(chapterPath(index + 1))))
  const dialogue = run(dialogueCommand, '2')
  assert.equal(dialogue.result.kind, 'success')
  assert.ok(dialogue.prompt.includes(chapterPath(2)))
  assert.ok(!dialogue.prompt.includes('*.md'))
})

test('market validates empty input, unsupported platform and explicit project', () => {
  for (const input of ['', '   ', 'unknown', 'qidian 不存在的小说']) {
    const { result, followups } = run(marketCommand, input)
    assert.equal(result.kind, 'error', input)
    assert.equal(followups.length, 0, input)
  }
  assert.match(run(marketCommand, ' ').result.text, /请指定平台名称/u)
})

test('market accepts every documented alias and gives Chuangshi a qualified profile', () => {
  for (const platform of ['qidian', 'QD', '起点', 'zongheng', 'zh', '纵横', 'jjwxc', 'jj', '晋江', '17k', 'chuangshi', '创世']) {
    const { result, prompt } = run(marketCommand, `${platform} ${project}`)
    assert.equal(result.kind, 'success', platform)
    assert.match(prompt, /不是实际市场调研/u)
  }
  assert.match(run(marketCommand, '创世').prompt, /未核实该品牌当前独立投稿入口/u)
})

test('market uses actual all-chapter mean and exact sample paths without fabricated research', () => {
  const { result, prompt } = run(marketCommand, 'qidian')
  const total = bodies.reduce((sum, body) => sum + countChars(body), 0)
  const average = Math.round(total / bodies.length)
  assert.equal(result.kind, 'success')
  assert.ok(prompt.includes(`总计 ${total} 字，平均 ${average} 字/章`))
  assert.ok(result.text.includes(`${average} 字/章`))
  files.forEach((_, index) => assert.ok(prompt.includes(chapterPath(index + 1))))
  assert.match(prompt, /禁止编造读者人数/u)
  assert.match(prompt, /禁止声称已完成真实读者调查或实际市场研究/u)
  assert.match(prompt, /禁止承诺收益或增长数字/u)
  assert.ok(!prompt.includes('XXXX'))
  assert.ok(!prompt.includes('潜在读者规模：'))
  assert.ok(!prompt.includes('推荐位机会：'))
})

test('market opening sample is limited to actual first five files but mean uses all chapters', () => {
  for (let number = 4; number <= 6; number++) {
    fs.writeFileSync(path.join(bookDir, '正文', `第${number}章_新增.md`), '甲'.repeat(number * 10))
  }
  const { prompt } = run(marketCommand, '17k')
  const total = bodies.reduce((sum, body) => sum + countChars(body), 0) + 40 + 50 + 60
  assert.ok(prompt.includes(`平均 ${Math.round(total / 6)} 字/章`))
  assert.ok(prompt.includes('第5章_新增.md'))
  assert.ok(!prompt.includes('第6章_新增.md'))
})
