import test from 'node:test'
import assert from 'node:assert/strict'

import { ASPECT_PRESETS, RESOLUTION_TIERS, imageStatus, resolveSize, safeName } from '../src/artwork.js'
import { DEFAULT_IMAGE_CONFIG, resolveImageConfig } from '../src/image-config.js'

test('aspect presets cover the ratios a console offers', () => {
  const keys = ASPECT_PRESETS.map((item) => item.key)
  for (const expected of ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9']) {
    assert.ok(keys.includes(expected), `缺少 ${expected}`)
  }
})

test('resolveSize keeps both edges on the 64 grid', () => {
  for (const aspect of ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']) {
    for (const tier of ['1k', '2k', '4k']) {
      const size = resolveSize({ aspect, tier })
      const [width, height] = size.split('x').map(Number)
      assert.equal(width % 64, 0, `${aspect}/${tier} 宽 ${width} 未对齐`)
      assert.equal(height % 64, 0, `${aspect}/${tier} 高 ${height} 未对齐`)
      assert.ok(width >= 64 && height >= 64, `${aspect}/${tier} 尺寸过小`)
    }
  }
})

test('resolveSize honours the requested long edge and orientation', () => {
  assert.equal(resolveSize({ aspect: '1:1', tier: '1k' }), '1024x1024')
  assert.equal(resolveSize({ aspect: '16:9', tier: '1k' }), '1024x576')
  assert.equal(resolveSize({ aspect: '9:16', tier: '1k' }), '576x1024')
  assert.equal(resolveSize({ aspect: '4:3', tier: '2k' }), '2048x1536')
  // 竖图的长边同样落在 2048 上
  assert.equal(resolveSize({ aspect: '3:4', tier: '2k' }), '1536x2048')
})

test('resolveSize falls back for auto and unknown values instead of guessing', () => {
  assert.equal(resolveSize({ aspect: '1:1', tier: 'auto', fallback: '1024x1024' }), '1024x1024')
  assert.equal(resolveSize({ aspect: 'nope', tier: '1k', fallback: '512x512' }), '512x512')
  assert.equal(resolveSize({ aspect: '1:1', tier: 'nope', fallback: '512x512' }), '512x512')
})

test('image config clamps the batch count and normalises transparent', () => {
  assert.equal(resolveImageConfig({ image: { count: 9 } }).count, 4)
  assert.equal(resolveImageConfig({ image: { count: 0 } }).count, 1)
  assert.equal(resolveImageConfig({ image: { count: 'abc' } }).count, 1)
  assert.equal(resolveImageConfig({ image: { transparent: true } }).transparent, true)
  assert.equal(resolveImageConfig({ image: { transparent: 'yes' } }).transparent, false)
})

test('image defaults carry composition fields so older configs keep working', () => {
  const resolved = resolveImageConfig({})
  assert.equal(resolved.aspect, '1:1')
  assert.equal(resolved.tier, '1k')
  assert.equal(resolved.count, 1)
  assert.equal(resolved.transparent, false)
  // 老配置只写了 size 时，auto 档必须回退到它
  assert.equal(DEFAULT_IMAGE_CONFIG.size, '1024x1024')
})

test('imageStatus reports the resolved size instead of the raw config value', () => {
  const status = imageStatus({ image: { enabled: true, baseURL: 'https://x/v1', model: 'm', aspect: '16:9', tier: '2k', count: 3, transparent: true } })
  assert.equal(status.size, '2048x1152')
  assert.equal(status.aspect, '16:9')
  assert.equal(status.count, 3)
  assert.equal(status.transparent, true)
  assert.equal(status.ready, true)
})

test('safeName keeps multi-image filenames distinct', () => {
  assert.equal(safeName('琳雅'), '琳雅')
  assert.notEqual(safeName('a b'), safeName('a/b'))
  assert.equal(safeName(''), 'art')
})
