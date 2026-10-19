/**
 * 模型发现与工作目录回退的可观测性测试。
 *
 * 这两个功能都不产生返回值给用户看，只产生诊断信息，所以这里验证的是
 * 「失败会被记录」而不是「失败被吞掉」。它们的原始 bug 形态就是空 catch。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { discoverHostModels } from '../src/models-discovery.js'
import { agentCwd } from '../src/context.js'

/** 会抛错的 llm 服务，模拟 API 变更或权限问题。 */
function brokenLlm() {
  return {
    listProviders: () => { throw new Error('provider 列表接口炸了') },
  }
}

test('llm 服务报错时被记录而不是静默吞掉', async () => {
  const failures = []
  const warnings = []
  const ctx = {
    get: name => (name === 'llm' ? brokenLlm() : undefined),
    logger: () => ({ warn: line => warnings.push(line) }),
  }
  const result = await discoverHostModels(ctx, failures)
  assert.ok(Array.isArray(result.models))
  assert.equal(failures.length, 1, '应记录一次失败')
  assert.equal(failures[0].source, 'llm 服务')
  assert.match(failures[0].message, /炸了/u)
  assert.equal(warnings.length, 1, '应输出一条 warning')
  assert.match(warnings[0], /models-discovery/u)
})

test('没有服务时不记录失败（文件回退成功或确实没有配置都算正常）', async () => {
  const failures = []
  const result = await discoverHostModels({ get: () => undefined }, failures)
  // 缺服务不是错误：桌面端可能确实没装 llm 服务，不该天天报错。
  // 这里不断言 models 为空——没有 llm 服务时仍会读 ~/.dsh 的配置文件，
  // 那种回退是设计内的行为，不该被当成失败记录。
  assert.ok(Array.isArray(result.models))
  assert.equal(failures.length, 0)
})

test('settings 服务报错时也记录，且不影响后续步骤', async () => {
  const failures = []
  const warnings = []
  const ctx = {
    get: name => {
      if (name === 'settings') return { get: () => { throw new Error('settings 坏了') } }
      return undefined
    },
    logger: () => ({ warn: line => warnings.push(line) }),
  }
  await discoverHostModels(ctx, failures)
  assert.equal(failures.length, 1)
  assert.equal(failures[0].source, 'settings 服务')
})

test('logger 本身抛错也不会中断发现流程', async () => {
  const failures = []
  const ctx = {
    get: name => (name === 'llm' ? brokenLlm() : undefined),
    logger: () => ({ warn: () => { throw new Error('logger 也炸了') } }),
  }
  const result = await discoverHostModels(ctx, failures)
  assert.ok(Array.isArray(result.models), '记录失败不能反过来让调用方崩掉')
  assert.equal(failures.length, 1)
})

test('没有 logger 时保持安静但不丢记录', async () => {
  const failures = []
  const result = await discoverHostModels({ get: name => (name === 'llm' ? brokenLlm() : undefined) }, failures)
  assert.ok(Array.isArray(result.models))
  assert.equal(failures.length, 1, '无 logger 也要把失败交给调用方')
})

test('agentCwd 优先使用显式 cwd', () => {
  assert.equal(agentCwd({ cwd: '/tmp/workspace' }), '/tmp/workspace')
})

test('agentCwd 依次读取宿主暴露的会话目录', () => {
  assert.equal(agentCwd({ agent: { session: { header: { cwd: '/a' } } } }), '/a')
  assert.equal(agentCwd({ agent: { session: { cwd: '/b' } } }), '/b')
})

test('agentCwd 回退到进程目录时会输出警告', () => {
  const warnings = []
  const original = console.warn
  console.warn = line => warnings.push(line)
  try {
    const cwd = agentCwd({ agent: { id: 'no-session-info' } })
    assert.equal(cwd, process.cwd())
    assert.equal(warnings.length, 1, '回退到进程目录必须留下痕迹')
    assert.match(warnings[0], /进程目录/u)
    assert.match(warnings[0], /绝对路径/u, '警告应给出解决办法')
  } finally {
    console.warn = original
  }
})

test('agentCwd 正常取到宿主目录时保持安静', () => {
  const warnings = []
  const original = console.warn
  console.warn = line => warnings.push(line)
  try {
    agentCwd({ agent: { session: { header: { cwd: '/real/workspace' } } } })
    assert.equal(warnings.length, 0, '正常情况下不该打扰用户')
  } finally {
    console.warn = original
  }
})
