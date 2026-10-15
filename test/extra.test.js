import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EXTRA_COMMANDS } from '../src/cmd-extra.js'
import { withProjectsDirectory } from '../src/project.js'

function fixture(t, directory = 'novel_projects') {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-extra-'))
  t.after(() => {
    assert.equal(path.dirname(cwd), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(cwd).startsWith('novel-extra-'))
    fs.rmSync(cwd, { recursive: true, force: true })
  })
  const dir = path.join(cwd, directory, '测试书')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '项目.json'), '{"title":"测试书"}')
  fs.writeFileSync(path.join(dir, '大纲.md'), '第一章：开端；第二章：转折；第三章：终局')
  const originals = ['# 第一章\n\n' + '甲🙂。'.repeat(200), '# 第二章\n\n' + '乙！'.repeat(150), '# 第三章\n\n终局。']
  originals.forEach((text, i) => fs.writeFileSync(path.join(dir, '正文', `第${i + 1}章_测试.md`), text))
  const tasks = []
  const run = (key, rawInput = '') => withProjectsDirectory(directory, () => EXTRA_COMMANDS.find((c) => c.key === key).factory().handler({
    rawInput, attachments: [], signal: new AbortController().signal,
    agent: { session: { header: { cwd } }, followup: (message) => tasks.push(message) },
  }))
  const ids = () => fs.existsSync(path.join(dir, '备份')) ? fs.readdirSync(path.join(dir, '备份')).sort() : []
  const text = () => tasks.at(-1).content.map((part) => part.text ?? '').join('\n')
  return { cwd, dir, run, ids, tasks, text, originals }
}

function success(result) { assert.equal(result.kind, 'success', result.text); return result.text }
function error(result, re) { assert.equal(result.kind, 'error', result.text); if (re) assert.match(result.text, re) }

test('EXTRA_COMMANDS supplies seven distinct factory entries', () => {
  assert.deepEqual(EXTRA_COMMANDS.map((c) => c.key), ['compare', 'chapter', 'backup', 'merge', 'split', 'tips', 'trope'])
  for (const entry of EXTRA_COMMANDS) {
    assert.ok(entry.title)
    assert.equal(entry.factory().name, `novel-${entry.key}`)
  }
})

test('backup preview and roundtrip preserve unrelated files and pre-restore state', (t) => {
  const h = fixture(t)
  const chapter = path.join(h.dir, '正文', '第1章_测试.md')
  success(h.run('backup'))
  const id = h.ids()[0]
  assert.ok(id)
  const manifestFile = path.join(h.dir, '备份', id, 'manifest.json')
  const originalManifest = fs.readFileSync(manifestFile)
  fs.writeFileSync(chapter, '修改后的正文')
  fs.writeFileSync(path.join(h.dir, '额外笔记.md'), '保留我')
  const preview = success(h.run('backup', `restore ${id}`))
  assert.match(preview, /恢复预览/u)
  assert.match(preview, /--apply/u)
  assert.equal(fs.readFileSync(chapter, 'utf8'), '修改后的正文')
  assert.equal(h.ids().length, 1)
  assert.match(success(h.run('backup', `diff ${id}`)), /修改 正文\/第1章_测试.md/u)
  success(h.run('backup', `restore ${id} --apply`))
  assert.equal(fs.readFileSync(chapter, 'utf8'), h.originals[0])
  assert.equal(fs.readFileSync(path.join(h.dir, '额外笔记.md'), 'utf8'), '保留我')
  const preserved = h.ids().find((value) => value.startsWith('pre-restore-'))
  assert.ok(preserved)
  assert.equal(fs.readFileSync(path.join(h.dir, '备份', preserved, 'files', '正文', '第1章_测试.md'), 'utf8'), '修改后的正文')
  assert.deepEqual(fs.readFileSync(manifestFile), originalManifest)
  success(h.run('backup'))
  assert.equal(h.ids().length, 3)
  const next = h.ids().find((value) => value !== id && value !== preserved)
  assert.match(success(h.run('backup', `diff ${id} ${next}`)), /额外笔记/u)
  const secondManifest = JSON.parse(fs.readFileSync(path.join(h.dir, '备份', next, 'manifest.json'), 'utf8'))
  assert.ok(secondManifest.files.every((entry) => !entry.path.startsWith('备份/')))
})

test('tampered payload and traversal manifest are rejected before any writes', (t) => {
  const h = fixture(t)
  success(h.run('backup'))
  const id = h.ids()[0]
  const base = path.join(h.dir, '备份', id)
  const manifestPath = path.join(base, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const first = manifest.files[0]
  const payload = path.join(base, 'files', ...first.path.split('/'))
  const original = fs.readFileSync(payload)
  fs.writeFileSync(payload, '篡改')
  error(h.run('backup', `restore ${id} --apply`), /哈希校验失败/u)
  assert.equal(h.ids().length, 1)
  assert.equal(fs.readFileSync(path.join(h.dir, '正文', '第1章_测试.md'), 'utf8'), h.originals[0])
  fs.writeFileSync(payload, original)
  first.path = '../outside.md'
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))
  error(h.run('backup', `restore ${id} --apply`), /不安全路径/u)
  assert.equal(fs.existsSync(path.join(h.dir, '..', 'outside.md')), false)
  error(h.run('backup', 'restore ../../escape --apply'), /备份 ID/u)
})

test('backup rejects links and restore refuses a symlink destination', (t) => {
  const h = fixture(t)
  const outside = path.join(h.cwd, 'outside.txt')
  fs.writeFileSync(outside, '外部原文')
  success(h.run('backup'))
  const id = h.ids()[0]
  const chapter = path.join(h.dir, '正文', '第1章_测试.md')
  // Verified fixture-owned regular file; replace it with a link for rejection test.
  assert.equal(path.dirname(chapter), path.join(h.dir, '正文'))
  fs.unlinkSync(chapter)
  try { fs.symlinkSync(outside, chapter, 'file') }
  catch (cause) { if (['EPERM', 'EACCES'].includes(cause.code)) { t.skip('OS does not permit symbolic links'); return } throw cause }
  error(h.run('backup', `restore ${id} --apply`), /符号链接/u)
  error(h.run('backup'), /符号链接/u)
  assert.equal(fs.readFileSync(outside, 'utf8'), '外部原文')
})

test('merge and split are non-destructive and reject missing or duplicate chapter ranges', (t) => {
  const h = fixture(t)
  for (const range of ['1-4', '1-2,2', '3-1', '0', '1,,2']) error(h.run('merge', range))
  assert.equal(fs.existsSync(path.join(h.dir, '整理')), false)
  success(h.run('merge', '1-2'))
  let dirs = fs.readdirSync(path.join(h.dir, '整理'))
  const merged = fs.readFileSync(path.join(h.dir, '整理', dirs[0], '合并.md'), 'utf8')
  assert.equal(merged, `${h.originals[0]}\n\n---\n\n${h.originals[1]}`)
  success(h.run('split', '1-2 --length 200 --name 分卷'))
  dirs = fs.readdirSync(path.join(h.dir, '整理'))
  const split = path.join(h.dir, '整理', dirs.find((name) => name.startsWith('分卷-')))
  const pieces = fs.readdirSync(split).filter((name) => name.startsWith('片段')).sort().map((name) => fs.readFileSync(path.join(split, name), 'utf8'))
  assert.ok(pieces.every((text) => Array.from(text).length <= 200 && !text.includes('\ufffd')))
  assert.equal(pieces.join(''), h.originals[0] + h.originals[1])
  for (const size of ['0', '-1', '1e3', 'Infinity', '20001']) error(h.run('split', `1 --length ${size}`))
  error(h.run('split', '1-2,2'))
  error(h.run('split', '1 --name ../unsafe'))
  h.originals.forEach((text, i) => assert.equal(fs.readFileSync(path.join(h.dir, '正文', `第${i + 1}章_测试.md`), 'utf8'), text))
})

test('merge across projects records sources and refuses duplicate projects', (t) => {
  const h = fixture(t)
  const other = path.join(h.cwd, 'novel_projects', '第二部', '正文')
  fs.mkdirSync(other, { recursive: true })
  fs.writeFileSync(path.join(other, '第1章_新篇.md'), '第二部原文')
  success(h.run('merge', '测试书 第二部'))
  error(h.run('merge', '测试书 测试书'))
  error(h.run('merge', '测试书 不存在的项目'))
  assert.equal(fs.readFileSync(path.join(other, '第1章_新篇.md'), 'utf8'), '第二部原文')
})

test('duplicate chapter numbers are rejected instead of silently choosing one', (t) => {
  const h = fixture(t)
  fs.writeFileSync(path.join(h.dir, '正文', '第1章_重复.md'), '重复正文')
  error(h.run('merge', '1-2'), /重复章节号/u)
  error(h.run('split', '1'), /重复章节号/u)
  error(h.run('chapter', '4'), /重复章节号/u)
})

test('model commands validate requests and use explicit scoped outputs', (t) => {
  const h = fixture(t)
  for (const [key, input] of [['compare', ''], ['compare', 'missing.txt'], ['compare', '../outside.txt'], ['tips', ''], ['trope', ''], ['chapter', ''], ['chapter', '0'], ['chapter', '1-11'], ['chapter', '4 --length 0'], ['chapter', '4 --bogus']]) {
    error(h.run(key, input))
  }
  error(h.run('chapter', '1'), /--draft/u)
  assert.equal(h.tasks.length, 0)
  const reference = path.join(h.cwd, '参考 文本.txt')
  fs.writeFileSync(reference, '第一章：参考片段')
  success(h.run('compare', '"参考 文本.txt"'))
  assert.ok(h.text().includes(JSON.stringify(reference)))
  assert.ok(h.text().includes(JSON.stringify(h.dir)))
  assert.match(h.text(), /报告\.md/u)
  assert.match(h.text(), /不得编造相似度百分比/u)
  success(h.run('chapter', '1 --draft --style "轻松 幽默" --length 2000'))
  assert.match(h.text(), /章节草稿/u)
  assert.match(h.text(), /第1章_草稿\.md/u)
  success(h.run('chapter', '4'))
  assert.ok(h.text().includes(JSON.stringify(path.join(h.dir, '正文', '第4章_草稿.md'))))
  for (const [key, topic] of [['tips', '开头'], ['trope', '身份揭秘']]) {
    success(h.run(key, topic))
    assert.ok(h.text().includes(JSON.stringify(h.dir)))
    assert.match(h.text(), /报告\.md/u)
    assert.match(h.text(), /模型生成的建议/u)
  }
  assert.equal(fs.existsSync(path.join(h.dir, '正文', '第4章_草稿.md')), false)
  assert.equal(fs.readFileSync(path.join(h.dir, '正文', '第1章_测试.md'), 'utf8'), h.originals[0])
})

test('configured project directory flows into model prompts and deterministic files', (t) => {
  const h = fixture(t, '作品/自定义')
  success(h.run('tips', '测试书 开头'))
  assert.ok(h.text().includes(JSON.stringify(h.dir)))
  success(h.run('backup', '测试书'))
  assert.equal(h.ids().length, 1)
  success(h.run('merge', '测试书 1-2'))
  assert.equal(fs.existsSync(path.join(h.cwd, 'novel_projects')), false)
})
