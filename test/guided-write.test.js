import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildGuidanceContext, buildWritingPrompt, runGuidedChapter, saveGuidance,
} from '../src/guided-write.js'

/**
 * 引导-写作分离：强模型规划，弱模型执行。
 *
 * 这里守两件事：
 *   1. 两个模型各自拿到该看的东西（引导看资料不给规范；写作看指令给规范）
 *   2. 引导失败不能静默降级成单模型——那样用户以为用上了双模型，其实没有
 */

function project() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-guided-test-'))
  const name = '测试书'
  const dir = path.join(cwd, 'novel_projects', name)
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true })
  fs.writeFileSync(path.join(dir, '设定.md'), '# 设定\n\n网吧，现代都市，主角阿明。\n', 'utf8')
  fs.writeFileSync(path.join(dir, '角色.md'), '# 角色\n\n阿明：沉默。\n', 'utf8')
  fs.writeFileSync(path.join(dir, '写作规范.md'), '# 规范\n\n- 禁止“仿佛”\n', 'utf8')
  fs.writeFileSync(path.join(dir, '正文', '第1章_夜班.md'), '# 第1章 夜班\n\n阿明值夜班。\n', 'utf8')
  fs.writeFileSync(path.join(dir, '正文', '第2章_三号机.md'), '# 第2章 三号机\n\n三号机没人用。\n', 'utf8')
  return { cwd, name, dir, cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) }
}

/** 一个只会按剧本回复的假 llm 服务。 */
function fakeLlm(replies) {
  const calls = []
  return {
    calls,
    async listProviders() { return [{ id: 'strong' }, { id: 'weak' }] },
    async resolveModelInfo(provider, model) { return { provider, id: model, reasoning: { efforts: [] } } },
    stream(options) {
      calls.push({ provider: options.provider, model: options.model, system: options.system, prompt: options.messages[0].content[0].text })
      const reply = typeof replies === 'function' ? replies(options) : replies
      async function* gen() {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: reply }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: reply } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
      return gen()
    },
  }
}

const ctxWith = (llm) => ({
  get: (n) => (n === 'settings'
    ? { get: (k) => (k === 'agent-default-model' ? { provider: 'weak', model: 'w1' } : undefined) }
    : n === 'llm' ? llm : undefined),
  on: () => ({ dispose() {} }),
})

const config = (over = {}) => ({
  guidance: {
    enabled: true, provider: 'strong', model: 's1', reasoningEffort: '',
    writingProvider: 'weak', writingModel: 'w1', writingReasoningEffort: '',
    guidanceStyle: 'detailed',
    ...over,
  },
})

const invocation = () => ({ signal: new AbortController().signal, agent: { id: 't' } })

test('引导模型看到项目资料，但不看写作规范', () => {
  const { cwd, name, cleanup } = project()
  try {
    const context = buildGuidanceContext(cwd, name, 3, '')
    assert.match(context, /网吧，现代都市/u)
    assert.match(context, /三号机没人用/u)
    // 规范是写作模型的事，塞给引导模型只会让它复述规范、挤掉剧情判断
    assert.doesNotMatch(context, /禁止“仿佛”/u)
  } finally { cleanup() }
})

test('写作模型看到引导指令、写作规范和上一章', () => {
  const { cwd, name, cleanup } = project()
  try {
    const prompt = buildWritingPrompt(cwd, name, 3, '【场景序列】\n1. 阿明发现屏幕亮了', '')
    assert.match(prompt, /【场景序列】/u)
    assert.match(prompt, /禁止“仿佛”/u)
    assert.match(prompt, /三号机没人用/u)
    assert.match(prompt, /第 3 章/u)
  } finally { cleanup() }
})

test('两个模型按顺序各调用一次，写作拿到的是引导的输出', async () => {
  const { cwd, name, cleanup } = project()
  const llm = fakeLlm(options => options.provider === 'strong' ? '【场景序列】\n1. 屏幕自己亮了' : '# 第3章 亮了\n\n屏幕亮了。')
  try {
    const result = await runGuidedChapter(ctxWith(llm), invocation(), {
      cwd, name, targetChapter: 3, requirement: '', config: config(),
    })
    assert.equal(llm.calls.length, 2)
    assert.equal(llm.calls[0].provider, 'strong')
    assert.equal(llm.calls[1].provider, 'weak')
    // 关键：写作模型的提示词里必须是引导模型真实产出的内容
    assert.match(llm.calls[1].prompt, /屏幕自己亮了/u)
    assert.match(result.body, /屏幕亮了/u)
    assert.equal(result.guidanceRoute.model, 's1')
    assert.equal(result.writingRoute.model, 'w1')
  } finally { cleanup() }
})

test('没配写作模型就用引导模型写，不报错', async () => {
  const { cwd, name, cleanup } = project()
  const llm = fakeLlm('正文')
  try {
    const result = await runGuidedChapter(ctxWith(llm), invocation(), {
      cwd, name, targetChapter: 3, requirement: '',
      config: config({ writingProvider: '', writingModel: '' }),
    })
    // 用户配了引导模型说明他愿意付费，沿用比报错实用
    assert.equal(result.writingRoute.model, 's1')
    assert.equal(llm.calls.length, 2)
  } finally { cleanup() }
})

test('引导模型没配就明确报错，不静默降级', async () => {
  const { cwd, name, cleanup } = project()
  const llm = fakeLlm('正文')
  try {
    await assert.rejects(
      runGuidedChapter(ctxWith(llm), invocation(), {
        cwd, name, targetChapter: 3, requirement: '',
        config: config({ provider: '', model: '' }),
      }),
      /引导模型未配置/u,
    )
    // 一次模型调用都不该发生：配错了就该在花钱之前停下
    assert.equal(llm.calls.length, 0)
  } finally { cleanup() }
})

test('引导模型调用失败时不偷偷用单模型', async () => {
  const { cwd, name, cleanup } = project()
  const llm = {
    async listProviders() { return [{ id: 'strong' }, { id: 'weak' }] },
    async resolveModelInfo(provider, model) { return { provider, id: model, reasoning: { efforts: [] } } },
    stream() {
      async function* gen() {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: '配额用尽' } } }
      }
      return gen()
    },
  }
  try {
    await assert.rejects(runGuidedChapter(ctxWith(llm), invocation(), {
      cwd, name, targetChapter: 3, requirement: '', config: config(),
    }))
  } finally { cleanup() }
})

test('引导指令存档写进 引导大纲/第N章.md', () => {
  const { dir, cleanup } = project()
  try {
    saveGuidance(dir, 3, '【场景序列】\n1. 屏幕亮了')
    const file = path.join(dir, '引导大纲', '第3章.md')
    assert.ok(fs.existsSync(file))
    assert.match(fs.readFileSync(file, 'utf8'), /屏幕亮了/u)
  } finally { cleanup() }
})

test('存档写入失败不抛出（正文已经写好了，不该因为存档丢掉）', () => {
  // 指向一个不存在的盘符路径，mkdir 必然失败
  assert.doesNotThrow(() => saveGuidance('Q:/definitely/not/here', 1, 'x'))
})
