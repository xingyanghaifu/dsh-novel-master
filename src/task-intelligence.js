import { AsyncLocalStorage } from 'node:async_hooks'
import { shouldUseGuidance, enhancePromptWithGuidance } from './guidance-integration.js'

// Enrichment happens at a durable task boundary, never by rewriting LLM requests.
const taskScope = new AsyncLocalStorage()

export function withTaskIntelligence(enhancer, operation) {
  return taskScope.run(typeof enhancer === 'function' ? enhancer : undefined, operation)
}

export function enhanceTaskPrompt(invocation, prompt) {
  const enhance = taskScope.getStore()
  const withGuidance = basePrompt => invocation.config && shouldUseGuidance(invocation.config)
    ? enhancePromptWithGuidance(invocation.config, invocation, basePrompt)
    : basePrompt
  const basePrompt = enhance ? enhance(invocation, prompt) : prompt
  return typeof basePrompt?.then === 'function'
    ? basePrompt.then(withGuidance)
    : withGuidance(basePrompt)
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
