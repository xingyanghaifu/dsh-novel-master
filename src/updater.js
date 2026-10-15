import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

export const REPOSITORY = 'xingyanghaifu/dsh-novel-master'
export const PACKAGE_NAME = 'dsh-novel-master'
export const API_PATH = '/api/novel-master'
const SHA = /^[a-f0-9]{40}$/i
const LOCK_KEY = Symbol.for('dsh-novel-master.updater.v1')
// Shared across fresh ESM evaluations: an HMR successor must not start a second install.
const shared = globalThis[LOCK_KEY] ??= { busy: false, requestId: null, lastResult: null }
const shaOf = value => typeof value === 'string' && SHA.test(value) ? value.toLowerCase() : null
const messageOf = error => error?.message ?? String(error)

function packageState() {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  let commit = shaOf(manifest.gitHead)
  // pnpm may keep the pinned spec in the profile rather than adding gitHead.
  try {
    const profile = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
    const spec = profile.dependencies?.[PACKAGE_NAME]
    const match = typeof spec === 'string' && spec.match(/^github:xingyanghaifu\/dsh-novel-master#([a-f0-9]{40})$/i)
    if (match) commit = match[1].toLowerCase()
  } catch { /* A development checkout has no owning profile. Commit stays unknown. */ }
  return { version: manifest.version, commit }
}
const RUNNING = Object.freeze(packageState())

export class UpdateError extends Error {
  constructor(code, message) { super(message); this.name = 'UpdateError'; this.code = code }
}

async function readJson(fetcher, url, signal) {
  const response = await fetcher(url, {
    signal, redirect: 'error', headers: { Accept: 'application/vnd.github+json', 'User-Agent': PACKAGE_NAME },
  })
  if (!response.ok) throw new UpdateError('github-http', `GitHub HTTP ${response.status}`)
  return response.json()
}

/** Public GitHub requests only. Mutable main is resolved before reading the manifest. */
export async function fetchLatest({ fetch: fetcher = globalThis.fetch, signal, timeoutMs = 15000 } = {}) {
  const bounded = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)])
  const commit = await readJson(fetcher, `https://api.github.com/repos/${REPOSITORY}/commits/main`, bounded)
  const sha = shaOf(commit.sha)
  if (!sha) throw new UpdateError('invalid-sha', 'GitHub 未返回完整提交 SHA')
  const manifest = await readJson(fetcher, `https://raw.githubusercontent.com/${REPOSITORY}/${sha}/package.json`, bounded)
  if (manifest.name !== PACKAGE_NAME || typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.+-]+)?$/.test(manifest.version)) {
    throw new UpdateError('invalid-package', '上游 package.json 的名称或版本无效')
  }
  return { version: manifest.version, commit: sha, spec: `github:${REPOSITORY}#${sha}` }
}

/** No filesystem mutation: installation, script policy, rollback and activation belong to DSH. */
export function createUpdater(ctx, options = {}) {
  const running = Object.freeze({ ...(options.running ?? RUNNING) })
  const readDisk = options.readDisk ?? packageState
  let latest = null
  const manager = () => {
    const service = ctx.get('pluginManager')
    if (!service) throw new UpdateError('unavailable', '当前 DSH 未提供插件管理器')
    return service
  }
  async function status() {
    const disk = await readDisk()
    return {
      running, disk, latest, busy: shared.busy, requestId: shared.requestId,
      lastResult: shared.lastResult, reloadSupported: typeof options.reload === 'function',
      updateAvailable: latest ? (disk.commit ? disk.commit !== latest.commit : disk.version !== latest.version ? true : null) : null,
      // Equal versions cannot prove equal code. Unknown commits stay explicitly unknown.
      runningMatchesDisk: running.commit && disk.commit ? running.commit === disk.commit : null,
    }
  }
  async function check({ signal } = {}) {
    latest = await fetchLatest({ fetch: options.fetch, signal, timeoutMs: options.checkTimeoutMs })
    return status()
  }
  async function exclusive(work) {
    if (shared.busy) throw new UpdateError('busy', '另一个更新或重载操作正在进行')
    shared.busy = true
    try { return await work() } finally { shared.busy = false; shared.requestId = null }
  }
  async function apply({ signal } = {}) {
    return exclusive(async () => {
      if (!latest) throw new UpdateError('check-required', '请先检查更新')
      signal?.throwIfAborted()
      const target = { ...latest } // A later check must not change this transaction's target.
      const service = manager()
      // Read the manager inventory before installation; missing/disabled bundles are reported by DSH.
      const bundles = await service.listBundles()
      const bundle = bundles.find(item => item.name === PACKAGE_NAME)
      signal?.throwIfAborted()
      const requestId = `${PACKAGE_NAME}-${randomUUID()}`
      shared.requestId = requestId
      const timeout = AbortSignal.timeout(options.installTimeoutMs ?? 180000)
      const bounded = AbortSignal.any([timeout, ...(signal ? [signal] : [])])
      const cancel = () => { service.cancelInstall?.(requestId)?.catch?.(() => {}) }
      bounded.addEventListener('abort', cancel, { once: true })
      try {
        // Never set approvedBuilds: only DSH/user authorization may allow install scripts.
        const result = await service.installBundle(target.spec, { enabled: bundle?.enabled ?? true, requestId })
        shared.lastResult = { ...result, requested: target, finishedAt: new Date().toISOString() }
        return { ...(await status()), busy: false, requestId: null, result: shared.lastResult }
      } finally {
        bounded.removeEventListener('abort', cancel)
        // Keep the lock until the manager settles even if cancellation was too late.
      }
    })
  }
  async function cancel() {
    if (!shared.requestId) return { status: 'not-running' }
    return manager().cancelInstall(shared.requestId)
  }
  async function reload() {
    return exclusive(async () => {
      if (typeof options.reload !== 'function') {
        return { application: 'restart-required', diagnostic: '当前 DSH 未提供可用的代码重载入口，请重启 DSH；刷新页面只更新界面。' }
      }
      return options.reload()
    })
  }
  return { status, check, apply, cancel, reload }
}

/** Slash command remains available independently of the writing enable switch. */
export function updateCommand(ctx, updater = createUpdater(ctx)) {
  return {
    name: 'novel-update', definitionId: 'dsh-novel-master/novel-update',
    description: '检查或拉取小说创作大师更新（check | apply）',
    input: { hint: 'check | apply' },
    handler: async ({ rawInput = '', signal }) => {
      try {
        const action = rawInput.trim() || 'check'
        if (!['check', 'apply'].includes(action)) return { kind: 'error', text: '用法：/novel-update check 或 /novel-update apply' }
        const state = action === 'check' ? await updater.check({ signal }) : await updater.apply({ signal })
        if (state.result) {
          const result = state.result
          const failed = ['failed', 'cancelled', 'overridden'].includes(result.application)
          return { kind: failed ? 'error' : 'success', text: `更新结果：${result.application}。${result.error?.diagnostic ?? result.error?.code ?? ''}${result.application === 'restart-required' ? ' 请重启 DSH。' : ''}${result.pendingBuilds?.length ? ` 需要用户在插件管理器单独批准构建脚本：${result.pendingBuilds.join(', ')}` : ''}` }
        }
        return { kind: 'success', text: `运行版本：${state.running.version}（${state.running.commit ?? '提交未知'}）\n磁盘版本：${state.disk.version}（${state.disk.commit ?? '提交未知'}）\nmain 最新：${state.latest.version}（${state.latest.commit}）\n${state.updateAvailable === false ? '磁盘已是该提交。' : state.updateAvailable === null ? '版本相同但本地提交未知，可拉取以确认。' : '可使用 /novel-update apply 拉取此固定提交。'}` }
      } catch (error) { return { kind: 'error', text: `更新失败：${messageOf(error)}` } }
    },
  }
}

async function requestBody(req) {
  let text = ''
  for await (const chunk of req) {
    text += chunk.toString('utf8')
    if (Buffer.byteLength(text) > 16384) throw new UpdateError('body-too-large', '请求内容过大')
  }
  return text ? JSON.parse(text) : {}
}
function send(res, status, data) {
  if (res.destroyed || res.writableEnded) return
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(data))
}
function allowedWrite(req) {
  // Custom header forces browser preflight; no CORS is granted by this endpoint.
  if (req.headers['x-novel-master'] !== 'settings' || !String(req.headers['content-type'] ?? '').startsWith('application/json')) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return false } catch { return false }
  }
  return true
}

/** Call unconditionally from apply(), before any writing-enabled early return. */
export function installUpdater(ctx, options = {}) {
  const updater = createUpdater(ctx, options)
  const cleanups = []
  const web = ctx.get('webServer')
  if (web) {
    const settings = () => {
      const service = ctx.get('settings')
      if (!service) throw new UpdateError('unavailable', 'DSH settings 服务不可用')
      return service
    }
    // The entry id is instance-specific. Never select another plugin's document.
    const namespace = options.namespace ?? 'include:novel-master'
    const document = () => {
      const item = settings().describe({ redactSecrets: true }).find(row => row.ns === namespace)
      if (!item) throw new UpdateError('no-document', '小说创作大师配置表单尚未就绪')
      return item
    }
    const handler = async (req, res) => {
      try {
        const action = new URL(req.url, 'http://localhost').pathname.slice(API_PATH.length)
        if (req.method === 'GET' && action === '/status') return send(res, 200, await updater.status())
        if (req.method === 'GET' && action === '/settings') return send(res, 200, document())
        if (req.method !== 'POST') return send(res, 405, { error: 'method-not-allowed' })
        if (!allowedWrite(req)) return send(res, 403, { error: 'same-origin-json-required' })
        const body = await requestBody(req)
        if (action === '/settings') {
          if (!Number.isInteger(body.revision)) throw new UpdateError('revision-required', '配置版本号缺失，请重新加载设置')
          const patch = body.patch
          if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new UpdateError('invalid-config', '配置必须为对象')
          // Schema validation and permitted editable paths remain settings service responsibilities.
          await settings().update(document().ns, patch, body.revision)
          return send(res, 200, document())
        }
        if (action === '/check') return send(res, 200, await updater.check())
        if (action === '/apply') return send(res, 200, await updater.apply())
        if (action === '/cancel') return send(res, 200, await updater.cancel())
        if (action === '/reload') return send(res, 200, await updater.reload())
        return send(res, 404, { error: 'not-found' })
      } catch (error) { send(res, error.code === 'busy' ? 409 : 400, { error: messageOf(error), code: error.code ?? 'operation-error' }) }
    }
    cleanups.push(web.register({ kind: 'prefix', path: `${API_PATH}/`, handler }))
  }
  const commandDispose = ctx.commands?.register(updateCommand(ctx, updater))
  if (commandDispose) cleanups.push(commandDispose)
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const cleanup of cleanups.splice(0).reverse()) cleanup()
  }
  ctx.on('dispose', dispose)
  return { ...updater, dispose }
}
