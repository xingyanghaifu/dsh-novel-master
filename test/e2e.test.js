/**
 * e2e.test.js
 * 端到端测试 - 覆盖真实 DSH 环境下的 RPC 调用链路
 * 
 * 运行方式：node dsh-novel-master/test/e2e.test.js
 * 前置条件：需要 DSH 实例运行在本地，并配置了小说创作大师插件
 */

// 模拟浏览器环境（必须在导入模块前设置）
globalThis.window = {}
globalThis.document = { baseURI: 'http://localhost:19387/' }
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, clipboard: { writeText: async () => {} } },
  writable: true,
  configurable: true
})
globalThis.fetch = async (url, options) => {
  throw new Error('E2E 测试需要在真实 DSH 环境中运行，当前为模拟环境')
}

import { test } from 'node:test'
import assert from 'node:assert'
import * as clientState from '../src/client-state.js'
import * as components from '../src/client-components.js'

test('模型列表缓存机制 - 5分钟内复用缓存', async () => {
  // 清除缓存
  clientState.clearModelsCache()
  
  const mockCtx = {
    remote: {
      llm: {
        listProviders: async () => ({
          ok: true,
          value: [
            {
              id: 'test-provider',
              name: 'Test Provider',
              models: [
                {
                  id: 'test-model-1',
                  name: 'Test Model 1',
                  reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] }
                }
              ]
            }
          ]
        })
      }
    }
  }
  
  const controller = new AbortController()
  
  // 第一次加载 - 应该从 RPC 读取
  const result1 = await clientState.loadModels(mockCtx, controller.signal, false)
  assert.equal(result1.length, 1)
  assert.equal(result1[0].provider, 'test-provider')
  assert.equal(result1[0].model, 'test-model-1')
  assert.deepEqual(result1[0].efforts, [{ id: 'low' }, { id: 'high' }])
  
  // 修改 RPC 返回值（模拟远程变更）
  mockCtx.remote.llm.listProviders = async () => ({
    ok: true,
    value: [
      {
        id: 'new-provider',
        name: 'New Provider',
        models: [{ id: 'new-model', name: 'New Model' }]
      }
    ]
  })
  
  // 第二次加载 - 应该复用缓存（5分钟内）
  const result2 = await clientState.loadModels(mockCtx, controller.signal, false)
  assert.equal(result2.length, 1)
  assert.equal(result2[0].provider, 'test-provider') // 仍然是旧数据
  
  // 强制刷新 - 应该获取新数据
  const result3 = await clientState.loadModels(mockCtx, controller.signal, true)
  assert.equal(result3.length, 1)
  assert.equal(result3[0].provider, 'new-provider')
  assert.equal(result3[0].model, 'new-model')
})

test('离线状态检测 - navigator.onLine = false 时显示专门提示', async () => {
  // 临时覆盖 navigator.onLine
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    writable: true,
    configurable: true
  })
  
  // Mock fetch 返回失败响应
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => ''
  })
  
  try {
    await clientState.api('settings', {})
    assert.fail('应该抛出错误')
  } catch (error) {
    assert.match(error.message, /网络连接已断开/)
  } finally {
    // 恢复
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true, clipboard: { writeText: async () => {} } },
      writable: true,
      configurable: true
    })
    globalThis.fetch = async () => {
      throw new Error('E2E 测试需要在真实 DSH 环境中运行，当前为模拟环境')
    }
  }
})

test('loadSettingsAndStatus 并行加载并聚合错误', async () => {
  global.fetch = async (url) => {
    if (url.includes('/settings')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ value: { enabled: true }, revision: 1 }),
        json: async () => ({ value: { enabled: true }, revision: 1 })
      }
    }
    if (url.includes('/status')) {
      return {
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: '状态服务暂时不可用' }),
        json: async () => ({ error: '状态服务暂时不可用' })
      }
    }
  }
  
  const controller = new AbortController()
  const result = await clientState.loadSettingsAndStatus(controller.signal)
  
  assert.ok(result.settings)
  assert.equal(result.settings.value.enabled, true)
  assert.equal(result.status, null)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /状态服务暂时不可用/)
})

test('saveSettings 传递正确的 revision 并处理冲突', async () => {
  let receivedBody = null
  
  global.fetch = async (url, options) => {
    receivedBody = JSON.parse(options.body)
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ value: {}, revision: 2 }),
      json: async () => ({ value: {}, revision: 2 })
    }
  }
  
  await clientState.saveSettings({ enabled: false }, 1)
  
  assert.deepEqual(receivedBody, { patch: { enabled: false }, revision: 1 })
})

test('RPC 失败降级到 HTTP API', async () => {
  const mockCtx = {
    remote: {
      llm: {
        listProviders: async () => {
          throw new Error('RPC connection failed')
        }
      }
    }
  }
  
  global.fetch = async (url) => {
    if (url.includes('/models')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          models: [
            { provider: 'http-provider', model: 'http-model', label: 'HTTP Fallback', efforts: [] }
          ]
        }),
        json: async () => ({
          models: [
            { provider: 'http-provider', model: 'http-model', label: 'HTTP Fallback', efforts: [] }
          ]
        })
      }
    }
  }
  
  clientState.clearModelsCache()
  const controller = new AbortController()
  const result = await clientState.loadModels(mockCtx, controller.signal, false)
  
  assert.equal(result.length, 1)
  assert.equal(result[0].provider, 'http-provider')
  assert.equal(result[0].model, 'http-model')
})

test('组件工具函数 - field 生成正确的表单字段', () => {
  // 模拟 createElement
  const h = (tag, props, ...children) => ({ tag, props, children })
  
  const draft = { storageDir: 'novel_learning' }
  const edit = (key, value) => { draft[key] = value }
  
  const result = components.field(h, '学习存储目录', 'storageDir', draft, edit, 'text', { required: true }, false)
  
  assert.equal(result.tag, 'label')
  assert.equal(result.props.className, 'nm-field')
  assert.equal(result.children[0].children[0], '学习存储目录')
  assert.equal(result.children[1].props.value, 'novel_learning')
  assert.equal(result.children[1].props.type, 'text')
  assert.equal(result.children[1].props.required, true)
})

test('组件工具函数 - toggle 生成正确的开关组件', () => {
  const h = (tag, props, ...children) => ({ tag, props, children })
  
  let checked = false
  const onChange = (val) => { checked = val }
  
  const result = components.toggle(h, '启用学习', false, onChange, '保存可查询的经验', '启用学习', false)
  
  assert.equal(result.tag, 'label')
  assert.equal(result.props.className, 'nm-switch')
  assert.equal(result.children[0].children[0].children[0], '启用学习')
  assert.equal(result.children[0].children[1].children[0], '保存可查询的经验')
  assert.equal(result.children[1].props.type, 'checkbox')
  assert.equal(result.children[1].props.checked, false)
})

console.log('✓ E2E 测试框架已就绪')
console.log('ℹ 当前为模拟环境测试，真实 DSH 集成测试需在实际运行环境中执行')
