import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildBatchPrompt, runBatchWrite, splitBatchOutput, writeChapter } from '../src/batch-write.js'
import { BATCH_LIMITS, INTELLIGENCE_LIMITS, callText } from '../src/model-intelligence.js'
import { withProjectsDirectory } from '../src/project.js'

const route = { provider: 'paid-provider', model: 'paid-model', reasoningEffort: 'small' }
const stop = { type: 'finish', reason: { kind: 'stop' } }

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-batch-'))
  return root
}

function makeProject(root, name = '测试书') {
  const dir = path.join(root, 'novel_projects', name)
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '项目.json'), `${JSON.stringify({ title: '测试书', target: 6 }, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(dir, '写作规范.md'), '# 写作规范\n句子要短。\n', 'utf8')
  fs.writeFileSync(path.join(dir, '大纲.md'), '第1章 开场\n第2章 冲突\n第3章 转折\n', 'utf8')
  fs.writeFileSync(path.join(dir, '角色.md'), '主角：阿七，话少。\n', 'utf8')
  return dir
}

function host(chunks) {
  const calls = []
  const llm = {
    listProviders: () => [{ id: route.provider }],
    resolveModelInfo: async (provider, model) => ({ provider, id: model, reasoning: { efforts: [{ id: 'small' }] } }),
    stream: options => {
      calls.push(options)
      return (async function * () { for (const chunk of chunks) yield chunk })()
    },
  }
  return { ctx: { get: name => name === 'llm' ? llm : undefined }, calls }
}

const delta = text => ({ type: 'text-delta', index: 0, text })

test('batch limits are wider than defaults but still capped, and opt-in only', async () => {
  assert.ok(BATCH_LIMITS.inputChars > INTELLIGENCE_LIMITS.inputChars)
  assert.ok(BATCH_LIMITS.maxTokens > INTELLIGENCE_LIMITS.maxTokens)
  // Default requests keep the strict auxiliary bounds.
  const h = host([delta('x'), stop])
  await assert.rejects(callText(h.ctx, { ...route, prompt: 'x'.repeat(48001) }), error => error.code === 'input-limit')
  await assert.rejects(callText(h.ctx, { ...route, prompt: 'x', maxTokens: 9000 }), error => error.code === 'invalid-limit')
  // An unknown profile name cannot widen anything by accident.
  await assert.rejects(callText(h.ctx, { ...route, prompt: 'x', limits: 'unlimited' }), error => error.code === 'invalid-limit')
})

test('splitBatchOutput keeps only requested chapters and ignores prose markers', () => {
  const reply = [
    '前言会被丢弃', '===第2章===', '# 第2章 开端', '正文二', '===第3章===', '# 第3章 转折', '正文三', '===第99章===', '不该要的',
  ].join('\n')
  const out = splitBatchOutput(reply, [2, 3])
  assert.deepEqual(out.map(c => c.number), [2, 3])
  assert.match(out[0].body, /正文二/u)
  assert.deepEqual(splitBatchOutput('没有任何分隔标记的正文', [1]), [])
})

test('writeChapter refuses to overwrite an existing chapter with a different title', () => {
  const root = tempRoot()
  const dir = makeProject(root, '冲突书')
  writeChapter(dir, 1, '# 第1章 初遇\n\n第一版\n')
  assert.throws(() => writeChapter(dir, 1, '# 第1章 另一个标题\n\n第二版\n'), /已存在/u)
  // The original prose is intact.
  const files = fs.readdirSync(path.join(dir, '正文'))
  assert.equal(files.length, 1)
  assert.match(fs.readFileSync(path.join(dir, '正文', files[0]), 'utf8'), /第一版/u)
})

test('one billed request writes every requested chapter and inlines context', async () => {
  const root = tempRoot()
  const dir = makeProject(root, '批量书')
  const h = host([
    delta('===第1章===\n# 第1章 开场\n正文一\n'),
    delta('===第2章===\n# 第2章 冲突\n正文二\n'),
    stop,
  ])
  const result = await withProjectsDirectory('novel_projects', () => runBatchWrite(h.ctx, { cwd: root, signal: undefined }, {
    name: '批量书', count: 2, requirement: '节奏快些', config: route,
  }))
  assert.equal(result.written.length, 2)
  assert.equal(h.calls.length, 1, 'exactly one billed request')
  const prompt = h.calls[0].messages[0].content[0].text
  assert.equal(h.calls[0].tools.length, 0, 'no tool turns can add requests')
  assert.match(prompt, /角色\.md/u)
  assert.match(prompt, /阿七/u)
  assert.match(prompt, /节奏快些/u)
  assert.equal(fs.readdirSync(path.join(dir, '正文')).length, 2)
})

test('a reply without separators writes nothing and reports the failure', async () => {
  const root = tempRoot()
  const dir = makeProject(root, '空回复书')
  const h = host([delta('模型忘了写分隔标记'), stop])
  await assert.rejects(
    withProjectsDirectory('novel_projects', () => runBatchWrite(h.ctx, { cwd: root }, { name: '空回复书', count: 2, config: route })),
    /分隔标记/u,
  )
  assert.deepEqual(fs.readdirSync(path.join(dir, '正文')), [])
})

test('a duplicate chapter in the reply aborts before any file is written', async () => {
  const root = tempRoot()
  const dir = makeProject(root, '重复书')
  const h = host([
    delta('===第1章===\n# 第1章 甲\n正文一\n===第1章===\n# 第1章 乙\n正文二\n'),
    stop,
  ])
  await assert.rejects(
    withProjectsDirectory('novel_projects', () => runBatchWrite(h.ctx, { cwd: root }, { name: '重复书', count: 2, config: route })),
    /重复/u,
  )
  assert.deepEqual(fs.readdirSync(path.join(dir, '正文')), [])
})

test('buildBatchPrompt states the exact chapter range and separator', () => {
  const root = tempRoot()
  makeProject(root, '提示词书')
  const prompt = withProjectsDirectory('novel_projects', () => buildBatchPrompt({
    cwd: root,
    name: '提示词书',
    chapters: [{ number: 4, chars: 2500 }, { number: 5, chars: 2500 }],
    startChapter: 4,
    requirement: '',
  }))
  assert.match(prompt, /第 4 章到第 5 章/u)
  assert.match(prompt, /===第\{\{N\}\}章===/u)
  assert.match(prompt, /不要调用任何工具/u)
})
