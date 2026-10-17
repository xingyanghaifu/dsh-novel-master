import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createUpdateTransport, createUpdater, fetchLatest, installUpdater, updateCommand } from '../src/updater.js'

const SHA = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)
const spec = `github:xingyanghaifu/dsh-novel-master#${SHA}`
const response = data => ({ ok: true, json: async () => data })
// DSH webServer's directory-prefix contract: the router supplies the separator.
// Route through it instead of invoking captured handlers for arbitrary URLs.
function matchRoute(routes, pathname) {
  return routes.filter(route => route.kind === 'exact' ? pathname === route.path
    : pathname === route.path || pathname.startsWith(`${route.path}/`))
    .sort((a, b) => Number(b.kind === 'exact') - Number(a.kind === 'exact') || b.path.length - a.path.length)[0]
}
function transport(calls = []) {
  return async (url, options) => {
    calls.push({ url, options })
    return response(url.endsWith('/commits/main') ? { sha: SHA } : { name: 'dsh-novel-master', version: '1.3.0' })
  }
}
function setup(extra = {}) {
  const calls = []
  const manager = {
    listBundles: async () => [{ name: 'dsh-novel-master', enabled: true }],
    installBundle: async (...args) => { calls.push(args); return { application: 'applied', changed: true } },
    cancelInstall: async () => ({ status: 'cancelled' }),
    ...extra.manager,
  }
  const ctx = { get: key => key === 'pluginManager' ? manager : undefined }
  const options = {
    fetch: transport(), running: { version: '1.2.0', commit: OTHER },
    readDisk: () => ({ version: '1.2.0', commit: OTHER }), ...extra.options,
  }
  return { ctx, manager, calls, options, updater: createUpdater(ctx, options) }
}

test('update proxy is request-local, reuses an agent and changes on the next request', async () => {
  const original = globalThis.fetch
  const calls = []
  let proxy = 'http://127.0.0.1:7897'
  const transport = createUpdateTransport(() => proxy)
  globalThis.fetch = async (_url, options) => { calls.push(options); return response({}) }
  try {
    await transport.fetch('https://example.test', {})
    await transport.fetch('https://example.test', {})
    assert.ok(calls[0].dispatcher)
    assert.equal(calls[0].dispatcher, calls[1].dispatcher)
    proxy = 'http://127.0.0.1:7898'
    await transport.fetch('https://example.test', {})
    assert.notEqual(calls[0].dispatcher, calls[2].dispatcher)
    proxy = 'file:///wrong'
    await assert.rejects(transport.fetch('https://example.test', {}), /只支持/)
    assert.equal(calls.length, 3)
  } finally { globalThis.fetch = original; transport.dispose() }
})

test('resolve main to a full SHA before fetching the manifest; installs only that pin with no build approvals', async () => {
  const fetches = []
  const { updater, calls } = setup({ options: { fetch: transport(fetches) } })
  await updater.check()
  assert.match(fetches[0].url, /\/commits\/main$/)
  assert.equal(fetches[1].url, `https://raw.githubusercontent.com/xingyanghaifu/dsh-novel-master/${SHA}/package.json`)
  const state = await updater.apply()
  assert.equal(calls[0][0], spec)
  assert.equal(calls[0][1].enabled, true)
  assert.ok(calls[0][1].requestId)
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ['enabled', 'requestId'])
  assert.equal(state.result.application, 'applied')
  assert.equal(state.busy, false)
  assert.equal(state.running.commit, OTHER, 'install success must not relabel the old runtime')
})

test('successful install invokes code reload and preserves both outcomes', async () => {
  let reloads = 0
  const { updater } = setup({ options: { reload: async () => { reloads++; return { application: 'applied' } } } })
  await updater.check()
  const state = await updater.apply()
  assert.equal(reloads, 1)
  assert.equal(state.result.application, 'applied')
  assert.equal(state.result.codeReload.application, 'applied')
})

test('failed install does not reload; failed reload remains visible after a successful install', async () => {
  let reloads = 0
  const broken = setup({ manager: { installBundle: async () => ({ application: 'failed' }) }, options: { reload: async () => { reloads++; return { application: 'applied' } } } })
  await broken.updater.check()
  await broken.updater.apply()
  assert.equal(reloads, 0)
  const h = setup({ options: { reload: async () => { throw new Error('reload broke') } } })
  await h.updater.check()
  const state = await h.updater.apply()
  assert.equal(state.result.application, 'applied')
  assert.equal(state.result.codeReload.application, 'failed')
  assert.match(state.result.codeReload.diagnostic, /reload broke/)
  const command = updateCommand(h.ctx, h.updater)
  const result = await command.handler({ rawInput: 'reload' })
  assert.equal(result.kind, 'error')
  assert.match(result.text, /reload broke/)
})

test('rejects malformed SHA and wrong package without invoking the manager', async () => {
  await assert.rejects(fetchLatest({ fetch: async () => response({ sha: 'main' }) }), /完整提交 SHA/)
  const { updater, calls } = setup({ options: { fetch: async url => response(url.endsWith('/commits/main') ? { sha: SHA } : { name: 'wrong', version: '1.0.0' }) } })
  await assert.rejects(updater.check(), /名称或版本无效/)
  await assert.rejects(updater.apply(), /先检查更新/)
  assert.equal(calls.length, 0)
})

test('propagates GitHub HTTP and transport errors', async () => {
  await assert.rejects(fetchLatest({ fetch: async () => ({ ok: false, status: 403 }) }), /403/)
  const { updater, calls } = setup({ options: { fetch: async () => { throw new Error('offline') } } })
  await assert.rejects(updater.check(), /offline/)
  assert.equal(calls.length, 0)
})

test('GitHub requests honor caller cancellation and timeouts', async () => {
  const never = (_url, { signal }) => new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  const controller = new AbortController()
  const checking = fetchLatest({ fetch: never, signal: controller.signal })
  controller.abort(new Error('cancel-check'))
  await assert.rejects(checking, /cancel-check/)
  // AbortSignal.timeout is unref'ed: keep one real timer alive in this isolated test.
  const hold = setTimeout(() => {}, 200)
  try {
    await assert.rejects(
      fetchLatest({ fetch: never, timeoutMs: 5 }),
      error => error.code === 'github-timeout' && /超时/.test(error.message),
    )
  } finally { clearTimeout(hold) }
})

test('settings API maps GitHub network failures to 502 and timeouts to 504', async () => {
  let route
  const ctx = {
    fiber: {},
    get: key => key === 'webServer' ? { register(value) { route = value; return () => {} } } : key === 'connection' ? { requestRejection: () => undefined } : undefined,
    on() {},
  }
  const request = async action => {
    const req = Readable.from([])
    Object.assign(req, { method: 'POST', url: `/api/novel-master/${action}`, headers: { host: 'localhost', 'content-type': 'application/json', 'x-novel-master': 'settings' } })
    const res = { writeHead(status) { this.status = status }, end(text) { this.data = JSON.parse(text) } }
    await route.handler(req, res)
    return res
  }
  const network = installUpdater(ctx, { fetch: async () => { throw new Error('fetch failed') } })
  assert.equal((await request('check')).status, 502)
  network.dispose()

  const timeout = installUpdater(ctx, { fetch: async () => { throw Object.assign(new Error('operation timed out'), { name: 'TimeoutError' }) } })
  const timed = await request('check')
  assert.equal(timed.status, 504)
  assert.match(timed.data.error, /超时/)
  assert.equal(timed.data.code, 'github-timeout')
  timeout.dispose()
})

test('failed install diagnostics, pending scripts, and restart-required are preserved', async () => {
  const failure = { application: 'failed', changed: false, error: { code: 'operation-error', diagnostic: 'activation failed' }, pendingBuilds: ['blocked-build'] }
  const { updater, ctx, manager } = setup({ manager: { installBundle: async () => failure } })
  await updater.check()
  const state = await updater.apply()
  assert.equal(state.result.error.diagnostic, 'activation failed')
  assert.deepEqual(state.result.pendingBuilds, ['blocked-build'])
  const command = updateCommand(ctx, updater)
  const failed = await command.handler({ rawInput: 'apply' })
  assert.equal(failed.kind, 'error')
  assert.match(failed.text, /activation failed/)
  assert.match(failed.text, /blocked-build/)
  manager.installBundle = async () => ({ application: 'restart-required', changed: true })
  assert.equal((await updater.apply()).result.application, 'restart-required')
})

test('concurrent update lock survives HMR and is released after settlement', async () => {
  let finish
  const { updater, ctx, options } = setup({ manager: { installBundle: async () => new Promise(resolve => { finish = resolve }) } })
  await updater.check()
  const operation = updater.apply()
  await new Promise(resolve => setImmediate(resolve))
  const fresh = await import(`../src/updater.js?test-hmr=${Date.now()}`)
  const next = fresh.createUpdater(ctx, options)
  await next.check()
  await assert.rejects(next.apply(), /另一个更新/)
  assert.equal((await next.status()).busy, true)
  finish({ application: 'applied', changed: true })
  await operation
  assert.equal((await next.status()).busy, false)
})

test('abort requests manager cancellation and retains lock until install settles', async () => {
  let finish
  const cancellations = []
  const { updater } = setup({ manager: {
    installBundle: async () => new Promise(resolve => { finish = resolve }),
    cancelInstall: async id => { cancellations.push(id); return { status: 'too-late' } },
  } })
  await updater.check()
  const controller = new AbortController()
  const operation = updater.apply({ signal: controller.signal })
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cancellations.length, 1)
  assert.equal((await updater.status()).busy, true)
  finish({ application: 'cancelled', changed: false })
  assert.equal((await operation).result.application, 'cancelled')
  assert.equal((await updater.status()).busy, false)
})

test('equal versions and unknown commits are not reported as proven latest/running', async () => {
  const { updater } = setup({ options: { readDisk: () => ({ version: '1.3.0', commit: null }) } })
  const state = await updater.check()
  assert.equal(state.updateAvailable, null)
  assert.equal(state.runningMatchesDisk, null)
  assert.equal((await updater.reload()).application, 'restart-required')
})

test('settings routes wait for late Web service and remount after replacement', async () => {
  let activate, cleanup, forkDisposed = 0
  const routes = [], removed = []
  const ctx = {
    get: key => key === 'connection' ? { requestRejection: () => undefined } : undefined,
    inject(deps, callback) { assert.deepEqual(deps, ['webServer']); activate = callback; return { dispose() { forkDisposed++; cleanup?.() } } },
    on() {}, commands: { register: () => () => {} },
  }
  const updater = installUpdater(ctx)
  assert.equal(routes.length, 0)
  const scope = name => ({
    get: key => key === 'webServer' ? { register(route) { routes.push(route); return () => removed.push(name) } } : undefined,
    effect(effect) { cleanup = effect() },
  })
  activate(scope('first'))
  assert.equal(routes[0].path, '/api/novel-master')
  assert.equal(matchRoute(routes, '/api/novel-master-evil/settings'), undefined)
  const selected = matchRoute(routes, '/api/novel-master/status')
  assert.ok(selected, 'normal status URL must match the mounted prefix')
  const res = { writeHead(code) { this.code = code }, end(body) { this.body = JSON.parse(body) } }
  await selected.handler({ method: 'GET', url: '/api/novel-master/status' }, res)
  assert.equal(res.code, 200)
  assert.ok(res.body.running)
  cleanup()
  activate(scope('second'))
  assert.equal(routes.length, 2)
  updater.dispose(); updater.dispose()
  assert.equal(forkDisposed, 1)
  assert.deepEqual(removed, ['first', 'second'])
})

test('real settings endpoint persists revisioned edits; updater remains mounted without writing enabled', async () => {
  let route, disposed = 0
  let document = { ns: 'novel-master', revision: 1, value: { enabled: false, commands: { novel: false } } }
  const fiber = {}
  fiber.entry = { id: 'include:novel-master', options: { id: 'novel-master' }, fiber }
  const settings = {
    describe: () => [document],
    update: async (ns, patch, revision) => {
      assert.equal(ns, document.ns)
      assert.equal(revision, 1)
      document = { ...document, revision: 2, value: { ...document.value, ...patch } }
    },
  }
  const ctx = {
    fiber,
    get: key => key === 'webServer' ? { register: value => { route = value; return () => { disposed++ } } } : key === 'settings' ? settings : key === 'connection' ? { requestRejection: () => undefined } : undefined,
    commands: { register: definition => { assert.equal(definition.name, 'novel-update'); return () => { disposed++ } } },
    on() {},
  }
  const activity = { learningEnabled: false, decisionEnabled: false, activeJobs: 0, lastError: 'example diagnostic' }
  const updater = installUpdater(ctx, { intelligence: { status: () => activity } })
  async function request(method, action, data, headers = {}) {
    const req = Readable.from(data ? [JSON.stringify(data)] : [])
    Object.assign(req, { method, url: `/api/novel-master/${action}`, headers: { host: 'localhost:19387', 'content-type': 'application/json', 'x-novel-master': 'settings', ...headers } })
    const res = { writeHead(status) { this.status = status }, end(text) { this.data = JSON.parse(text) } }
    const selected = matchRoute([{ kind: 'prefix', path: '/api', handler() { throw new Error('plugin route fell through to kernel API') } }, route], new URL(req.url, 'http://localhost').pathname)
    assert.equal(selected, route, 'normal plugin API URL must win longest-prefix dispatch')
    await selected.handler(req, res)
    return res
  }
  assert.equal((await request('GET', 'settings')).data.value.enabled, false)
  assert.deepEqual((await request('GET', 'intelligence/status')).data, activity)
  const saved = await request('POST', 'settings', { revision: 1, patch: { enabled: true } })
  assert.equal(saved.data.value.enabled, true)
  assert.equal(saved.data.revision, 2)
  assert.equal((await request('POST', 'settings', { patch: {} })).status, 400)
  assert.equal((await request('POST', 'apply', {}, { origin: 'https://evil.example' })).status, 403)
  updater.dispose(); updater.dispose()
  assert.equal(disposed, 2)
})

test('settings namespace resolves only the owning entry across renamed instances', async () => {
  let route, own, writes = []
  const fiber = {}, foreignFiber = {}
  const docs = [{ ns: 'other-novel', revision: 4, value: { projectsDir: 'other' } }, { ns: 'my-writing', revision: 9, value: { projectsDir: 'mine' } }]
  own = { id: 'include:my-writing', options: { id: 'my-writing' }, fiber }
  const ctx = {
    fiber,
    get(key) { return {
      webServer: { register(value) { route = value; return () => {} } },
      configEditor: { entries: () => [{ id: 'include:other-novel', options: { id: 'other-novel' }, fiber: foreignFiber }, own] },
      settings: { describe: () => docs, update: async (...args) => { writes.push(args) } },
      connection: { requestRejection: () => undefined },
    }[key] }, on() {}, commands: { register: () => () => {} },
  }
  const updater = installUpdater(ctx)
  async function request(body) {
    const req = Readable.from(body ? [JSON.stringify(body)] : [])
    Object.assign(req, { method: body ? 'POST' : 'GET', url: '/api/novel-master/settings', headers: { host: 'localhost', 'content-type': 'application/json', 'x-novel-master': 'settings' } })
    const res = { writeHead(code) { this.code = code }, end(text) { this.data = JSON.parse(text) } }
    await route.handler(req, res); return res
  }
  assert.equal((await request()).data.ns, 'my-writing')
  await request({ revision: 9, patch: { enabled: false } })
  assert.deepEqual(writes, [['my-writing', { enabled: false }, 9]])
  own = { ...own, fiber: foreignFiber }
  assert.equal((await request()).data.code, 'no-owner')
  updater.dispose()
})

test('matched plugin routes retain Host authentication before reading settings or actions', async () => {
  let route, connection, reads = 0
  const ctx = {
    get: key => key === 'connection' ? connection : key === 'settings' ? { describe() { reads++; return [] } }
      : key === 'webServer' ? { register(value) { route = value; return () => {} } } : undefined,
    on() {}, commands: { register: () => () => {} },
  }
  const updater = installUpdater(ctx)
  const request = async () => {
    const res = { writeHead(code) { this.code = code }, end(body) { this.body = JSON.parse(body) } }
    await matchRoute([route], '/api/novel-master/settings').handler({ method: 'GET', url: '/api/novel-master/settings', headers: {} }, res)
    return res.code
  }
  assert.equal(await request(), 503)
  connection = { requestRejection: () => 401 }; assert.equal(await request(), 401)
  connection = { requestRejection: () => 403 }; assert.equal(await request(), 403)
  connection = { requestRejection() { throw new Error('private internal detail') } }; assert.equal(await request(), 503)
  assert.equal(reads, 0)
  updater.dispose()
})

test('settings client mounts controls and saves real checkbox edits through the business API', async () => {
  let plugin, registered
  const calls = []
  let hook = 0
  const states = [
    { ns: 'include:novel-master', revision: 7, value: { enabled: false, projectsDir: 'books', commands: { novel: false, backup: true } } },
    { running: { version: '1.2.0' }, disk: { version: '1.3.0' }, reloadSupported: false },
    '', '', '', 'books',
  ]
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: initial => [hook < states.length ? states[hook++] : initial, () => {}],
    useEffect() {}, useRef: value => ({ current: value }),
  }
  const context = {
    window: { __ModuleLoader__: { load: bundle => { plugin = bundle.factory(() => React) } }, location: { reload() {} } },
    document: { baseURI: 'http://localhost:19387/prefix/' }, URL, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url, options })
      return { ok: true, json: async () => ({ revision: 8, value: { enabled: true, projectsDir: 'books', commands: { novel: false } } }) }
    },
  }
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), context)
  plugin.apply({ slots: { inject: (name, callback) => { assert.equal(name, 'settings.section'); callback() }, register: (meta, render) => { registered = { meta, render } } } })
  assert.equal(registered.meta.id, 'novel-master')
  const component = registered.render({})
  const tree = component.type(component.props)
  function flatten(value) {
    if (Array.isArray(value)) return value.flatMap(flatten)
    if (!value || typeof value !== 'object') return []
    return [value, ...value.children.flatMap(flatten)]
  }
  const nodes = flatten(tree)
  const toggles = nodes.filter(node => node.type === 'input' && node.props.type === 'checkbox')
  assert.equal(toggles.length, 4, 'total switch plus every command flag are actual inputs')
  assert.equal(toggles[0].props.checked, false)
  await toggles[0].props.onChange({ target: { checked: true } })
  assert.equal(calls[0].url, '/prefix/api/novel-master/settings')
  assert.deepEqual(JSON.parse(calls[0].options.body), { patch: { enabled: true }, revision: 7 })
  const buttons = nodes.filter(node => node.type === 'button')
  for (const label of ['检查更新', '拉取此提交', '重载插件', '刷新界面']) assert.ok(buttons.some(button => button.children.includes(label)), label)
})
