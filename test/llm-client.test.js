import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { expandPrompt } from '../src/llm-client.js'

/**
 * 配置不全时必须在发请求之前就失败。
 *
 * 这条路径处理 API 密钥。如果校验放在 fetch 之后，或者干脆漏掉，请求会带着
 * 一个空 key 发出去——既浪费一次往返，也可能把错误信息（含接口地址）回显给
 * 用户。这里锁住「不发请求」这个行为。
 */

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

/** 装上假 fetch，返回调用记录。任何调用都算失败。 */
function forbidFetch() {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    throw new Error('不该发出请求')
  }
  return calls
}

const full = {
  llm: {
    baseURL: 'https://api.example.com/v1',
    apiKey: 'sk-test',
    model: 'gpt-4o-mini',
  },
}

test('缺少密钥时立即报错，且不发请求', async () => {
  const calls = forbidFetch()
  await assert.rejects(
    expandPrompt({ config: { llm: { ...full.llm, apiKey: '' } }, brief: '一个剑客' }),
    /尚未配置对话模型密钥/u,
  )
  assert.equal(calls.length, 0)
})

test('缺少接口地址时立即报错，且不发请求', async () => {
  const calls = forbidFetch()
  await assert.rejects(
    expandPrompt({ config: { llm: { ...full.llm, baseURL: '' } }, brief: '一个剑客' }),
    /尚未配置对话模型接口地址/u,
  )
  assert.equal(calls.length, 0)
})

test('缺少模型时立即报错，且不发请求', async () => {
  const calls = forbidFetch()
  await assert.rejects(
    expandPrompt({ config: { llm: { ...full.llm, model: '' } }, brief: '一个剑客' }),
    /尚未选择对话模型/u,
  )
  assert.equal(calls.length, 0)
})

test('缺少描述时立即报错，且不发请求', async () => {
  const calls = forbidFetch()
  await assert.rejects(expandPrompt({ config: full, brief: '   ' }), /请先输入一句简短描述/u)
  assert.equal(calls.length, 0)
})

test('配置齐全时密钥只出现在请求头，不出现在 URL 里', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'a swordsman, cinematic' } }] }),
    }
  }
  const result = await expandPrompt({ config: full, brief: '一个剑客' })
  assert.ok(result.prompt.length > 0)
  assert.equal(calls.length, 1)
  // key 走 header
  assert.equal(calls[0].options.headers.authorization, 'Bearer sk-test')
  // 不能出现在 URL 里：URL 会被写进日志和错误信息
  assert.equal(calls[0].url.includes('sk-test'), false)
})
