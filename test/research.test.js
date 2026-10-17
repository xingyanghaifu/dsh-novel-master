import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { researchCommand, researchStoragePath, CredibilityEvaluator, trendAnalysisCommand } from '../src/research.js'

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
  assert.equal(record.documents[0].credibility.method, 'metadata-heuristic')
  const report = fs.readFileSync(path.join(h.cwd, 'retrieved', files.find(name => name.endsWith('.md'))), 'utf8')
  assert.match(report, /来源元数据评分（启发式参考）/u)
  assert.match(report, /不验证内容真伪/u)
  assert.match(report, /启发式参考（低）/u)
  assert.doesNotMatch(report, /undefined/u)
  assert.match(result.text, /所有来源和结论均需人工核验/u)
  h.cleanup()
})

test('research rejects fabricated citations and does not persist a report', async () => {
  const h = harness({ output: { answer: '结论', facts: [{ claim: '伪造', value: '1', sourceUrls: ['https://untrusted.test/fake'], confidence: .9 }], limitations: [], sources: [] } })
  const result = await h.run('topic')
  assert.equal(result.kind, 'error')
  assert.equal(fs.existsSync(path.join(h.cwd, 'retrieved')), false)
  h.cleanup()
})
test('credibility source classification uses parsed hostnames rather than URL text', () => {
  assert.equal(CredibilityEvaluator.evaluateSourceType({ url: 'https://agency.gov.cn/reports' }), 95)
  assert.equal(CredibilityEvaluator.evaluateSourceType({ url: 'https://journals.cnki.net/paper' }), 95)
  assert.equal(CredibilityEvaluator.evaluateSourceType({ url: 'https://forum.example.test/topic' }), 65)
  assert.equal(CredibilityEvaluator.evaluateSourceType({ url: 'https://evil.example.test/article?next=.gov' }), 50)
  assert.equal(CredibilityEvaluator.evaluateSourceType({ url: 'https://evil.edu.attacker.test/paper' }), 50)
  assert.equal(CredibilityEvaluator.evaluateSourceType({ url: 'https://example.test/wikipedia.org/news' }), 50)
  assert.equal(CredibilityEvaluator.evaluateSourceType({ url: 'javascript:alert(1)' }), 50)
})

test('invalid, missing, and future dates earn no timeliness bonus', () => {
  assert.equal(CredibilityEvaluator.evaluateTimeliness(undefined), 0)
  assert.equal(CredibilityEvaluator.evaluateTimeliness('not-a-date'), 0)
  assert.equal(CredibilityEvaluator.evaluateTimeliness(new Date(Date.now() + 60_000).toISOString()), 0)
  assert.equal(CredibilityEvaluator.evaluateTimeliness(new Date(Date.now() - 60_000).toISOString()), 100)
})

test('credibility formula uses consistent 0-100 weights, caps scores, and labels them heuristic', () => {
  const result = CredibilityEvaluator.evaluateSource({
    url: 'https://agency.gov.cn/paper',
    publishedAt: new Date().toISOString(),
    fetched: true,
  })
  assert.deepEqual(result.breakdown, { sourceType: 95, timeliness: 100, fetchSuccess: 100 })
  assert.equal(result.score, 97)
  assert.equal(result.level, '高')
  assert.equal(result.label, '启发式参考（高）')
  assert.equal(result.method, 'metadata-heuristic')

  const originalSourceType = CredibilityEvaluator.evaluateSourceType
  const originalTimeliness = CredibilityEvaluator.evaluateTimeliness
  try {
    CredibilityEvaluator.evaluateSourceType = () => 150
    CredibilityEvaluator.evaluateTimeliness = () => 150
    assert.equal(CredibilityEvaluator.evaluateSource({ fetched: true }).score, 100)
  } finally {
    CredibilityEvaluator.evaluateSourceType = originalSourceType
    CredibilityEvaluator.evaluateTimeliness = originalTimeliness
  }
})

test('trend reports are explicit static demos and never claim live market evidence or advice', async () => {
  const command = trendAnalysisCommand({ get: () => { throw new Error('trend command must not fetch market data') } }, { enabled: true })
  const week = await command.handler({ rawInput: '7d' })
  const quarter = await command.handler({ rawInput: '90d' })
  assert.equal(week.kind, 'success')
  assert.equal(quarter.kind, 'success')
  for (const result of [week, quarter]) {
    assert.match(result.text, /静态演示/u)
    assert.match(result.text, /不代表真实市场数据/u)
    assert.match(result.text, /未查询平台榜单或社交媒体/u)
    assert.match(result.text, /不同范围使用相同静态数据/u)
    assert.match(result.text, /不据此判断题材需求、增长或入场时机/u)
    assert.doesNotMatch(result.text, /综合网文平台榜单|社交媒体讨论热度|市场需求强劲|建议入场|不建议新手入场/u)
  }
  const sampleSection = result => result.text.match(/## 静态题材样例[\s\S]*?## 静态创意组合示例/u)?.[0]
  assert.ok(sampleSection(week))
  assert.equal(sampleSection(week), sampleSection(quarter))
})

test('unsafe relative storage traversal is rejected', () => {
  assert.throws(() => researchStoragePath('C:\\work\\novel', '..\\outside'), /必须位于工作目录内/)
})

