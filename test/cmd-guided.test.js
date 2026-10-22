import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * /novel-guided 写到一半失败时，必须把已写好的章报出来。
 *
 * 曾经的行为：第 1 章写盘成功、第 2 章失败，返回「引导写作失败：配额用尽」。
 * 用户以为全失败，重跑又会撞上「第1章已存在，拒绝覆盖」——而那些章其实
 * 已经写在磁盘上了，钱也花了。
 */

const src = path.join(import.meta.dirname, '..', 'src', 'index.js')
const mod = await import(pathToFileURL(src).href)

/** 假宿主：按调用序号决定成功或失败。 */
function host({ failAt }) {
  let call = 0
  const llm = {
    async listProviders() { return [{ id: 'strong' }] },
    async resolveModelInfo(p, m) { return { provider: p, id: m, reasoning: { efforts: [] } } },
    stream() {
      call++
      if (call === failAt) {
        async function* gen() {
          yield { type: 'finish', reason: { kind: 'error', failure: { message: '配额用尽' } } }
        }
        return gen()
      }
      // 奇数调用 = 引导，偶数 = 写作
      const payload = call % 2 === 1 ? '【场景】\n1. 某场景' : '# 第N章 标题\n\n正文。'
      async function* gen() {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: payload }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: payload } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
      return gen()
    },
  }
  const registered = new Map()
  const ctx = {
    get: (n) => (n === 'settings'
      ? { get: () => ({ provider: 'strong', model: 's1' }) }
      : n === 'llm' ? llm : undefined),
    on: () => ({ dispose() {} }),
    commands: { register: (d) => { registered.set(d.name, d); return { dispose() {} } } },
  }
  return { ctx, registered }
}

async function setup({ failAt }) {
  const { ctx, registered } = host({ failAt })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-guided-partial-'))
  const cfg = mod.Config['~standard'].validate({
    projectsDir: tmp,
    guidance: { enabled: true, provider: 'strong', model: 's1', writingProvider: 'strong', writingModel: 's1' },
  }).value
  await mod.apply(ctx, cfg, { logger: { info() {}, warn() {}, error() {} } })
  const proj = path.join(tmp, '测试书')
  fs.mkdirSync(path.join(proj, '正文'), { recursive: true })
  fs.writeFileSync(path.join(proj, '设定.md'), '# 设定\n', 'utf8')
  return {
    tmp,
    proj,
    run: (rawInput) => registered.get('novel-guided').handler({
      agent: { id: 'a', followup: () => {} }, cwd: tmp, session: { cwd: tmp }, workspace: { cwd: tmp },
      rawInput, attachments: [], signal: new AbortController().signal,
    }),
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  }
}

test('第 2 章失败时，报告已经写好的第 1 章', async () => {
  // 调用 1-2 = 第1章（引导+写作）成功，调用 3 = 第2章的引导失败
  const h = await setup({ failAt: 3 })
  try {
    const r = await h.run('测试书 3章')
    assert.equal(r.kind, 'error')
    // 磁盘上真的有第 1 章
    assert.equal(fs.readdirSync(path.join(h.proj, '正文')).length, 1)
    // 而且必须告诉用户，不能只说「失败」
    assert.match(r.text, /第 1 章已写好|前 1 章已写好/u)
    assert.match(r.text, /配额用尽/u)
    assert.match(r.text, /\/novel-guided/u)
  } finally { h.cleanup() }
})

test('第 1 章就失败时，不谎报有任何章写好', async () => {
  const h = await setup({ failAt: 1 })
  try {
    const r = await h.run('测试书 3章')
    assert.equal(r.kind, 'error')
    assert.equal(fs.readdirSync(path.join(h.proj, '正文')).length, 0)
    assert.doesNotMatch(r.text, /已写好/u)
  } finally { h.cleanup() }
})

test('全部成功时报告章数与文件', async () => {
  const h = await setup({ failAt: 0 })
  try {
    const r = await h.run('测试书 2章')
    assert.equal(r.kind, 'success')
    assert.equal(fs.readdirSync(path.join(h.proj, '正文')).length, 2)
    assert.match(r.text, /2 章/u)
  } finally { h.cleanup() }
})

test('引导未开启时明确提示怎么开', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-guided-off-'))
  try {
    const { ctx, registered } = host({ failAt: 0 })
    const cfg = mod.Config['~standard'].validate({ projectsDir: tmp, guidance: { enabled: false } }).value
    await mod.apply(ctx, cfg, { logger: { info() {}, warn() {}, error() {} } })
    const r = await registered.get('novel-guided').handler({
      agent: { id: 'a', followup: () => {} }, cwd: tmp, session: { cwd: tmp }, workspace: { cwd: tmp },
      rawInput: '测试书 1章', attachments: [], signal: new AbortController().signal,
    })
    assert.equal(r.kind, 'error')
    assert.match(r.text, /引导-写作分离没有开启/u)
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
})
