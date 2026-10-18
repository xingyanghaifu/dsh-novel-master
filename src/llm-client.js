/**
 * 对话模型客户端：兼容 OpenAI 规范的 /chat/completions。
 *
 * 由宿主进程（Node.js）发出请求，因此不受浏览器 CORS 限制；
 * 浏览器只访问同源的 /api/novel-master/llm/* 路由。
 */
import { chatEndpoint, modelsEndpoint, resolveLlmConfig } from './image-config.js'

/** 资产类型 → 扩写提示词的角色设定。 */
const KIND_BRIEF = {
  character: {
    label: '角色立绘',
    guide: 'a single character standing full-body portrait, centered composition, clean simple background',
  },
  region: {
    label: '场景地图',
    guide: 'a wide establishing landscape / environment scene, no characters in focus, cinematic vista',
  },
  item: {
    label: '物品道具',
    guide: 'a single prop or artifact shown as a product shot, isolated on a plain background, macro detail',
  },
  map: {
    label: '世界地图底图',
    guide: 'a top-down fantasy cartographic world map, hand-drawn parchment style, mountains drawn as ridgelines, rivers, coastlines, forests, no text labels, no characters, flat overhead view',
  },
}

/** 把模型返回的文本清理成单行提示词。 */
function normalizePrompt(text) {
  return String(text ?? '')
    .replace(/^```[a-z]*\s*/iu, '')
    .replace(/```$/u, '')
    .replace(/^(?:prompt|提示词)\s*[:：]\s*/iu, '')
    .replace(/["“”]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 900)
}

/**
 * 调用对话模型，让它在简短描述基础上扩写成高质量生图提示词。
 * @returns {Promise<{prompt: string, usage?: object, model: string}>}
 */
export async function expandPrompt({ config, brief, kind = 'character', style = '', signal }) {
  const llm = resolveLlmConfig(config)
  const trimmed = String(brief ?? '').trim()
  if (!trimmed) throw new Error('请先输入一句简短描述')
  if (!llm.baseURL) throw new Error('尚未配置对话模型接口地址（设置 → 小说创作大师 → AI 生图）')
  if (!llm.apiKey) throw new Error('尚未配置对话模型密钥')
  if (!llm.model) throw new Error('尚未选择对话模型')

  const preset = KIND_BRIEF[kind] ?? KIND_BRIEF.character
  const system = [
    'You are a prompt engineer for AI image generation.',
    `The user is building assets for a Chinese web novel. The asset type is "${preset.label}".`,
    `Composition requirement: ${preset.guide}.`,
    'Rewrite the user\'s short idea into ONE detailed English image prompt.',
    'Include subject, appearance, clothing/props, environment, lighting, mood, art style, and camera framing.',
    'Style default: painterly digital art, high detail, cinematic lighting.',
    'Output ONLY the prompt text. No explanation, no quotes, no markdown, no list.',
    'Keep it under 120 words.',
  ].join(' ')

  const user = style
    ? `${trimmed}\n\nPreferred style: ${style}`
    : trimmed

  const response = await fetch(chatEndpoint(llm.baseURL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: llm.temperature,
      max_tokens: llm.maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: signal ?? AbortSignal.timeout(llm.timeoutMs),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`对话模型返回 HTTP ${response.status}${detail ? `：${detail.slice(0, 240)}` : ''}`)
  }

  const payload = await response.json()
  const text = payload?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('对话模型没有返回有效内容')
  }
  return { prompt: normalizePrompt(text), usage: payload?.usage, model: llm.model }
}

/**
 * 从中转站拉取模型列表（GET /models）。
 * 很多中转站不列生图模型，所以 UI 下拉必须允许手动输入。
 */
export async function listRemoteModels({ config, channel = 'llm', signal }) {
  const entry = channel === 'image' ? resolveImageConfigSafe(config) : resolveLlmConfig(config)
  if (!entry.baseURL) throw new Error('尚未配置接口地址')
  const headers = { 'content-type': 'application/json' }
  if (entry.apiKey) headers.authorization = `Bearer ${entry.apiKey}`

  const response = await fetch(modelsEndpoint(entry.baseURL), {
    method: 'GET',
    headers,
    signal: signal ?? AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`模型列表返回 HTTP ${response.status}${detail ? `：${detail.slice(0, 200)}` : ''}`)
  }
  const payload = await response.json()
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  const models = rows
    .map((row) => (typeof row === 'string' ? row : row?.id))
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim())
  // 去重并排序，保持稳定顺序方便选择
  return [...new Set(models)].sort((a, b) => a.localeCompare(b))
}

/** 生图通道也复用同一套解析，只是字段集合不同。 */
function resolveImageConfigSafe(config) {
  const image = config?.image ?? {}
  const pick = (key) => {
    let value = image[key]
    if (value && typeof value === 'object' && typeof value.get === 'function') {
      try { value = value.get() } catch { value = undefined }
    }
    return value === undefined || value === null ? '' : value
  }
  return {
    baseURL: String(pick('baseURL')).replace(/\/+$/u, ''),
    apiKey: String(pick('apiKey')),
    model: String(pick('model')),
  }
}
