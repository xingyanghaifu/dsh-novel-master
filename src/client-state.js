/**
 * client-state.js
 * 状态管理与 API 通信层
 * 负责：数据获取、缓存、错误处理、网络请求
 */

// 延迟初始化以支持测试环境
const getAPI = () => {
  if (typeof document !== 'undefined' && document.baseURI) {
    return new URL('api/novel-master/', document.baseURI).pathname
  }
  return 'api/novel-master/' // 测试环境回退
}

const MODEL_CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

// 模型列表缓存
let modelsCache = null
let modelsCacheTime = 0

/**
 * API 请求封装，统一处理超时、取消、错误
 */
export async function api(action, { body, signal, timeoutMs = 20000 } = {}) {
  const API = getAPI() // 动态获取 API 路径
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(abort, timeoutMs)
  
  try {
    const response = await fetch(`${API}${action}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      headers: { 'content-type': 'application/json', 'x-novel-master': 'settings' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    })
    
    let payload
    if (typeof response.text === 'function') {
      const text = await response.text()
      try {
        payload = text ? JSON.parse(text) : {}
      } catch {
        // 改进：检测网络离线状态
        const isOffline = !navigator.onLine
        const errorMsg = isOffline
          ? '网络连接已断开，请检查网络后重试。'
          : response.status === 404
          ? '插件后端尚未就绪，请重启 DSH 后重试。'
          : response.status === 401
          ? '登录状态已失效，请刷新当前页面。'
          : '后端未返回有效数据，请刷新状态或重启 DSH。'
        throw new Error(`${action} · HTTP ${response.status ?? '未知'}：${errorMsg}`)
      }
    } else {
      payload = await response.json()
    }
    
    if (!response.ok) {
      // 改进：更友好的错误提示
      const isOffline = !navigator.onLine
      const errorMsg = isOffline
        ? '网络连接已断开，请检查网络后重试。'
        : payload.error ?? (response.status === 404
        ? '插件后端尚未就绪，请重启 DSH 后重试。'
        : '请求失败，请稍后重试。')
      throw new Error(`${action} · HTTP ${response.status ?? '未知'}：${errorMsg}`)
    }
    
    return payload
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/**
 * 加载模型列表（带缓存）
 * @param {Object} ctx - Cordis 上下文
 * @param {AbortSignal} signal - 取消信号
 * @param {boolean} forceRefresh - 强制刷新缓存
 */
export async function loadModels(ctx, signal, forceRefresh = false) {
  // 检查缓存
  const now = Date.now()
  if (!forceRefresh && modelsCache && (now - modelsCacheTime) < MODEL_CACHE_TTL) {
    return modelsCache
  }
  
  const list = []
  const seen = new Set()
  
  const add = (p, m, l, efforts) => {
    const k = `${p}::${m}`
    if (!seen.has(k)) {
      seen.add(k)
      list.push({
        provider: p,
        model: m,
        label: l || `${p} / ${m}`,
        efforts: efforts || []
      })
    }
  }
  
  // 优先从 RPC 读取
  if (ctx?.remote?.llm && typeof ctx.remote.llm.listProviders === 'function') {
    try {
      const [reg, decl] = await Promise.all([
        ctx.remote.llm.listProviders(),
        typeof ctx.remote.llm.listConfigurableProviders === 'function'
          ? ctx.remote.llm.listConfigurableProviders()
          : { ok: false },
      ])
      
      if (reg?.ok && Array.isArray(reg.value)) {
        for (const prov of reg.value) {
          if (prov?.models && Array.isArray(prov.models)) {
            for (const m of prov.models) {
              const id = typeof m === 'string' ? m : m?.id
              const name = typeof m === 'object' && m?.name ? m.name : id
              const efforts = typeof m === 'object' && m?.reasoning?.efforts ? m.reasoning.efforts : []
              if (id) add(prov.id, id, `${prov.name || prov.id} / ${name}`, efforts)
            }
          }
        }
      }
      
      if (list.length > 0) {
        // 更新缓存
        modelsCache = list
        modelsCacheTime = now
        return list
      }
    } catch (error) {
      console.warn('RPC listProviders failed, falling back to HTTP:', error)
    }
  }
  
  // 降级到 HTTP API
  try {
    const res = await api('models', { signal })
    if (Array.isArray(res?.models) && res.models.length > 0) {
      modelsCache = res.models
      modelsCacheTime = now
      return res.models
    }
  } catch (error) {
    console.warn('HTTP /models failed:', error)
  }
  
  // 返回回退模型列表
  const FALLBACK_MODELS = [
    { provider: 'hajimi', model: 'gemini-3.8-flash', label: 'hajimi / gemini-3.8-flash (主会话模型)', efforts: [] },
    { provider: 'workbuddy', model: 'deepseek-v4.1-flash', label: 'workbuddy / deepseek-v4.1-flash', efforts: [] },
    { provider: 'our-free-model', model: 'mimo-v2.6-flash-free', label: 'our-free-model / mimo-v2.6-flash-free', efforts: [] },
    { provider: 'our-free-model', model: 'space-bunny-free', label: 'our-free-model / space-bunny-free', efforts: [] },
    { provider: 'workbuddy', model: 'hy4-preview-f', label: 'workbuddy / hy4-preview-f', efforts: [] },
  ]
  
  modelsCache = FALLBACK_MODELS
  modelsCacheTime = now
  return FALLBACK_MODELS
}

/**
 * 清除模型缓存（用于强制刷新）
 */
export function clearModelsCache() {
  modelsCache = null
  modelsCacheTime = 0
}

/**
 * 加载设置与状态
 */
export async function loadSettingsAndStatus(signal) {
  const results = await Promise.allSettled([
    api('settings', { signal }),
    api('status', { signal })
  ])
  
  const settings = results[0].status === 'fulfilled' ? results[0].value : null
  const status = results[1].status === 'fulfilled' ? results[1].value : null
  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason.message)
  
  return { settings, status, errors }
}

/**
 * 保存设置
 */
export async function saveSettings(patch, revision) {
  return await api('settings', {
    body: { patch, revision }
  })
}

/**
 * 执行更新操作
 */
export async function runUpdateAction(action, timeoutMs = 20000) {
  const controller = new AbortController()
  const result = await api(action, {
    body: {},
    signal: controller.signal,
    timeoutMs
  })
  return { result, controller }
}

/**
 * 读取智能活动状态
 */
export async function readIntelligenceActivity(signal) {
  return await api('intelligence/status', { signal })
}
