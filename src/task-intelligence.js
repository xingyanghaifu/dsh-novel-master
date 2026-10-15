import { AsyncLocalStorage } from 'node:async_hooks'

// Enrichment happens at a durable task boundary, never by rewriting LLM requests.
const taskScope = new AsyncLocalStorage()
export function withTaskIntelligence(enhancer, operation) {
  return taskScope.run(typeof enhancer === 'function' ? enhancer : undefined, operation)
}
export function enhanceTaskPrompt(invocation, prompt) {
  const enhance = taskScope.getStore()
  return enhance ? enhance(invocation, prompt) : prompt
}

export function bindNovelGoal(invocation, goal) {
  return taskScope.getStore()?.bindGoal?.(invocation, goal)
}
