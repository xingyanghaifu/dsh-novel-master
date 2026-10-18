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
    size: entry.size,
  }
}

/** 从各种生图响应里取出图片字节。支持 b64_json 与 url 两种返回。 */
async function readImage(payload) {
  const item = payload?.data?.[0] ?? payload?.images?.[0] ?? payload?.output?.[0]
  if (!item) throw new Error('生图接口没有返回图片数据')
  if (item.b64_json || item.base64 || item.b64) {
    const raw = item.b64_json ?? item.base64 ?? item.b64
    const data = String(raw).replace(/^data:[^,]+,/u, '')
    return { buffer: Buffer.from(data, 'base64'), ext: 'png' }
  }
  const url = item.url ?? payload?.url
  if (!url) throw new Error('生图接口既没有 b64 也没有 url')
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`下载生成的图片失败：HTTP ${response.status}`)
  const type = response.headers.get('content-type') ?? ''
  const ext = type.includes('jpeg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png'
  return { buffer: Buffer.from(await response.arrayBuffer()), ext }
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
    n: 1,
    size: entry.size || '1024x1024',
    // OpenAI 兼容接口普遍接受 response_format；个别网关不认就回落到 url 形态。
    response_format: 'b64_json',
  }
  if (entry.quality) body.quality = entry.quality
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
        const image = await readImage(await retry.json())
        return { ...image, referenceIgnored: true }
      }
      const retryDetail = await retry.text().catch(() => '')
      throw new Error(`生图接口拒绝请求（含垫图时 HTTP ${response.status}）：${(retryDetail || detail).slice(0, 300)}`)
    }
    throw new Error(`生图接口返回 HTTP ${response.status}${detail ? `：${detail.slice(0, 300)}` : ''}`)
  }
  return readImage(await response.json())
}

/**
 * 生成一张插画并落盘到项目 插图/ 目录。
 * @param {{entry: object, projectDir: string, prompt: string, name: string, prefix?: string}} input
 * @returns {Promise<{file: string, url: string, prompt: string}>}
 */
export async function generateImage({ entry, projectDir, prompt, name, prefix = 'art', reference }) {
  if (!entry?.baseURL) throw new Error('尚未配置生图接口地址（设置 → 小说创作大师 → AI 生图）')
  if (!entry?.model) throw new Error('尚未选择生图模型')

  const { buffer, ext, referenceIgnored } = await callImageApi(entry, prompt, reference)

  const folder = path.join(projectDir, IMAGE_DIR)
  fs.mkdirSync(folder, { recursive: true })
  const stamp = Date.now().toString(36)
  const filename = `${prefix}-${safeName(name)}-${stamp}.${ext}`
  fs.writeFileSync(path.join(folder, filename), buffer)

  return {
    file: `${IMAGE_DIR}/${filename}`,
    url: `${IMAGE_DIR}/${filename}`,
    prompt,
    ...(referenceIgnored ? { referenceIgnored: true } : {}),
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
