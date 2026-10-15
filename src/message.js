/**
 * Build a model-visible user message for `agent.followup()`.
 *
 * Mirrors `createUserMessage` from @deepseek-ai/dsh-llm (fresh id, deep-frozen
 * clone) without importing it: a plugin loaded from a plain directory cannot
 * resolve DSH's bundled packages, so a hard import would break loading.
 */
import { randomUUID } from 'node:crypto'

/** Recursively freeze a plain value tree. */
function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) deepFreeze(value[key])
  }
  return value
}

/**
 * @param {string} text - prompt text for the model.
 * @param {readonly object[]} [attachments] - admitted image/file blocks from the invocation.
 * @returns {object} an immutable user message with a fresh id.
 */
export function userMessage(text, attachments = []) {
  return deepFreeze(structuredClone({
    role: 'user',
    content: [...attachments, { type: 'text', text }],
    source: { kind: 'user' },
    id: randomUUID(),
  }))
}
