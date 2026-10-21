import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, Config } from '../src/index.js'

/**
 * 每个命令都要能接收附件。
 *
 * 以前 attachments 只在少数命令上声明。把文件拖到 /novel-review 上，输入框
 * 会因为命令不接受附件而把它丢掉——用户看到的是「文件没了」，不是报错。
 *
 * 断言必须走 apply()：attachments 是在 guarded() 里统一补上的，而
 * definitions() 返回的是包装前的原始定义。
 */

const registered = new Map()
const ctx = {
  commands: { register: (def) => { registered.set(def.name, def); return { dispose() {} } } },
  get: () => undefined,
  on: () => ({ dispose() {} }),
}
await apply(ctx, Config['~standard'].validate({}).value, { logger: { info() {}, warn() {}, error() {} } })

test('每个创作命令都声明接受附件', () => {
  // novel-update 是插件自更新，不处理项目内容，也就不该收附件。
  const missing = [...registered.values()]
    .filter(cmd => cmd.name !== 'novel-update')
    .filter(cmd => cmd.input?.attachments !== true)
    .map(cmd => cmd.name)
  assert.deepEqual(missing, [], `这些命令还不接受附件：${missing.join(', ')}`)
})

test('声明附件不会丢掉原有的 input 提示', () => {
  const study = registered.get('novel-study')
  assert.equal(study.input.attachments, true)
  // 原有的 hint 必须还在，否则用户看不到参数说明
  assert.match(study.input.hint, /参考文件/u)
})

test('原本没有 input 的命令也不会变成 undefined', () => {
  const bare = [...registered.values()].filter(cmd => cmd.input === undefined)
  assert.deepEqual(bare.map(cmd => cmd.name), [])
})
