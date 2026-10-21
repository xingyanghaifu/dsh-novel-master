import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actualModelOf, mainModelOf } from '../src/model-intelligence.js'

/**
 * 「没选模型就用当前模型」不能只靠会话历史。
 *
 * 会话历史里没有记录时（新会话的第一条命令），旧实现返回 known:false，
 * 于是每个要模型的命令都报「没有可用的模型路由」——可宿主明明配了主模型。
 * 这里盯住的就是这条回退，以及它不会盖掉已经观测到的会话路由。
 */

/** 造一个只提供 settings 的 ctx。 */
function ctxWithMainModel(provider = 'docode', model = 'claude-opus-5-5') {
  return {
    get(name) {
      if (name !== 'settings') return undefined
      return { get: key => (key === 'agent-default-model' ? { provider, model } : undefined) }
    },
  }
}

test('会话没有记录时回退到宿主主模型', async () => {
  const ctx = ctxWithMainModel()
  // agent 存在但没有 sessionController，等于「还没有任何观测」
  const result = await actualModelOf({ id: 'sess-1' }, ctx)
  assert.equal(result.known, true)
  assert.equal(result.provider, 'docode')
  assert.equal(result.model, 'claude-opus-5-5')
  assert.equal(result.source, 'main-model')
})

test('没有任何会话信息时也能拿到主模型', async () => {
  const result = await actualModelOf(undefined, ctxWithMainModel())
  assert.equal(result.known, true)
  assert.equal(result.provider, 'docode')
})

test('主模型带 reasoningEffort 时一并带出', async () => {
  const ctx = {
    get: name => (name === 'settings'
      ? { get: key => (key === 'agent-default-model' ? { provider: 'p', model: 'm', reasoningEffort: 'high' } : undefined) }
      : undefined),
  }
  const result = await mainModelOf(ctx)
  assert.equal(result.reasoningEffort, 'high')
})

test('宿主没有 settings 服务时仍是未知，不瞎编', async () => {
  const ctx = { get: () => undefined }
  const result = await actualModelOf({ id: 's' }, ctx)
  assert.equal(result.known, false)
})

test('主模型字段不全时不当作可用路由', async () => {
  const ctx = {
    get: name => (name === 'settings'
      ? { get: key => (key === 'agent-default-model' ? { provider: 'p' } : undefined) }
      : undefined),
  }
  assert.equal(mainModelOf(ctx), undefined)
})

test('settings 抛异常时不影响主流程', () => {
  const ctx = { get: () => ({ get: () => { throw new Error('boom') } }) }
  assert.equal(mainModelOf(ctx), undefined)
})

test('已经观测到会话路由时，不被主模型覆盖', async () => {
  const ctx = {
    get(name) {
      if (name === 'settings') return { get: () => ({ provider: 'main-p', model: 'main-m' }) }
      if (name === 'sessionController') {
        return {
          inspect: async () => ({
            events: [{ type: 'request/header', data: { header: { config: { provider: 'seen-p', model: 'seen-m' } } } }],
          }),
        }
      }
      return undefined
    },
  }
  const result = await actualModelOf({ id: 'sess' }, ctx)
  assert.equal(result.provider, 'seen-p')
  assert.equal(result.model, 'seen-m')
  assert.notEqual(result.source, 'main-model')
})
