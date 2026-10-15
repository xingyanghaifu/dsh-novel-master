/**
 * Host-private Cordis compatibility adapter for reloading this package's code.
 * Uses the same primitives as installed dsh-our-free-model/src/reload.js.
 * No guessed Service reload method: unknown cache/lifecycle shapes require restart.
 * Call await selfReload(ctx) from an updater/command; inspect result.status.
 * This reloads Host code only; browser bundles need their own rebuild/reload path.
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const LOCK = Symbol.for('dsh-novel-master.code-reload.locks')
const locks = globalThis[LOCK] ??= new Map()
const PACKAGE_URL = new URL('../', import.meta.url).href
const ENTRY_URL = new URL('./index.js', import.meta.url).href

function normalized(url) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'file:') return undefined
  // URL.pathname preserves encoded separators; decode for Windows path/case drift.
  return decodeURIComponent(parsed.pathname).toLowerCase()
}

/** Select the entire package graph, including query variants; exclude siblings. */
export function packageCacheKeys(cache, packageUrl) {
  const base = normalized(packageUrl).replace(/\/+$/, '') + '/'
  return [...cache.keys()].filter(key => {
    try { return typeof key === 'string' && normalized(key)?.startsWith(base) } catch { return false }
  })
}

function cacheOps(cache) {
  if (!cache || ['keys', 'get', 'set', 'delete'].some(key => typeof cache[key] !== 'function')) {
    throw new Error('Host ESM loadCache does not support keys/get/set/delete')
  }
  // Node LoadCache used a Map subclass whose delete only cleared a type slot.
  try {
    Map.prototype.has.call(cache, '')
    return {
      get: key => Map.prototype.get.call(cache, key),
      set: (key, value) => Map.prototype.set.call(cache, key, value),
      delete: key => Map.prototype.delete.call(cache, key),
    }
  } catch {
    return { get: key => cache.get(key), set: (key, value) => cache.set(key, value), delete: key => cache.delete(key) }
  }
}

/** Snapshot before changing anything, including CJS-only dependencies in the package. */
export function snapshotCaches(internal, packageUrl, cjs = require.cache) {
  const ops = cacheOps(internal?.loadCache)
  const esm = new Map(packageCacheKeys(internal.loadCache, packageUrl).map(key => [key, ops.get(key)]))
  const cjsKeys = packageCacheKeys({ keys: () => Object.keys(cjs).map(key => pathToFileURL(key).href) }, packageUrl)
  return { esm, cjs: new Map(cjsKeys.map(key => { const path = fileURLToPath(key); return [path, cjs[path]] })) }
}

/** Purge only this package, and fail explicitly if the Host cache refused deletion. */
export function purgeCaches(internal, packageUrl, cjs = require.cache) {
  const backup = snapshotCaches(internal, packageUrl, cjs)
  const ops = cacheOps(internal.loadCache)
  for (const key of backup.esm.keys()) ops.delete(key)
  for (const key of backup.cjs.keys()) delete cjs[key]
  if (packageCacheKeys(internal.loadCache, packageUrl).length) throw new Error('Host ESM cache deletion did not take effect')
  return backup
}

/** Remove newly imported package jobs before restoring the complete old graph. */
export function restoreCaches(internal, backup, packageUrl, cjs = require.cache) {
  purgeCaches(internal, packageUrl, cjs)
  const ops = cacheOps(internal.loadCache)
  for (const [key, value] of backup.esm) ops.set(key, value)
  for (const [key, value] of backup.cjs) cjs[key] = value
  for (const [key, value] of backup.esm) {
    if (ops.get(key) !== value) throw new Error(`Host did not restore ESM cache entry ${key}`)
  }
}

function active(fiber) {
  if (fiber?._error || fiber?.error) throw fiber._error ?? fiber.error
  // Current Cordis exposes numeric state (2 = active). Some hosts expose phase.
  if (typeof fiber?.state === 'number') {
    if (fiber.state !== 2) throw new Error(`Replacement fiber is not active (state ${fiber.state})`)
  } else if (typeof fiber?.phase === 'string') {
    if (fiber.phase !== 'active') throw new Error(`Replacement fiber is not active (phase ${fiber.phase})`)
  } else throw new Error('Host cannot verify fiber activation state')
}

async function settle(fibers, verify = false) {
  const results = await Promise.allSettled(fibers.map(fiber => fiber.await()))
  const failure = results.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
  if (verify) for (const fiber of fibers) active(fiber)
}

function failure(status, diagnostic, restoration = 'not-needed', extra = {}) {
  return { status, diagnostic, restoration, restored: restoration === 'restored' || restoration === 'unchanged', ...extra }
}

async function reload(ctx, options) {
  const packageUrl = options.packageUrl ?? PACKAGE_URL
  const entryUrl = options.entryUrl ?? ENTRY_URL
  let loader, registry, previous, snapshots, internal, backup
  try {
    loader = ctx.loader
    registry = ctx.registry
    previous = ctx.fiber?.runtime?.callback
    internal = loader?.internal
    if (!loader || typeof loader.import !== 'function' || typeof loader.unwrapExports !== 'function'
      || typeof registry?.get !== 'function' || typeof registry?.delete !== 'function' || !previous) {
      throw new Error('Host loader/registry reload primitives are unavailable')
    }
    const runtime = registry.get(previous)
    snapshots = [...(runtime?.fibers ?? [])].map(fiber => {
      if (typeof fiber.await !== 'function' || typeof fiber.parent?.registry?.plugin !== 'function') {
        throw new Error('Host fiber lifecycle primitives are unavailable')
      }
      active(fiber)
      const entry = fiber.entry?.fiber === fiber || (fiber.uid != null && fiber.entry?.fiber?.uid === fiber.uid) ? fiber.entry : undefined
      return {
        fiber, entry, parent: fiber.parent,
        config: entry ? entry.options.config : fiber._config,
        previous: { apply: runtime.callback, Config: runtime.Config, inject: fiber.inject, name: runtime.name },
      }
    })
    if (!snapshots.length) throw new Error('Plugin runtime has no active owning fibers')
    backup = snapshotCaches(internal, packageUrl)
    // No query-only escape hatch: it would leave stale relative dependencies behind.
    if (!backup.esm.size || ![...backup.esm.keys()].some(key => new URL(key).pathname === new URL(entryUrl).pathname)) {
      throw new Error('Host ESM cache does not expose this package entry; fresh graph reload cannot be guaranteed')
    }
  } catch (error) {
    return failure('restart-required', String(error?.message ?? error), 'unchanged')
  }

  let replacement, oldDisposed = false
  const created = []
  try {
    purgeCaches(internal, packageUrl)
    replacement = loader.unwrapExports(await loader.import(entryUrl, () => []))
    if (typeof replacement?.apply !== 'function' || typeof replacement.Config?.['~standard']?.validate !== 'function') {
      throw new Error('Fresh module must export apply() and a Standard Schema Config')
    }
    if (replacement === previous || replacement.apply === previous) throw new Error('Host returned the unchanged cached plugin')
    // Validate every config before taking down any running fiber.
    for (const { config } of snapshots) {
      const result = replacement.Config['~standard'].validate(config)
      if (!result || typeof result.then === 'function' || result.issues) throw new Error('Fresh Config rejected an owning fiber config')
    }
    oldDisposed = true
    registry.delete(previous)
    await settle(snapshots.map(item => item.fiber))
    if (registry.get(previous)) throw new Error('Original runtime remains registered after disposal')
    for (const item of snapshots) {
      const registered = item.parent.registry.plugin(replacement, item.config)
      const fresh = registered?.ctx?.fiber
      if (!fresh || typeof fresh.await !== 'function') throw new Error('Host registration did not return a fiber')
      created.push(fresh)
      if (item.entry) { fresh.entry = item.entry; item.entry.fiber = fresh }
    }
    await settle(created, true)
    return { status: 'applied', diagnostic: `Reloaded ${created.length} owning fiber(s) from the fresh package graph`, fibers: created.length, restoration: 'not-needed', restored: false }
  } catch (error) {
    const details = [String(error?.message ?? error)]
    let cacheRestored = true
    try { restoreCaches(internal, backup, packageUrl) } catch (restoreError) {
      cacheRestored = false
      details.push(`cache restore failed: ${restoreError?.message ?? restoreError}`)
    }
    if (!oldDisposed) return failure('failed', details.join('; '), cacheRestored ? 'unchanged' : 'failed')
    // A private Host primitive may fail before removing the original runtime.
    // Do not register duplicates on top of a still-owned runtime.
    if (registry.get(previous)) {
      try {
        await settle(snapshots.map(item => item.fiber), true)
        return failure('failed', `${details.join('; ')}; previous runtime still active`, cacheRestored ? 'unchanged' : 'failed')
      } catch {
        return failure('failed', `${details.join('; ')}; original runtime disposal incomplete`, 'failed')
      }
    }
    try {
      if (replacement) registry.delete(replacement)
      await settle(created)
    } catch (cleanupError) {
      // await may report the startup error even after successful disposal. Confirm
      // the runtime is absent before restoring, otherwise duplicate effects are possible.
      if (replacement && registry.get(replacement)) {
        return failure('failed', `${details.join('; ')}; replacement cleanup failed: ${cleanupError?.message ?? cleanupError}`, 'failed')
      }
    }
    if (replacement && registry.get(replacement)) {
      return failure('failed', `${details.join('; ')}; replacement runtime still registered after disposal`, 'failed')
    }
    const restored = []
    try {
      for (const item of snapshots) {
        const fresh = item.parent.registry.plugin(item.previous, item.config)?.ctx?.fiber
        if (!fresh || typeof fresh.await !== 'function') throw new Error('Host did not return a restored fiber')
        restored.push(fresh)
        if (item.entry) { fresh.entry = item.entry; item.entry.fiber = fresh }
      }
      await settle(restored, true)
      return failure('failed', `${details.join('; ')}; previous runtime restored`, cacheRestored ? 'restored' : 'failed')
    } catch (restoreError) {
      // Keep links on actual restoration attempts for loader diagnostics; never
      // point them back at disposed original fibers.
      return failure('failed', `${details.join('; ')}; runtime restore failed: ${restoreError?.message ?? restoreError}`, 'failed')
    }
  }
}

/** Process-wide lock survives replacement of this very module. Calls coalesce. */
export function isReloading(packageUrl = PACKAGE_URL) { return locks.has(normalized(packageUrl)) }

/**
 * Execute outside the caller fiber's disposal scope using an ordinary Node timer.
 * Optional hmr.runExclusive serializes with Host HMR; unsupported hosts return
 * restart-required rather than claiming a query-string entry is a full reload.
 * @returns {Promise<{status: 'applied'|'restart-required'|'failed', diagnostic: string, restoration: string, restored: boolean}>}
 */
export function selfReload(ctx, options = {}) {
  const key = normalized(options.packageUrl ?? PACKAGE_URL)
  if (locks.has(key)) return locks.get(key)
  const operation = new Promise(resolve => {
    setTimeout(async () => {
      try {
        let hmr
        try { hmr = ctx.get?.('hmr') } catch { /* optional service */ }
        const run = () => reload(ctx, options)
        resolve(await (typeof hmr?.runExclusive === 'function' ? hmr.runExclusive(run) : run()))
      } catch (error) { resolve(failure('failed', `Reload orchestration failed: ${error?.message ?? error}`, 'unchanged')) }
    }, 0)
  })
  locks.set(key, operation)
  operation.finally(() => { if (locks.get(key) === operation) locks.delete(key) })
  return operation
}
