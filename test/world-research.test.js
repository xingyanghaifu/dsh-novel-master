import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { researchPlan, researchQueryFor, enrichRegions } from '../src/world-model.js'
import { worldCommand } from '../src/cmd-tools.js'

const SOURCE = fs.readFileSync(new URL('../src/cmd-tools.js', import.meta.url), 'utf8')

function makeProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-worldref-'))
  const dir = path.join(tmp, 'novel_projects', '测试世界')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '世界状态.md'), [
    '## 地理',
    '',
    '- **赤道冰原**（中·雪原）：终年冰封，没人说得清为什么',
    '- **孤城**（西南·城邦）：一座要塞',
    '',
    '## 当前势力态势',
    '',
    '- 无',
    '',
  ].join('\n'), 'utf8')
  return tmp
}

test('每条问题都能变成一句该搜的话', () => {
  const plan = researchPlan([
    { severity: 'high', region: '孤城', kind: 'city-without-water', research: '古代城市 选址 水源' },
    { severity: 'medium', region: '赤道冰原', kind: 'snow-too-warm', research: '赤道 高山 冰川 成因' },
  ])
  assert.equal(plan.length, 2)
  assert.ok(plan[0].query.includes('古代城市'), '应保留原检索词')
  assert.ok(plan.every((item) => item.query.length > 0))
})

test('检索词不重复堆词', () => {
  // 拼出「选址 水源 选址原则」这种明显是机器凑的东西，搜出来也没用
  const query = researchQueryFor({ kind: 'city-without-water', research: '古代城市 选址 水源' })
  const words = query.split(/\s+/u)
  assert.equal(new Set(words).size, words.length, `检索词有重复：${query}`)
})

test('low 级问题不浪费检索', () => {
  const plan = researchPlan([
    { severity: 'low', region: '某地', kind: 'volcano-town', research: '火山 聚落' },
  ])
  assert.equal(plan.length, 0, 'low 级问题不该触发联网检索')
})

test('同一个问题不重复查', () => {
  const plan = researchPlan([
    { severity: 'high', region: '孤城', kind: 'city-without-water', research: '古代城市 选址 水源' },
    { severity: 'high', region: '孤城', kind: 'city-without-water', research: '古代城市 选址 水源' },
  ])
  assert.equal(plan.length, 1)
})

test('「参照」走联网检索，不走进世界推演', () => {
  // 两个分支混了的话，作者想查资料，结果触发一次世界推进，会改写他的设定
  assert.ok(SOURCE.includes("/^参照/u.test(t.note)"), '应识别「参照」子命令')
  assert.ok(SOURCE.includes('worldResearch(ctx, researchConfig'), '应把检索配置传进去')
})

test('检索失败不崩，还给得出检索词', async () => {
  // 没配模型路由、断网、超时都是常态。抛栈的话作者连该搜什么都看不到。
  const tmp = makeProject()
  const ctx = {
    get: (key) => (key === 'web' ? {
      search: async () => ({ sources: [{ url: 'https://example.com/a', title: 'a' }] }),
      fetch: async () => ({ statusCode: 200, body: '正文' }),
    } : null),
  }
  const cmd = worldCommand(ctx, { enabled: true, provider: 'p', model: 'm' })
  const res = await cmd.handler({ rawInput: '测试世界 参照', cwd: tmp })
  // 环境没有 llm 服务，一定失败 —— 但必须是「错误提示」，不是异常
  assert.equal(res.kind, 'error')
  assert.ok(res.text.includes('参照检索失败'))
  assert.ok(/可以先自己搜/u.test(res.text), '失败时要给出可用的检索词')
  fs.rmSync(tmp, { recursive: true, force: true })
})

test('没配检索时明确说清楚怎么开', async () => {
  const tmp = makeProject()
  const cmd = worldCommand({ get: () => null }, undefined)
  const res = await cmd.handler({ rawInput: '测试世界 参照', cwd: tmp })
  assert.equal(res.kind, 'error')
  assert.ok(/联网检索|检索配置/u.test(res.text), `提示应说明缺什么，实际：${res.text}`)
  fs.rmSync(tmp, { recursive: true, force: true })
})

test('没地理的项目不该去查资料', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-empty-'))
  fs.mkdirSync(path.join(tmp, 'novel_projects', '空项目'), { recursive: true })
  const cmd = worldCommand({ get: () => null }, { enabled: true })
  const res = await cmd.handler({ rawInput: '空项目 参照', cwd: tmp })
  assert.equal(res.kind, 'error')
  assert.ok(/地理/u.test(res.text), '应提示先写地理')
  fs.rmSync(tmp, { recursive: true, force: true })
})

test('世界讲得通时不做无谓检索', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-coherent-'))
  const dir = path.join(tmp, 'novel_projects', '好世界')
  fs.mkdirSync(dir, { recursive: true })
  // 港城要真的挨着水：九宫格里相邻格距离 0.32，
  // 西北到西是斜对角 0.45，那是「隔了一格」，不是邻居。
  fs.writeFileSync(path.join(dir, '世界状态.md'), [
    '## 地理',
    '',
    '- **内海**（西·水域）：内陆海',
    '- **港城**（中·城邦）：靠海吃海',
    '',
  ].join('\n'), 'utf8')
  let searched = 0
  const ctx = { get: (key) => (key === 'web' ? { search: async () => { searched++; return { sources: [] } } } : null) }
  const cmd = worldCommand(ctx, { enabled: true, provider: 'p', model: 'm' })
  const res = await cmd.handler({ rawInput: '好世界 参照', cwd: tmp })
  // 成功返回的 kind 是 success（不是 ok）—— ok() 生成的是 {kind:'success'}
  assert.equal(res.kind, 'success')
  assert.equal(searched, 0, '没问题就不该联网')
  fs.rmSync(tmp, { recursive: true, force: true })
})

test('检索结论会写进项目，而不是留在对话里', () => {
  // 隔天打开项目还在，才叫资料；只在聊天里出现过一次的叫聊天记录
  assert.ok(SOURCE.includes('## 地理参照'), '应写入固定的章节名')
  assert.ok(SOURCE.includes("replace(/\\n## 地理参照"), '重复检索应替换旧内容而不是叠加')
  assert.ok(SOURCE.includes('writeProjectFile(cwd, project'), '应真的写文件')
})
