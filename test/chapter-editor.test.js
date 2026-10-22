import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applySnippet, proposeSnippet, readChapter } from '../src/chapter-editor.js'

/**
 * 侧边栏的片段改写。
 *
 * 两条线必须分得很清楚：生成候选绝不碰文件，采纳才落盘并且留旧稿。
 * 使用者要能在「不满意」时零成本退出，所以这个边界值得测。
 */

function project({ text = '# 第1章 开局\n\n他推开门。雨很大。\n\n屋里没人。\n' } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-editor-'))
  const dir = path.join(cwd, 'novel_projects', '书')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '正文', '第1章_开局.md'), text, 'utf8')
  return { cwd, dir, file: path.join(dir, '正文', '第1章_开局.md'), text }
}

test('readChapter 返回正文与字数', () => {
  const p = project()
  try {
    const got = readChapter(p.cwd, '书', 1)
    assert.equal(got.number, 1)
    assert.equal(got.title, '开局')
    assert.match(got.text, /他推开门/u)
    assert.equal(readChapter(p.cwd, '书', 99), undefined)
  } finally { fs.rmSync(p.cwd, { recursive: true, force: true }) }
})

test('readChapter 对没有章节的书返回 undefined', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-editor-empty-'))
  try {
    fs.mkdirSync(path.join(cwd, 'novel_projects', '空'), { recursive: true })
    assert.equal(readChapter(cwd, '空', 1), undefined)
  } finally { fs.rmSync(cwd, { recursive: true, force: true }) }
})

test('生成候选时不写任何文件', async () => {
  const p = project()
  try {
    const before = fs.readFileSync(p.file, 'utf8')
    const ctx = {
      get: (n) => (n === 'llm' ? {
        async listProviders() { return [{ id: 'p' }] },
        async resolveModelInfo(x, y) { return { provider: x, id: y, reasoning: { efforts: [] } } },
        stream() {
          const body = '他推开门。雨下得很大。'
          async function* gen() {
            yield { type: 'block-start', index: 0, blockType: 'text' }
            yield { type: 'text-delta', index: 0, text: body }
            yield { type: 'block-end', index: 0, block: { type: 'text', text: body } }
            yield { type: 'finish', reason: { kind: 'stop' } }
          }
          return gen()
        },
      } : undefined),
    }
    const config = { guidance: { provider: 'p', model: 'm' } }
    const out = await proposeSnippet(ctx, {
      cwd: p.cwd, name: '书', number: 1, snippet: '他推开门。雨很大。', mode: 'polish', config,
    })
    assert.match(out.text, /雨下得很大/u)
    // 关键：磁盘没变，旧稿目录也没生成
    assert.equal(fs.readFileSync(p.file, 'utf8'), before)
    assert.equal(fs.existsSync(path.join(p.dir, '正文', '_旧稿')), false)
  } finally { fs.rmSync(p.cwd, { recursive: true, force: true }) }
})

test('片段不在这一章里时拒绝，不去改', async () => {
  const p = project()
  try {
    const ctx = { get: () => undefined }
    await assert.rejects(
      proposeSnippet(ctx, { cwd: p.cwd, name: '书', number: 1, snippet: '这句话根本不在文里', config: { guidance: { provider: 'p', model: 'm' } } }),
      /没有出现在这一章里/u,
    )
  } finally { fs.rmSync(p.cwd, { recursive: true, force: true }) }
})

test('没有配置模型时给明确提示，不发请求', async () => {
  const p = project()
  try {
    let called = false
    const ctx = { get: () => ({ stream() { called = true } }) }
    await assert.rejects(
      proposeSnippet(ctx, { cwd: p.cwd, name: '书', number: 1, snippet: '他推开门。', config: {} }),
      /尚未配置模型/u,
    )
    assert.equal(called, false)
  } finally { fs.rmSync(p.cwd, { recursive: true, force: true }) }
})

test('采纳后替换成功，并留下旧稿', () => {
  const p = project()
  try {
    const out = applySnippet(p.cwd, '书', 1, '他推开门。雨很大。', '他推开门。雨下得很大。')
    assert.equal(out.ok, true)
    const after = fs.readFileSync(p.file, 'utf8')
    assert.match(after, /雨下得很大/u)
    assert.doesNotMatch(after, /雨很大。/u)
    // 旧稿里有原文
    const backup = path.join(p.dir, ...out.backup.split('/'))
    assert.equal(fs.existsSync(backup), true)
    assert.match(fs.readFileSync(backup, 'utf8'), /雨很大/u)
  } finally { fs.rmSync(p.cwd, { recursive: true, force: true }) }
})

test('原文重复出现时拒绝采纳，避免改错地方', () => {
  const p = project({ text: '# 第1章 开局\n\n他走了。\n\n他走了。\n' })
  try {
    assert.throws(() => applySnippet(p.cwd, '书', 1, '他走了。', '他离开了。'), /出现了 2 次/u)
    // 文件没被改
    assert.equal(fs.readFileSync(p.file, 'utf8').match(/他走了。/gu).length, 2)
  } finally { fs.rmSync(p.cwd, { recursive: true, force: true }) }
})

test('原文已不存在时拒绝采纳', () => {
  const p = project()
  try {
    assert.throws(() => applySnippet(p.cwd, '书', 1, '这段话不在了', '新的'), /已经不在了/u)
  } finally { fs.rmSync(p.cwd, { recursive: true, force: true }) }
})

test('空替换被拒绝，不会把正文删成空', () => {
  const p = project()
  try {
    const before = fs.readFileSync(p.file, 'utf8')
    assert.throws(() => applySnippet(p.cwd, '书', 1, '他推开门。雨很大。', '   '), /改写结果为空/u)
    assert.equal(fs.readFileSync(p.file, 'utf8'), before)
  } finally { fs.rmSync(p.cwd, { recursive: true, force: true }) }
})
