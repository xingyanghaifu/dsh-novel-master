import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  DEFAULT_IMAGE_CONFIG,
  DEFAULT_LLM_CONFIG,
  chatEndpoint,
  configStatus,
  imageEndpoint,
  modelsEndpoint,
  resolveImageConfig,
  resolveLlmConfig,
} from '../src/image-config.js'
import { bindAsset, listAssets, assetOf, unbindAsset, readLedger } from '../src/assets.js'

/** 建一个一次性的项目目录，插图/ 预先建好以模拟已生成图片。 */
function tempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-assets-'))
  fs.mkdirSync(path.join(dir, '插图'), { recursive: true })
  fs.writeFileSync(path.join(dir, '插图', 'cast-琳雅-x.png'), Buffer.from([0x89, 0x50]))
  return dir
}

test('endpoints append the right OpenAI paths exactly once', () => {
  assert.equal(chatEndpoint('https://api.example.com/v1'), 'https://api.example.com/v1/chat/completions')
  assert.equal(imageEndpoint('https://api.example.com/v1'), 'https://api.example.com/v1/images/generations')
  assert.equal(modelsEndpoint('https://api.example.com/v1'), 'https://api.example.com/v1/models')
  // 尾斜杠不会产生双斜杠
  assert.equal(imageEndpoint('https://api.example.com/v1/'), 'https://api.example.com/v1/images/generations')
})

test('config resolution merges overrides and keeps defaults for blanks', () => {
  const llm = resolveLlmConfig({ llm: { baseURL: 'https://a.example/v1/', model: 'gpt-4o', apiKey: 'k' } })
  assert.equal(llm.baseURL, 'https://a.example/v1', 'trailing slash trimmed')
  assert.equal(llm.model, 'gpt-4o')
  assert.equal(llm.apiKey, 'k')
  assert.equal(llm.temperature, DEFAULT_LLM_CONFIG.temperature, 'unset field keeps default')

  // 空字符串视为未设置，不覆盖默认
  const image = resolveImageConfig({ image: { baseURL: '', size: '' } })
  assert.equal(image.size, DEFAULT_IMAGE_CONFIG.size)
  assert.equal(image.baseURL, '')
})

test('configStatus reports exactly the missing required fields', () => {
  const none = configStatus({})
  assert.deepEqual(none.llm.missing, ['baseURL', 'apiKey', 'model'])
  assert.equal(none.llm.ready, false)
  assert.deepEqual(none.image.missing, ['baseURL', 'apiKey', 'model'])

  const full = configStatus({
    llm: { baseURL: 'https://a/v1', apiKey: 'k', model: 'm' },
    image: { baseURL: 'https://b/v1', apiKey: 'k2', model: 'img' },
  })
  assert.deepEqual(full.llm.missing, [])
  assert.equal(full.llm.ready, true)
  assert.equal(full.image.ready, true)
  // 状态快照绝不回传密钥本身
  assert.equal(full.llm.apiKey, undefined)
  assert.equal(full.image.apiKey, undefined)
})

test('binding records the asset and replaces the same target', () => {
  const dir = tempProject()
  try {
    const first = bindAsset({
      projectDir: dir, kind: 'character', name: '琳雅',
      file: '插图/cast-琳雅-x.png', prompt: 'a portrait', model: 'gpt-image-1',
    })
    assert.equal(first.total, 1)
    assert.equal(first.asset.kind, 'character')
    assert.equal(first.asset.name, '琳雅')

    // 同类型同名再次绑定：替换而不是追加
    const second = bindAsset({
      projectDir: dir, kind: 'character', name: '琳雅',
      file: '插图/cast-琳雅-x.png', prompt: 'a better portrait',
    })
    assert.equal(second.total, 1, 'same target replaces the old row')
    const listed = listAssets({ projectDir: dir })
    assert.equal(listed.assets.length, 1)
    assert.equal(listed.assets[0].prompt, 'a better portrait')

    // 不同类型同名互不干扰
    bindAsset({ projectDir: dir, kind: 'region', name: '琳雅', file: '插图/cast-琳雅-x.png' })
    assert.equal(listAssets({ projectDir: dir }).total, 2)
    assert.equal(listAssets({ projectDir: dir, kind: 'region' }).total, 1)
    assert.equal(assetOf({ projectDir: dir, kind: 'character', name: '琳雅' })?.kind, 'character')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('binding rejects unknown kinds, blank names, traversal paths and missing files', () => {
  const dir = tempProject()
  try {
    const base = { projectDir: dir, name: '琳雅', file: '插图/cast-琳雅-x.png' }
    assert.throws(() => bindAsset({ ...base, kind: 'weapon' }), /未知资产类型/u)
    assert.throws(() => bindAsset({ ...base, kind: 'character', name: '  ' }), /请填写/u)
    assert.throws(() => bindAsset({ ...base, kind: 'character', file: '../secret.png' }), /路径不合法/u)
    assert.throws(() => bindAsset({ ...base, kind: 'character', file: '插图/absent.png' }), /图片文件不存在/u)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('unbinding removes only the named target and keeps the image file', () => {
  const dir = tempProject()
  try {
    bindAsset({ projectDir: dir, kind: 'character', name: '琳雅', file: '插图/cast-琳雅-x.png' })
    bindAsset({ projectDir: dir, kind: 'character', name: '凯尔', file: '插图/cast-琳雅-x.png' })
    const result = unbindAsset({ projectDir: dir, kind: 'character', name: '琳雅' })
    assert.equal(result.removed, 1)
    assert.equal(readLedger(dir).assets.length, 1)
    assert.equal(readLedger(dir).assets[0].name, '凯尔')
    // 解绑不删图片本身
    assert.ok(fs.existsSync(path.join(dir, '插图', 'cast-琳雅-x.png')))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('a missing or corrupt ledger degrades to an empty list', () => {
  const dir = tempProject()
  try {
    assert.deepEqual(readLedger(dir).assets, [])
    fs.writeFileSync(path.join(dir, '插图', '资产.json'), '{ not json', 'utf8')
    assert.deepEqual(readLedger(dir).assets, [], 'corrupt ledger must not throw')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('map is a bindable asset kind so the atlas can use it as a base image', () => {
  const dir = tempProject()
  try {
    const bound = bindAsset({ projectDir: dir, kind: 'map', name: '全域图', file: '插图/cast-琳雅-x.png' })
    assert.equal(bound.asset.kind, 'map')
    const found = assetOf({ projectDir: dir, kind: 'map', name: '全域图' })
    assert.equal(found.file, '插图/cast-琳雅-x.png')
    assert.equal(listAssets({ projectDir: dir, kind: 'map' }).assets.length, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
