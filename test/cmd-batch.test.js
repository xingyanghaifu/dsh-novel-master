import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { batchCommand } from '../src/cmd-batch.js'
import { withProjectsDirectory } from '../src/project.js'

const stop = { type: 'finish', reason: { kind: 'stop' } }
const route = { provider: 'paid', model: 'paid-model' }

function root() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-cmd-batch-'))
  const dir = path.join(cwd, 'novel_projects', '书')
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '项目.json'), `${JSON.stringify({ title: '书', target: 3 }, null, 2)}\n`, 'utf8')
  return cwd
}

function host({ reply = '===第1章===\n# 第1章 一\n正文一\n', known = false } = {}) {
  const calls = []
  const llm = {
    listProviders: () => [{ id: route.provider }],
    resolveModelInfo: async (provider, model) => ({ provider, id: model }),
    stream: options => {
      calls.push(options)
      return (async function * () { yield { type: 'text-delta', index: 0, text: reply }; yield stop })()
    },
  }
  const ctx = {
    get: name => {
      if (name === 'llm') return llm
      if (name === 'sessionController') return {
        inspect: async () => ({
          events: known
            ? [{ type: 'assistant/message', seq: 1, data: { message: { source: { kind: 'model', provider: route.provider, model: route.model } } } }]
            : [],
        }),
      }
      return undefined
    },
  }
  return { ctx, calls }
}

const invoke = (cwd, rawInput) => ({ rawInput, cwd, agent: { id: 's1', session: { header: { cwd } } }, signal: new AbortController().signal })

test('batch command refuses to guess a model when none is configured or observed', async () => {
  const cwd = root()
  const h = host({ known: false })
  const command = batchCommand(h.ctx, { provider: '', model: '', chaptersPerRequest: 1 })
  const result = await withProjectsDirectory('novel_projects', () => command.handler(invoke(cwd, '书 3章')))
  assert.equal(result.kind, 'error')
  assert.match(result.text, /不知道该调用哪个模型/u)
  assert.equal(h.calls.length, 0, 'no request may be billed without a chosen route')
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('configured model writes one batch and reports the billed request count', async () => {
  const cwd = root()
  const h = host({ known: false })
  const command = batchCommand(h.ctx, { ...route, chaptersPerRequest: 1 })
  const result = await withProjectsDirectory('novel_projects', () => command.handler(invoke(cwd, '书 1章')))
  assert.equal(result.kind, 'success', result.text)
  assert.match(result.text, /1 次/u)
  assert.equal(h.calls.length, 1)
  const files = fs.readdirSync(path.join(cwd, 'novel_projects', '书', '正文'))
  assert.equal(files.length, 1)
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('observed session route is used when the config leaves the model blank', async () => {
  const cwd = root()
  const h = host({ known: true })
  const command = batchCommand(h.ctx, { provider: '', model: '', chaptersPerRequest: 1 })
  const result = await withProjectsDirectory('novel_projects', () => command.handler(invoke(cwd, '书 1章')))
  assert.equal(result.kind, 'success', result.text)
  assert.equal(h.calls[0].provider, route.provider)
  assert.equal(h.calls[0].model, route.model)
  fs.rmSync(cwd, { recursive: true, force: true })
})

test('live config references are unwrapped instead of stringified', async () => {
  const cwd = root()
  const h = host({ known: false })
  const live = value => ({ get: () => value })
  const command = batchCommand(h.ctx, { provider: live(route.provider), model: live(route.model), reasoningEffort: live(''), chaptersPerRequest: live(1) })
  const result = await withProjectsDirectory('novel_projects', () => command.handler(invoke(cwd, '书 1章')))
  assert.equal(result.kind, 'success', result.text)
  assert.equal(h.calls[0].provider, route.provider)
  assert.equal(h.calls[0].model, route.model)
  assert.notEqual(h.calls[0].provider, '[object Object]')
  assert.equal(fs.readdirSync(path.join(cwd, 'novel_projects', '书', '正文')).length, 1)
  fs.rmSync(cwd, { recursive: true, force: true })
})
