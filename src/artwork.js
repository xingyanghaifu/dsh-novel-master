/**
 * AI 生图：把地区/场景/道具渲染成插画，供设定树面板与生图工作台使用。
 *
 * 请求由宿主进程（Node.js）发出，不受浏览器 CORS 限制；
 * 浏览器只访问同源的 /api/novel-master/image/* 路由。
 * 接口地址与密钥从 image-config.js 统一解析，不在本文件硬编码。
 */
import fs from 'node:fs'
import path from 'node:path'
import { imageEndpoint, resolveImageConfig } from './image-config.js'

const IMAGE_DIR = '插图'
const MAX_PROMPT = 900
const TIMEOUT_MS = 180000

/** 统一取配置字段；兼容 live 引用与普通快照。 */
function pick(source, key, fallback) {
  const value = source?.[key]
  if (value === undefined || value === null || value === '') return fallback
  return value
}

/** 把地形标签翻成画面描述，模型更容易画出「地区感」。 */
const TERRAIN_PROMPT = {
  山地: 'rugged mountain ranges, steep cliffs, rocky ridgelines, atmospheric haze',
  雪原: 'frozen snowfield, pale blue ice, drifting snow, desaturated cold light',
  森林: 'dense ancient forest, layered canopy, shafts of light through leaves',
  沙漠: 'vast sand dunes, wind-blown ridges, harsh sun, heat shimmer',
  水域: 'open water, waves, distant shoreline, cool blue tones',
  沼泽: 'misty swamp, stagnant water, reed beds, muted olive and brown tones',
  城邦: 'walled city or town, rooftops and towers, streets and gatehouse',
  原野: 'rolling grassland, distant treeline, wide sky, soft daylight',
  地下: 'underground cavern, stalactites, faint violet glow, deep shadows',
  火山: 'volcanic cone, glowing lava fissures, ash and smoke plumes',
  岛屿: 'small island, sandy shore, surrounding sea, palm or sparse vegetation',
}

/** 根据地区数据拼一段英文提示词（多数生图模型对英文更稳）。 */
export function buildPrompt(region, project) {
  const kind = region?.terrain || '原野'
  const terrainText = TERRAIN_PROMPT[kind] ?? TERRAIN_PROMPT['原野']
  const parts = [
    `Fantasy world map illustration of a region called "${region?.name ?? '未知地区'}".`,
    terrainText + '.',
    region?.desc ? `Lore: ${String(region.desc).slice(0, 200)}.` : '',
    project?.title ? `From the novel "${project.title}".` : '',
    'Style: painterly digital art, concept-art keyframe, rich color, cinematic lighting, no text, no watermark, no UI.',
  ]
  return parts.filter(Boolean).join(' ').slice(0, MAX_PROMPT)
}

/** 判断配置是否足以生图，以及缺什么。 */
export function imageStatus(config) {
  const entry = resolveImageConfig(config)
  const missing = [
    !entry.baseURL ? 'baseURL' : '',
    !entry.model ? 'model' : '',
  ].filter(Boolean)
  return {
    enabled: config?.image?.enabled === true,
    ready: missing.length === 0,
    missing,
    baseURL: entry.baseURL,
    model: entry.model,
    size: resolveSize({ aspect: entry.aspect, tier: entry.tier, fallback: entry.size }),
    aspect: entry.aspect,
    tier: entry.tier,
    count: entry.count,
    transparent: entry.transparent,
  }
}

/**
 * 下载生图服务返回的图片 URL。
 *
 * URL 来自服务端响应，配置了恶意或错乱的中转站时可以让插件去访问内网地址
 * （SSRF），把结果当图片存进项目目录。这里只放行公网的 http/https：
 * 私有网段、回环、链路本地地址一律拒绝。
 */
function assertPublicUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('生图返回的图片地址不是合法 URL') }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`生图返回的图片地址协议不允许：${url.protocol}`)
  const host = url.hostname.replace(/^\[|\]$/gu, '').toLowerCase()
  const privateV4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.)/u
  const privateV6 = /^(?:::1|::|fc|fd|fe80)/u
  if (host === 'localhost' || privateV4.test(host) || privateV6.test(host)) {
    throw new Error(`生图返回的图片地址指向内网，已拒绝：${host}`)
  }
  return url.href
}

/** 取出全部图片（n>1 时一次请求可能返回多张）。 */
async function readImages(payload) {
  const list = payload?.data ?? payload?.images ?? payload?.output
  if (!Array.isArray(list) || list.length === 0) throw new Error('生图接口没有返回图片数据')
  const out = []
  const failed = []
  for (const [index, item] of list.entries()) {
    try {
      const raw = item?.b64_json ?? item?.base64 ?? item?.b64
      if (raw) {
        const data = String(raw).replace(/^data:[^,]+,/u, '')
        out.push({ buffer: Buffer.from(data, 'base64'), ext: 'png', index })
        continue
      }
      const url = item?.url ?? (index === 0 ? payload?.url : undefined)
      if (!url) throw new Error('既没有 b64 也没有 url')
      const response = await fetch(assertPublicUrl(url), { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const type = response.headers.get('content-type') ?? ''
      const ext = type.includes('jpeg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png'
      out.push({ buffer: Buffer.from(await response.arrayBuffer()), ext, index })
    } catch (error) {
      failed.push({ index, reason: error?.message ?? String(error) })
    }
  }
  if (out.length === 0) throw new Error(`生图接口返回了 ${list.length} 项，但没有一张可用${failed.length ? `：${failed[0].reason}` : ''}`)
  return { images: out, failed }
}

/** 安全的文件名：保留中文但去掉路径分隔符与控制字符。 */
export function safeName(input) {
  const cleaned = String(input ?? 'art')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, '')
    .replace(/\s+/gu, '-')
    .replace(/^[.-]+|[.-]+$/gu, '')
    .slice(0, 60)
  return cleaned || 'art'
}

/**
 * 核心调用：POST ${baseURL}/images/generations。
 *
 * 由宿主进程调用，因此没有浏览器 CORS 问题。
 * 兼容两种返回：b64_json（默认）与 url（部分中转站只给链接）。
 *
 * @param {object} entry resolveImageConfig() 的结果
 * @param {string} prompt 最终提示词
 * @returns {Promise<{buffer: Buffer, ext: string}>}
 */
export async function callImageApi(entry, prompt, reference) {
  if (!entry?.baseURL) throw new Error('尚未配置生图接口地址')
  if (!entry?.model) throw new Error('尚未选择生图模型')

  const body = {
    model: entry.model,
    prompt: String(prompt ?? '').slice(0, 4000),
    n: Math.max(1, Math.min(4, Number(entry.count) || 1)),
    size: resolveSize({ aspect: entry.aspect, tier: entry.tier, fallback: entry.size || '1024x1024' }),
    // OpenAI 兼容接口普遍接受 response_format；个别网关不认就回落到 url 形态。
    response_format: 'b64_json',
  }
  if (entry.quality) body.quality = entry.quality
  // 透明背景：OpenAI 系用 background:'transparent'，部分网关认 transparent 布尔
  if (entry.transparent === true) {
    body.background = 'transparent'
    body.transparent = true
  }
  // 垫图：以标准 OpenAI images.edits 形态传参考图（多数兼容中转站支持 image 字段）
  if (reference?.dataUrl) body.image = reference.dataUrl

  const headers = { 'content-type': 'application/json' }
  if (entry.apiKey) headers.authorization = `Bearer ${entry.apiKey}`

  const response = await fetch(imageEndpoint(entry.baseURL), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(entry.timeoutMs ?? TIMEOUT_MS),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    // 垫图兼容性兜底：部分中转站不支持 image 字段，去掉垫图重试一次，
    // 并在结果里标注，让用户知道这次没有用上参考图。
    if (reference?.dataUrl && (response.status === 400 || response.status === 422)) {
      delete body.image
      const retry = await fetch(imageEndpoint(entry.baseURL), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(entry.timeoutMs ?? TIMEOUT_MS),
      })
      if (retry.ok) {
        const result = await readImages(await retry.json())
        return { ...result, referenceIgnored: true }
      }
      const retryDetail = await retry.text().catch(() => '')
      throw new Error(`生图接口拒绝请求（含垫图时 HTTP ${response.status}）：${(retryDetail || detail).slice(0, 300)}`)
    }
    throw new Error(`生图接口返回 HTTP ${response.status}${detail ? `：${detail.slice(0, 300)}` : ''}`)
  }
  return readImages(await response.json())
}

/** 宽高比预设：与主流生图控制台一致，直接决定构图。 */
export const ASPECT_PRESETS = [
  { key: '1:1', label: '1:1', w: 1, h: 1 },
  { key: '16:9', label: '16:9', w: 16, h: 9 },
  { key: '9:16', label: '9:16', w: 9, h: 16 },
  { key: '4:3', label: '4:3', w: 4, h: 3 },
  { key: '3:4', label: '3:4', w: 3, h: 4 },
  { key: '3:2', label: '3:2', w: 3, h: 2 },
  { key: '2:3', label: '2:3', w: 2, h: 3 },
  { key: '5:4', label: '5:4', w: 5, h: 4 },
  { key: '4:5', label: '4:5', w: 4, h: 5 },
  { key: '21:9', label: '21:9', w: 21, h: 9 },
]

/** 分辨率档位：长边像素。Auto 交给模型默认。 */
export const RESOLUTION_TIERS = [
  { key: 'auto', label: 'Auto', longEdge: 0 },
  { key: '1k', label: '1K', longEdge: 1024 },
  { key: '2k', label: '2K', longEdge: 2048 },
  { key: '4k', label: '4K', longEdge: 4096 },
]

/**
 * 由宽高比与分辨率档位算出接口所需的 "WxH" 字符串。
 *
 * 生图接口普遍要求两边都是 64 的倍数（部分网关要 8 的倍数），
 * 所以这里按 64 对齐；Auto 档或参数不全时回落到配置里的固定尺寸。
 */
export function resolveSize({ aspect, tier, fallback = '1024x1024' } = {}) {
  const preset = ASPECT_PRESETS.find((item) => item.key === aspect)
  const resolution = RESOLUTION_TIERS.find((item) => item.key === tier)
  if (!preset || !resolution || !resolution.longEdge) return fallback
  const round = (value) => Math.max(64, Math.round(value / 64) * 64)
  const longEdge = resolution.longEdge
  const ratio = preset.w / preset.h
  const width = ratio >= 1 ? longEdge : round(longEdge * ratio)
  const height = ratio >= 1 ? round(longEdge / ratio) : longEdge
  return `${width}x${height}`
}

/**
 * 生成插画并落盘到项目 插图/ 目录。
 * 一次请求可能产出多张（n>1）：全部保存，返回数组。
 *
 * @param {{entry: object, projectDir: string, prompt: string, name: string, prefix?: string}} input
 * @returns {Promise<{files: string[], images: object[], prompt: string, referenceIgnored?: boolean, failed?: object[]}>}
 */
export async function generateImage({ entry, projectDir, prompt, name, prefix = 'art', reference }) {
  if (!entry?.baseURL) throw new Error('尚未配置生图接口地址（设置 → 小说创作大师 → AI 生图）')
  if (!entry?.model) throw new Error('尚未选择生图模型')

  const { images, failed = [], referenceIgnored } = await callImageApi(entry, prompt, reference)

  const folder = path.join(projectDir, IMAGE_DIR)
  fs.mkdirSync(folder, { recursive: true })
  const stamp = Date.now().toString(36)
  const base = safeName(name)

  const saved = images.map(({ buffer, ext, index }) => {
    const suffix = images.length > 1 ? `-${index + 1}` : ''
    const filename = `${prefix}-${base}-${stamp}${suffix}.${ext}`
    fs.writeFileSync(path.join(folder, filename), buffer)
    return { file: `${IMAGE_DIR}/${filename}`, url: `${IMAGE_DIR}/${filename}`, bytes: buffer.length }
  })

  return {
    files: saved.map((item) => item.file),
    images: saved,
    prompt,
    ...(referenceIgnored ? { referenceIgnored: true } : {}),
    ...(failed.length ? { failed } : {}),
  }
}

/** 列出某项目已生成的插图（文件名 → 地区名猜测）。 */
export function listImages(projectDir) {
  const folder = path.join(projectDir, IMAGE_DIR)
  if (!fs.existsSync(folder)) return []
  return fs.readdirSync(folder)
    .filter((name) => /\.(png|jpe?g|webp)$/iu.test(name))
    .map((name) => ({ name, file: `${IMAGE_DIR}/${name}` }))
}
