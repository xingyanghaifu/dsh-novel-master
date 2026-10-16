import { AsyncLocalStorage } from 'node:async_hooks'
import { shouldUseGuidance, enhancePromptWithGuidance } from './guidance-integration.js'

// Enrichment happens at a durable task boundary, never by rewriting LLM requests.
const taskScope = new AsyncLocalStorage()

export function withTaskIntelligence(enhancer, operation) {
  return taskScope.run(typeof enhancer === 'function' ? enhancer : undefined, operation)
}

export async function enhanceTaskPrompt(invocation, prompt) {
  const enhance = taskScope.getStore()
  const basePrompt = enhance ? await enhance(invocation, prompt) : prompt
  
  // 如果启用了引导模型，进一步增强提示词
  if (invocation.config && shouldUseGuidance(invocation.config)) {
    return await enhancePromptWithGuidance(invocation.config, invocation, basePrompt)
  }
  
  return basePrompt
}

export function bindNovelGoal(invocation, goal) {
  return taskScope.getStore()?.bindGoal?.(invocation, goal)
}

/**
 * 检查是否应该使用引导模型
 * @param {object} config - 插件配置
 * @returns {boolean}
 */
export function isGuidanceEnabled(config) {
  return shouldUseGuidance(config)
}
