/**
 * 模型接口配置：对话模型（LLM）与生图模型各自的地址、密钥、模型名。
 *
 * 设计要点：
 * - 两个通道完全独立，因为中转站可能对话和生图用不同地址/密钥。
 * - baseURL 统一约定「填到 /v1 为止」，自身负责拼 /chat/completions 与 /images/generations。
 * - 密钥字段由 DSH schemastery 的 role('credential') 加密保存，本模块只读取使用。
 */

/** 对话模型默认配置。 */
export const DEFAULT_LLM_CONFIG = {
  baseURL: '',
  apiKey: '',
  model: '',
  temperature: 0.8,
  maxTokens: 900,
  timeoutMs: 90000,
}

/** 生图模型默认配置。 */
export const DEFAULT_IMAGE_CONFIG = {
  baseURL: '',
  apiKey: '',
  model: '',
  size: '1024x1024',
  quality: '',
  timeoutMs: 180000,
}

/**
 * 读取一个字段；兼容 cosmokit 的 live 引用（有 get() 方法）与普通快照。
 * 空字符串视为「未设置」，回落到默认值。
 */
function pick(source, key, fallback) {
  let value = source?.[key]
  if (value && typeof value === 'object' && typeof value.get === 'function') {
    try { value = value.get() } catch { value = undefined }
  }
  if (value === undefined || value === null || value === '') return fallback
  return value
}

/** 合并用户配置到默认值上；空值不覆盖默认。 */
function merge(defaults, overrides) {
  const merged = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const value = pick(overrides, key, undefined)
    if (value !== undefined) merged[key] = value
  }
  return merged
}

/** 解析对话模型配置。 */
export function resolveLlmConfig(config) {
  const resolved = merge(DEFAULT_LLM_CONFIG, config?.llm ?? {})
  resolved.baseURL = String(resolved.baseURL).replace(/\/+$/u, '')
  resolved.model = String(resolved.model)
  return resolved
}

/** 解析生图模型配置。 */
export function resolveImageConfig(config) {
  const resolved = merge(DEFAULT_IMAGE_CONFIG, config?.image ?? {})
  resolved.baseURL = String(resolved.baseURL).replace(/\/+$/u, '')
  resolved.model = String(resolved.model)
  return resolved
}

/**
 * 配置是否可用；返回缺失项清单供 UI 提示。
 * 只检查必填三项，不校验网络连通性。
 */
export function configStatus(config) {
  const llm = resolveLlmConfig(config)
  const image = resolveImageConfig(config)
  const missing = (entry) => [
    !entry.baseURL ? 'baseURL' : '',
    !entry.apiKey ? 'apiKey' : '',
    !entry.model ? 'model' : '',
  ].filter(Boolean)
  return {
    llm: { ...llm, apiKey: undefined, missing: missing(llm), ready: missing(llm).length === 0 },
    image: { ...image, apiKey: undefined, missing: missing(image), ready: missing(image).length === 0 },
  }
}

/** 拼接对话补全端点。 */
export function chatEndpoint(baseURL) {
  return `${String(baseURL).replace(/\/+$/u, '')}/chat/completions`
}

/** 拼接生图端点。 */
export function imageEndpoint(baseURL) {
  return `${String(baseURL).replace(/\/+$/u, '')}/images/generations`
}

/** 拼接模型列表端点。 */
export function modelsEndpoint(baseURL) {
  return `${String(baseURL).replace(/\/+$/u, '')}/models`
}
