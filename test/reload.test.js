import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selfReload, isReloading, packageCacheKeys, snapshotCaches, purgeCaches, restoreCaches } from '../src/reload.js'

const base = 'file:///C:/test/dsh-novel-master/'
const entryUrl = `${base}src/index.js`
const options = { packageUrl: base, entryUrl }
const Config = { '~standard': { validate: value => ({ value }) } }

function fixture({ importError, failActivation, restoreFails, unchanged, exclusive = false, copies = 1 } = {}) {
  const previous = function oldApply() {}
  const replacement = { apply() {}, Config }
  const cache = new Map([
    [entryUrl, { old: 'entry' }],
    [`${base}src/reload.js`, { old: 'reload' }],
    [`${base}src/commands.js`, { old: 'commands' }],
    [`${base}src/deep/helper.js?generation=old`, { old: 'nested' }],
    [`${base.slice(0, -1)}-sibling/src/index.js`, { foreign: true }],
  ])
  const before = new Map(cache)
  const runtimes = new Map()
  const calls = { imports: 0, deleted: [], awaited: [], registered: [], exclusive: 0 }
  const registry = {
    get(plugin) { return runtimes.get(typeof plugin === 'function' ? plugin : plugin.apply) },
    delete(plugin) {
      const key = typeof plugin === 'function' ? plugin : plugin.apply
      calls.deleted.push(key)
      const runtime = runtimes.get(key)
      runtimes.delete(key)
      for (const fiber of runtime?.fibers ?? []) fiber.state = 4
      return runtime
    },
    plugin(plugin, config) {
      calls.registered.push({ plugin, config })
      const failed = plugin === replacement ? failActivation : restoreFails
      const fiber = {
        uid: ++id, parent, inject: plugin.inject, _config: config,
        state: failed ? 3 : 2,
        _error: failed ? new Error(plugin === replacement ? 'new startup failed' : 'restore startup failed') : undefined,
        ctx: {},
        async await() { calls.awaited.push(this); return this }, // deliberately does NOT throw
      }
      fiber.ctx.fiber = fiber
      let runtime = registry.get(plugin)
      if (!runtime) runtimes.set(plugin.apply, runtime = { callback: plugin.apply, Config: plugin.Config, fibers: [] })
      runtime.fibers.push(fiber)
      return fiber
    },
  }
  let id = 0
  const parent = { registry }
  const originals = Array.from({ length: copies }, (_, index) => {
    const config = { enabled: index === 0, commands: { novel: true } }
    const fiber = {
      uid: ++id, parent, state: 2, inject: { commands: null }, _config: { wrong: true },
      async await() { calls.awaited.push(this); return this },
    }
    const entry = { fiber, options: { config }, id: `entry-${index}` }
    fiber.entry = entry
    return fiber
  })
  runtimes.set(previous, { callback: previous, Config, name: 'novel-master', fibers: originals })
  const ctx = {
    fiber: { runtime: { callback: previous } }, registry,
    loader: {
      internal: { loadCache: cache }, unwrapExports: value => value,
      async import(url, dependencies) {
        calls.imports++
        assert.equal(url, entryUrl)
        assert.deepEqual(dependencies(), [])
        assert.equal(packageCacheKeys(cache, base).length, 0)
        assert.equal(cache.get(`${base.slice(0, -1)}-sibling/src/index.js`), before.get(`${base.slice(0, -1)}-sibling/src/index.js`))
        cache.set(entryUrl, { fresh: true })
        cache.set(`${base}src/new-only.js`, { fresh: 'only' })
        if (importError) throw new Error('syntax failure')
        return unchanged ? { apply: previous, Config } : replacement
      },
    },
    get: () => exclusive ? { async runExclusive(operation) { calls.exclusive++; return operation() } } : undefined,
  }
  return { ctx, previous, replacement, originals, cache, before, calls, registry }
}

test('reload preserves each loader entry and config and waits for old/new fibers', async () => {
  const f = fixture({ copies: 2, exclusive: true })
  const entries = f.originals.map(fiber => fiber.entry)
  const result = await selfReload(f.ctx, options)
  assert.equal(result.status, 'applied')
  assert.equal(result.fibers, 2)
  assert.equal(f.calls.exclusive, 1)
  assert.equal(f.calls.imports, 1)
  assert.equal(f.calls.registered.length, 2)
  for (let i = 0; i < entries.length; i++) {
    assert.equal(f.calls.registered[i].config, entries[i].options.config)
    assert.notEqual(entries[i].fiber, f.originals[i])
    assert.equal(entries[i].fiber.entry, entries[i])
    assert.equal(entries[i].fiber.state, 2)
    assert.ok(f.calls.awaited.includes(f.originals[i]))
    assert.ok(f.calls.awaited.includes(entries[i].fiber))
  }
})

test('purges entire package graph, not just entry, with Map subclass delete override', () => {
  class LoadCache extends Map { delete() { throw new Error('wrong delete API') } }
  const cache = new LoadCache([[entryUrl, 1], [`${base}src/deep.js`, 2], [`${base}src/deep.js?v=2`, 3], [`${base}other.cjs`, 4], ['file:///C:/test/foreign.js', 5]])
  const cjs = { 'C:\\test\\dsh-novel-master\\only.cjs': { id: 1 }, 'C:\\test\\foreign.cjs': { id: 2 } }
  const backup = snapshotCaches({ loadCache: cache }, base, cjs)
  purgeCaches({ loadCache: cache }, base, cjs)
  assert.equal(cache.size, 1)
  assert.deepEqual(Object.keys(cjs), ['C:\\test\\foreign.cjs'])
  cache.set(`${base}fresh.js`, 99)
  restoreCaches({ loadCache: cache }, backup, base, cjs)
  assert.equal(cache.size, 5)
  assert.equal(cache.has(`${base}fresh.js`), false)
  assert.equal(cjs['C:\\test\\dsh-novel-master\\only.cjs'].id, 1)
})

test('unchanged entry is a failed reload, not a query fallback success', async () => {
  const f = fixture({ unchanged: true })
  const result = await selfReload(f.ctx, options)
  assert.equal(result.status, 'failed')
  assert.match(result.diagnostic, /unchanged cached/)
  assert.equal(result.restoration, 'unchanged')
  assert.equal(f.calls.deleted.length, 0)
  assert.deepEqual(f.cache, f.before)
})

test('import failure restores cache graph and leaves existing runtime untouched', async () => {
  const f = fixture({ importError: true })
  const result = await selfReload(f.ctx, options)
  assert.equal(result.status, 'failed')
  assert.equal(result.restored, true)
  assert.equal(result.restoration, 'unchanged')
  assert.equal(f.calls.deleted.length, 0)
  assert.equal(f.originals[0].entry.fiber, f.originals[0])
  assert.deepEqual(f.cache, f.before)
})

test('await resolving failed activation still triggers rollback with schema and inject metadata', async () => {
  const f = fixture({ failActivation: true })
  const result = await selfReload(f.ctx, options)
  assert.equal(result.status, 'failed')
  assert.equal(result.restoration, 'restored')
  assert.match(result.diagnostic, /new startup failed/)
  assert.equal(f.calls.registered.length, 2)
  assert.equal(f.calls.registered[1].plugin.apply, f.previous)
  assert.equal(f.calls.registered[1].plugin.Config, Config)
  assert.deepEqual(f.calls.registered[1].plugin.inject, { commands: null })
  assert.equal(f.originals[0].entry.fiber.state, 2)
  assert.notEqual(f.originals[0].entry.fiber, f.originals[0])
  assert.ok(f.calls.awaited.some(fiber => fiber._error?.message === 'new startup failed'))
  assert.deepEqual(f.cache, f.before)
})

test('failed restoration is explicit rather than reported as fallback success', async () => {
  const f = fixture({ failActivation: true, restoreFails: true })
  const result = await selfReload(f.ctx, options)
  assert.equal(result.status, 'failed')
  assert.equal(result.restored, false)
  assert.equal(result.restoration, 'failed')
  assert.match(result.diagnostic, /runtime restore failed/)
})

test('unsupported cache and lifecycle hosts require restart without mutation', async () => {
  for (const breakHost of [
    f => { f.ctx.loader.internal.loadCache = {} },
    f => { f.ctx.loader.internal.loadCache.clear() },
    f => { f.originals[0].state = undefined },
    f => { f.ctx.loader.import = undefined },
  ]) {
    const f = fixture()
    breakHost(f)
    const result = await selfReload(f.ctx, options)
    assert.equal(result.status, 'restart-required')
    assert.equal(f.calls.imports, 0)
    assert.equal(f.calls.deleted.length, 0)
  }
})

test('inactive replacement without a thrown error is still rolled back', async () => {
  const f = fixture()
  const originalPlugin = f.registry.plugin
  f.registry.plugin = (plugin, config) => {
    const fiber = originalPlugin(plugin, config)
    if (plugin === f.replacement) fiber.state = 0
    return fiber
  }
  const result = await selfReload(f.ctx, options)
  assert.equal(result.status, 'failed')
  assert.match(result.diagnostic, /not active/)
  assert.equal(result.restoration, 'restored')
})

test('invalid Config and config validation rejection do not dispose old fibers', async () => {
  for (const config of [undefined, { '~standard': { validate: () => ({ issues: [{ message: 'invalid' }] }) } }]) {
    const f = fixture()
    f.replacement.Config = config
    const result = await selfReload(f.ctx, options)
    assert.equal(result.status, 'failed')
    assert.equal(result.restoration, 'unchanged')
    assert.equal(f.calls.deleted.length, 0)
    assert.deepEqual(f.cache, f.before)
  }
})

test('process-wide lock coalesces across module replacement and starts outside caller stack', async () => {
  const f = fixture()
  const freshModule = await import(`../src/reload.js?test=${Date.now()}`)
  const first = selfReload(f.ctx, options)
  assert.equal(f.calls.imports, 0, 'plain timer must defer work until after caller stack')
  assert.equal(isReloading(base), true)
  const second = freshModule.selfReload(f.ctx, options)
  assert.equal(first, second)
  assert.equal((await first).status, 'applied')
  assert.equal(f.calls.imports, 1)
  assert.equal(isReloading(base), false)
})
