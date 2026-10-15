import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createLearningStore, resolveLearningDirectory } from '../src/learning-store.js'

let cwd
beforeEach(() => { cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-store-')) })
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }) })
const make = (options = {}) => createLearningStore({ cwd, provider: 'provider/one', model: 'model/version', ...options })
const learning = summary => ({ type: 'learning', summary })
const records = store => fs.readdirSync(store.location).filter(file => file.endsWith('.json'))

test('reports exact normalized storage root and stores original observed and generator identities separately', () => {
  const store = make()
  assert.equal(store.root, path.join(cwd, 'novel_learning'))
  assert.ok(path.isAbsolute(store.location))
  const input = { type: 'decision', summary: 'Prefer a shorter opening', source: { sessionId: 'session-1', project: 'book', eventId: 'event-1' }, evidence: 'Opening repeats the setting.', reference: 'chapter:1', generator: { provider: 'summarizer', model: 'different/model' }, decision: { action: 'shorten-opening', reason: 'Less repetition', confidence: 0.8, alternatives: ['retain'] } }
  const saved = store.append(input)
  assert.equal(path.dirname(saved.location), store.location)
  assert.equal(saved.provider, 'provider/one')
  assert.equal(saved.model, 'model/version')
  assert.equal(saved.generator.provider, 'summarizer')
  input.summary = 'mutation after append'
  const listed = store.list()[0]
  assert.equal(listed.summary, 'Prefer a shorter opening')
  assert.equal(listed.schemaVersion, 1)
  assert.equal(listed.source.sessionId, 'session-1')
  assert.equal(Object.hasOwn(listed, 'location'), false)
  assert.equal(fs.statSync(saved.location).nlink, 1)
})

test('absolute directory accepted while workspaces providers case and slug collisions remain isolated', () => {
  const directory = path.join(cwd, 'shared')
  const second = path.join(cwd, 'other-workspace'); fs.mkdirSync(second)
  const stores = [make({ directory }), make({ directory, provider: 'provider-one' }), make({ directory, model: 'model-version' }), make({ directory, model: 'MODEL/version' }), make({ directory, cwd: second })]
  assert.equal(new Set(stores.map(store => store.location)).size, stores.length)
  stores.forEach((store, index) => store.append(learning(`entry-${index}`)))
  stores.forEach((store, index) => assert.deepEqual(store.list().map(record => record.summary), [`entry-${index}`]))
  assert.equal(make({ directory }).location, stores[0].location)
})

test('bounds metadata and typed records, rejects unknown prompt fields and invalid decisions', () => {
  const store = make()
  for (const bad of [
    { type: 'learning', summary: '' }, { type: 'learning', summary: 'x'.repeat(8001) },
    { type: 'learning', summary: 'x', rawPrompt: 'secret' },
    { type: 'learning', summary: 'x', source: { log: 'raw' } },
    { type: 'learning', summary: 'x', evidence: 'x'.repeat(8001) },
    { type: 'learning', summary: 'x', generator: { provider: 'other' } },
    { type: 'decision', summary: 'x', decision: { action: 'a', confidence: 2 } },
    { type: 'decision', summary: 'x' },
    { type: 'learning', summary: 'x', decision: { action: 'a' } },
  ]) assert.throws(() => store.append(bad))
  assert.deepEqual(store.list(), [])
  for (const options of [{ provider: '' }, { model: '' }, { maxRecords: 0 }, { maxRecords: 10001 }]) assert.throws(() => make(options))
})

test('hard append cap never deletes data and recent/list bounds and type filters are deterministic', () => {
  const store = make({ maxRecords: 3 })
  const a = store.append(learning('first'))
  const b = store.append({ type: 'decision', summary: 'decision', decision: { action: 'continue' } })
  const c = store.append(learning('last'))
  assert.throws(() => store.append(learning('overflow')), /maxRecords/)
  assert.equal(records(store).length, 3)
  assert.equal(store.list().length, 3)
  assert.equal(store.list({ limit: 0 }).length, 0)
  assert.equal(store.list({ type: 'decision' })[0].id, b.id)
  assert.deepEqual(store.recent(2).map(item => item.id), store.list({ limit: 2 }).reverse().map(item => item.id))
  assert.ok(fs.existsSync(a.location) && fs.existsSync(c.location))
  assert.throws(() => store.list({ limit: 4 }), /limit/)
  assert.throws(() => store.list({ type: 'unknown' }), /type/)
  const reduced = make({ maxRecords: 2 })
  assert.throws(() => reduced.list(), /exceeds/)
  assert.equal(records(store).length, 3)
})

test('project filter is applied before the recent result window', () => {
  const store = make()
  const first = store.append({ type: 'learning', summary: 'book A lesson', source: { project: 'A' } })
  for (let i = 0; i < 22; i++) store.append({ type: 'learning', summary: `book B lesson ${i}`, source: { project: 'B' } })
  assert.deepEqual(store.list({ limit: 20, project: 'A' }).map(row => row.id), [first.id])
  assert.equal(store.list({ limit: 2, type: 'learning', project: 'B' }).length, 2)
  assert.throws(() => store.list({ project: {} }), /project/)
})

test('tampered identity id schema date and excessive serialized content reject reads and appends', () => {
  const store = make()
  const item = store.append(learning('intact'))
  const original = fs.readFileSync(item.location, 'utf8')
  for (const patch of [{ provider: 'forged' }, { model: 'forged' }, { id: 'wrong' }, { schemaVersion: 7 }, { createdAt: 'yesterday' }, { summary: 'x'.repeat(40000) }]) {
    fs.writeFileSync(item.location, JSON.stringify({ ...JSON.parse(original), ...patch }))
    assert.throws(() => store.list())
    assert.throws(() => store.append(learning('next')))
    assert.equal(records(store).length, 1)
  }
  fs.writeFileSync(item.location, original)
  assert.equal(store.list()[0].summary, 'intact')
})

test('failed write leaves old records intact and releases lock without publishing partial JSON', () => {
  const store = make()
  store.append(learning('before'))
  const write = fs.writeFileSync
  fs.writeFileSync = () => { throw new Error('simulated disk full') }
  try { assert.throws(() => store.append(learning('broken')), /disk full/) } finally { fs.writeFileSync = write }
  assert.equal(records(store).length, 1)
  assert.deepEqual(store.list().map(item => item.summary), ['before'])
  assert.equal(fs.existsSync(path.join(store.location, '.append-lock')), false)
  assert.equal(fs.readdirSync(store.location).some(file => file.endsWith('.tmp')), false)
  store.append(learning('after'))
  assert.equal(store.list().length, 2)
})

test('refuses unsafe path spelling and unsafe parent or destination links', t => {
  for (const directory of ['', '../escape', 'a/../b', 'a/./b', 'trailing.', 'trailing ', 'NUL', 'a:stream', 'x\u0000y']) assert.throws(() => make({ directory }), undefined, directory)
  assert.throws(() => resolveLearningDirectory({ cwd: '.', directory: 'x' }), /explicit absolute/)
  const target = path.join(cwd, 'target'); fs.mkdirSync(target)
  const link = path.join(cwd, 'link')
  try { fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir') } catch (error) { if (error.code === 'EPERM') { t.skip('OS does not permit symlink creation'); return } throw error }
  assert.throws(() => make({ directory: path.join(link, 'nested') }), /symbolic link/)
  const store = make()
  const item = store.append(learning('safe'))
  const hard = path.join(cwd, 'hard-record')
  fs.linkSync(item.location, hard)
  assert.throws(() => store.list(), /Unsafe/)
  fs.unlinkSync(hard)
  fs.unlinkSync(item.location)
  fs.symlinkSync(path.join(cwd, 'missing.json'), item.location, 'file')
  assert.throws(() => store.list(), /Unsafe/)
})

test('explicit stale lock refuses writes rather than stealing or deleting user data', () => {
  const store = make()
  store.append(learning('safe'))
  const lock = path.join(store.location, '.append-lock')
  fs.mkdirSync(lock)
  assert.throws(() => store.append(learning('busy')), /busy/)
  assert.ok(fs.existsSync(lock))
  assert.equal(store.list().length, 1)
  fs.rmdirSync(lock)
})

test('cross-process appends do not lose records or exceed cap', async () => {
  const moduleUrl = new URL('../src/learning-store.js', import.meta.url).href
  const options = { cwd, provider: 'actual/provider', model: 'actual/model', maxRecords: 12 }
  const code = `import {createLearningStore} from ${JSON.stringify(moduleUrl)}; const store=createLearningStore(JSON.parse(process.argv[1])); let successes=0; while(successes<4) {try {store.append({type:'learning',summary:'worker-'+process.pid+'-'+successes});successes++} catch(e) {if(!e.message.includes('busy')) throw e; await new Promise(r=>setTimeout(r,5));}}`
  await Promise.all(Array.from({ length: 3 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(options)], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', status => status === 0 ? resolve() : reject(new Error(`worker exited ${status}`)))
  })))
  const store = createLearningStore(options)
  assert.equal(store.list().length, 12)
  assert.equal(new Set(store.list().map(record => record.id)).size, 12)
  assert.throws(() => store.append(learning('over-cap')), /maxRecords/)
})
