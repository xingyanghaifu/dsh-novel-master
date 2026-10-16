/**
 * 引导-写作分离架构测试
 */

import assert from 'node:assert'
import {
  readGuidanceConfig,
  buildGuidanceSystem,
  buildGuidancePrompt,
  buildWritingSystemWithGuidance,
  executeGuidedWriting,
} from '../src/guidance.js'

console.log('Running guidance.test.js...')

const VOLATILE = Symbol.for('cosmokit.volatile.write')

// 测试1：读取引导配置
{
  const config1 = { 
    guidance: { 
      enabled: { [VOLATILE]: true, get: () => true }, 
      provider: { [VOLATILE]: true, get: () => 'anthropic' }, 
      model: { [VOLATILE]: true, get: () => 'claude-opus-5.5' } 
    } 
  }
  const result1 = readGuidanceConfig(config1)
  assert.strictEqual(result1.enabled, true)
  assert.strictEqual(result1.provider, 'anthropic')
  assert.strictEqual(result1.model, 'claude-opus-5.5')
  console.log('✓ readGuidanceConfig with volatile fields')
}

{
  const config2 = { guidance: { enabled: false, provider: '', model: '' } }
  const result2 = readGuidanceConfig(config2)
  assert.strictEqual(result2.enabled, false)
  console.log('✓ readGuidanceConfig with plain fields')
}

{
  const config3 = {}
  const result3 = readGuidanceConfig(config3)
  assert.strictEqual(result3.enabled, false)
  console.log('✓ readGuidanceConfig with missing guidance config')
}

// 测试2：构建引导系统提示词
{
  const system1 = buildGuidanceSystem('concise', 'chapter')
  assert.ok(system1.includes('你是小说创作引导专家'))
  assert.ok(system1.includes('简明模式'))
  assert.ok(system1.includes('续写指定章节'))
  console.log('✓ buildGuidanceSystem with concise style')
}

{
  const system2 = buildGuidanceSystem('detailed', 'novel')
  assert.ok(system2.includes('详细模式'))
  assert.ok(system2.includes('第一章创作'))
  console.log('✓ buildGuidanceSystem with detailed style')
}

{
  const system3 = buildGuidanceSystem('verbose', 'outline')
  assert.ok(system3.includes('极详细模式'))
  assert.ok(system3.includes('生成完整大纲'))
  console.log('✓ buildGuidanceSystem with verbose style')
}

// 测试3：构建引导提示词
{
  const context1 = {
    projectName: '仙侠传说',
    outline: '主角林风在修仙世界中崛起...',
    cast: '林风：15岁，孤儿，天赋异禀',
    world: '修仙世界，灵气复苏',
    previousChapter: '林风在山洞中发现了一本古老的功法...',
    targetChapter: 2,
    userRequest: '写第2章，林风开始修炼',
  }
  const prompt1 = buildGuidancePrompt(context1)
  assert.ok(prompt1.includes('第 2 章'))
  assert.ok(prompt1.includes('仙侠传说'))
  assert.ok(prompt1.includes('林风'))
  assert.ok(prompt1.includes('写第2章，林风开始修炼'))
  console.log('✓ buildGuidancePrompt with full context')
}

{
  const context2 = { targetChapter: 1 }
  const prompt2 = buildGuidancePrompt(context2)
  assert.ok(prompt2.includes('第 1 章'))
  console.log('✓ buildGuidancePrompt with minimal context')
}

// 测试4：构建写作系统提示词
{
  const guidanceOutput = `## 第2章写作大纲
  
场景1：林风在山洞中研读功法
场景2：尝试第一次引气入体
场景3：突然感应到外界有危险

情感基调：期待、紧张、危机`

  const writingSystem = buildWritingSystemWithGuidance(guidanceOutput)
  assert.ok(writingSystem.includes('你是小说写作执行者'))
  assert.ok(writingSystem.includes('场景1'))
  assert.ok(writingSystem.includes('严格遵循大纲'))
  console.log('✓ buildWritingSystemWithGuidance')
}

// 测试5：执行引导-写作流程（模拟）
{
  const mockCallGuidanceModel = async ({ system, prompt }) => {
    assert.ok(system.includes('引导专家'))
    assert.ok(prompt.includes('第 3 章'))
    return {
      text: `## 第3章大纲
场景1：林风突破第一层境界
场景2：遇到神秘老者
场景3：接受任务`
    }
  }

  const mockCallWritingModel = async ({ system, prompt }) => {
    assert.ok(system.includes('场景1：林风突破第一层境界'))
    return {
      text: `林风盘膝坐在山洞中，按照功法引导，缓缓吸纳周围的灵气。突然，他感觉到体内一股暖流涌动...\n\n就在此时，山洞外传来一阵脚步声。`
    }
  }

  const context = {
    projectName: '仙侠传说',
    targetChapter: 3,
    sessionProvider: 'google',
    sessionModel: 'gemini-2.0-flash',
  }

  const guidanceConfig = {
    enabled: true,
    provider: 'anthropic',
    model: 'claude-opus-5.5',
    reasoningEffort: 'high',
    writingProvider: '',
    writingModel: '',
    guidanceStyle: 'detailed',
  }

  executeGuidedWriting({
    context,
    guidanceConfig,
    callGuidanceModel: mockCallGuidanceModel,
    callWritingModel: mockCallWritingModel,
    taskType: 'chapter',
  }).then(result => {
    assert.ok(result.guidance.includes('第3章大纲'))
    assert.ok(result.content.includes('林风盘膝坐在山洞中'))
    console.log('✓ executeGuidedWriting with guidance+writing separation')
  }).catch(err => {
    console.error('✗ executeGuidedWriting failed:', err.message)
    process.exit(1)
  })
}

// 测试6：错误处理
{
  const invalidConfig = { enabled: true, provider: '', model: '' }
  executeGuidedWriting({
    context: {},
    guidanceConfig: invalidConfig,
    callGuidanceModel: async () => ({ text: 'test' }),
    callWritingModel: async () => ({ text: 'test' }),
  }).then(() => {
    console.error('✗ Should throw error for invalid config')
    process.exit(1)
  }).catch(err => {
    assert.ok(err.message.includes('引导模型未正确配置'))
    console.log('✓ executeGuidedWriting rejects invalid config')
  })
}

setTimeout(() => {
  console.log('\n✓ All guidance tests passed')
}, 100)
