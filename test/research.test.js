import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { researchCommand, researchStoragePath } from '../src/research.js'

const route = { provider: 'academic', model: 'verifier' }
const stop = { type: 'finish', reason: { kind: 'stop' } }
function harness({ enabled = true, sources = [{ url: 'https://example.test/paper', title: 'Paper', snippet: 'abstract' }], output = { answer: '结论', facts: [{ claim: '样本', value: '42', sourceUrls: ['https://example.test/paper'], confidence: .9, confidenceLabel: '高', reason: '来源正文明确' }], limitations: [], sources: [{ url: 'https://example.test/paper', title: 'Paper' }] } } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-research-'))
  const calls = []
  const web = { search: async () => ({ content: 'search', sources }), fetch: async () => ({ statusCode: 200, body: { kind: 'text', content: 'full source body' }, truncated: false }) }
  const llm = { listProviders: () => [{ id: route.provider }], resolveModelInfo: async (provider, model) => ({ provider, id: model }), stream: options => { calls.push(options); return (async function * () { yield { type: 'text-delta', index: 0, text: JSON.stringify(output) }; yield stop })() } }
  const config = { enabled, provider: route.provider, model: route.model, storageDir: 'retrieved', maxResults: 5, maxSourceChars: 1000, timeoutMs: 10000 }
  const command = researchCommand({ get: key => key === 'web' ? web : key === 'llm' ? llm : undefined }, config)
  const run = rawInput => command.handler({ rawInput, agent: { session: { header: { cwd } } }, signal: new AbortController().signal })
  return { cwd, calls, run, cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) }
}

test('disabled research performs no writes or network calls', async () => {
  const h = harness({ enabled: false })
  const result = await h.run('topic')
  assert.equal(result.kind, 'error')
  assert.equal(fs.existsSync(path.join(h.cwd, 'retrieved')), false)
  h.cleanup()
})

test('research fetches sources, routes synthesis, and persists evidence', async () => {
  const h = harness()
  const result = await h.run('academic topic')
  assert.equal(result.kind, 'success')
  assert.equal(h.calls[0].provider, route.provider)
  assert.equal(h.calls[0].model, route.model)
  const files = fs.readdirSync(path.join(h.cwd, 'retrieved'))
  assert.equal(files.filter(name => name.endsWith('.json')).length, 1)
  assert.equal(files.filter(name => name.endsWith('.md')).length, 1)
  const record = JSON.parse(fs.readFileSync(path.join(h.cwd, 'retrieved', files.find(name => name.endsWith('.json'))), 'utf8'))
  assert.equal(record.documents[0].fetched, true)
  assert.match(record.documents[0].text, /full source body/)
  h.cleanup()
})

test('research rejects fabricated citations and does not persist a report', async () => {
  const h = harness({ output: { answer: '结论', facts: [{ claim: '伪造', value: '1', sourceUrls: ['https://untrusted.test/fake'], confidence: .9 }], limitations: [], sources: [] } })
  const result = await h.run('topic')
  assert.equal(result.kind, 'error')
  assert.equal(fs.existsSync(path.join(h.cwd, 'retrieved')), false)
  h.cleanup()
})
test('unsafe relative storage traversal is rejected', () => {
  assert.throws(() => researchStoragePath('C:\\work\\novel', '..\\outside'), /必须位于工作目录内/)
})

