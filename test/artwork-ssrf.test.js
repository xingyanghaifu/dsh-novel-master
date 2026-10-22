import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { callImageApi } from '../src/artwork.js'

/**
 * 生图接口返回的 URL 会被插件直接 fetch。
 *
 * 那个 URL 来自服务端响应，不是用户输入。配置了恶意或错乱的中转站时，它能让
 * 插件去访问内网地址（SSRF），然后把结果当图片存进项目目录。这里只放行公网
 * http/https，其余一律拒绝。
 */

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

/** 装一个只会记录调用、并返回指定图片 URL 的假 fetch。 */
function stubFetch(imageUrl) {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    // 第一次是调用生图接口本身，第二次是下载图片
    if (calls.length === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ url: imageUrl }] }),
        headers: { get: () => 'application/json' },
      }
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      headers: { get: () => 'image/png' },
    }
  }
  return calls
}

const entry = { baseURL: 'https://api.example.com/v1', model: 'img-1', apiKey: 'k' }

const blocked = [
  'http://127.0.0.1/secret.png',
  'http://localhost/x.png',
  'http://169.254.169.254/latest/meta-data/',
  'http://10.0.0.5/a.png',
  'http://192.168.1.1/a.png',
  'http://172.16.0.1/a.png',
  'http://[::1]/a.png',
  'file:///C:/Windows/win.ini',
  'ftp://example.com/a.png',
]

for (const url of blocked) {
  test(`拒绝内网与非 http 的图片地址：${url}`, async () => {
    const calls = stubFetch(url)
    await assert.rejects(callImageApi(entry, '画一只猫'))
    // 只有生图请求本身发出去了，内网地址一次都没碰
    assert.equal(calls.length, 1)
    assert.ok(calls[0].includes('api.example.com'))
  })
}

test('公网 https 图片地址正常下载', async () => {
  const calls = stubFetch('https://cdn.example.com/pic.png')
  const result = await callImageApi(entry, '画一只猫')
  assert.equal(calls.length, 2)
  assert.ok(calls[1].includes('cdn.example.com'))
  assert.equal(result.images?.[0]?.bytes ?? 3, 3)
})
