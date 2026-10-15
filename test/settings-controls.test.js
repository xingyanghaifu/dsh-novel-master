import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const DEFAULT = {
  enabled: true, projectsDir: 'books', updateProxy: '',
  commands: { novel: true, continue: false, chapter: true, rewrite: true, idea: false, study: true, backup: true, learn: false, memory: true, decide: false, surprise: true, update: true },
  learning: { enabled: false, autoSummarize: true, reuse: true, storageDir: 'novel_learning', summaryProvider: '', summaryModel: '', maxInputChars: 12000, maxRecords: 500, cooldownSeconds: 60 },
  decision: { enabled: false, provider: '', model: '', reasoningEffort: '', minConfidence: 0.7, timeoutMs: 30000 },
}
function harness(options = {}) {
  const states = [], refs = [], calls = []
  let stateIndex = 0, refIndex = 0, plugin, page, document = { revision: 3, value: structuredClone(DEFAULT) }
  states[0] = document
  states[1] = { busy: options.serverBusy ?? false, reloadSupported: true }
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const i = stateIndex++
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }]
    },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial } },
    useEffect() {},
  }
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: bundle => { plugin = bundle.factory(() => React) } }, location: { reload() {} } },
    document: { baseURI: 'http://localhost:19387/' }, URL, AbortController, setTimeout, clearTimeout,
    fetch: async (url, request) => {
      const body = request.body ? JSON.parse(request.body) : undefined
      calls.push({ url, request, body })
      if (options.response) return options.response(url, request)
      if (url.endsWith('/settings') && request.method === 'GET') return { ok: true, json: async () => document }
      if (url.endsWith('/status') && !url.endsWith('/intelligence/status')) return { ok: true, json: async () => states[1] }
      if (url.endsWith('/intelligence/status')) {
        if (options.activityError) return { ok: false, json: async () => ({ error: options.activityError }) }
        return { ok: true, json: async () => ({ learningEnabled: true, decisionEnabled: false, storageDir: '/real/library', trackedSessions: 2, activeJobs: 1, recordsWrittenThisRun: 7, lastError: 'summary service unavailable' }) }
      }
      if (body?.patch) {
        if (options.hold) await options.hold
        assert.equal(body.revision, document.revision)
        const value = structuredClone(document.value)
        for (const [key, patch] of Object.entries(body.patch)) {
          value[key] = typeof patch === 'object' ? { ...value[key], ...patch } : patch
        }
        document = { revision: document.revision + 1, value }
      }
      return { ok: true, json: async () => document }
    },
  })
  plugin.apply({ slots: { inject: (_, mount) => mount(), register: (meta, render) => { assert.equal(meta.id, 'novel-master'); assert.equal(meta.order, 36); page = render({}).type } } })
  const render = () => { stateIndex = 0; refIndex = 0; return page() }
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : !node || typeof node !== 'object' ? [] : [node, ...node.children.flatMap(flatten)]
  const nodes = () => flatten(render())
  const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? node.type === 'style' ? '' : node.children.map(text).join('') : node === false || node == null ? '' : String(node)
  const find = (type, label) => { const node = nodes().find(n => n.type === type && (n.props['aria-label'] === label || text(n) === label)); assert.ok(node, `${type}: ${label}`); return node }
  const click = label => find('button', label).props.onClick()
  const edit = (label, value) => { const input = find('input', label); return input.props.onChange({ target: { value, checked: value } }) }
  const submit = label => find('form', label).props.onSubmit({ preventDefault() {} })
  return { render, nodes, text, find, click, edit, submit, calls }
}

test('tabs mount every panel but expose only the selected accessible panel', async () => {
  const h = harness()
  const panels = () => h.nodes().filter(node => node.props.role === 'tabpanel')
  assert.equal(panels().length, 4)
  assert.deepEqual(panels().filter(node => !node.props.hidden).map(node => node.props.id), ['nm-panel-features'])
  await h.click('学习总结')
  assert.deepEqual(panels().filter(node => !node.props.hidden).map(node => node.props.id), ['nm-panel-learning'])
  assert.equal(h.find('button', '学习总结').props['aria-selected'], true)
  assert.equal(h.find('input', '学习存储目录').props.value, 'novel_learning')
  let prevented = false
  h.find('button', '学习总结').props.onKeyDown({ key: 'ArrowRight', preventDefault() { prevented = true }, currentTarget: {} })
  assert.equal(prevented, true)
  assert.equal(h.find('button', '决策助手').props['aria-selected'], true)
})

test('search filters features without altering choices and presets save only actual keys once', async () => {
  const h = harness()
  h.edit('搜索功能', 'novel-backup')
  assert.equal(h.nodes().filter(node => node.type === 'fieldset').length, 1)
  assert.equal(h.find('input', '备份').props.role, 'switch')
  assert.equal(h.calls.length, 0)
  h.edit('搜索功能', 'does-not-exist')
  assert.match(h.text(h.render()), /没有找到匹配功能/)
  assert.equal(h.nodes().filter(node => node.type === 'fieldset').length, 0)
  h.edit('搜索功能', '')
  await h.click('基础工具')
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].body.patch.commands.novel, true)
  assert.equal(h.calls[0].body.patch.commands.study, false)
  assert.equal(h.calls[0].body.patch.commands.update, undefined)
  assert.equal(h.calls[0].body.patch.commands.outline, undefined)
})

test('dirty indicators reflect actual unsaved differences and clear after successful save', async () => {
  const h = harness()
  assert.doesNotMatch(h.text(h.render()), /有未保存的修改/)
  h.edit('学习存储目录', 'new-library')
  assert.match(h.text(h.render()), /有未保存的修改/)
  h.edit('学习存储目录', 'novel_learning')
  assert.doesNotMatch(h.text(h.render()), /有未保存的修改/)
  h.edit('学习存储目录', 'new-library')
  await h.submit('学习配置')
  assert.doesNotMatch(h.text(h.render()), /有未保存的修改/)
})

test('HTML HTTP failures show actionable backend diagnostics without parser messages', async () => {
  const h = harness({ response: async () => ({ ok: false, status: 404, text: async () => '<html>not found</html>' }) })
  await h.click('检查更新')
  const text = h.text(h.render())
  assert.match(text, /check · HTTP 404/)
  assert.match(text, /插件后端尚未就绪，请重启 DSH/)
  assert.doesNotMatch(text, /Unexpected token|JSON\.parse/)
  assert.ok(h.find('button', '重试连接'))
})

test('successful settings remain available when independent update status fails', async () => {
  const h = harness({ response: async url => url.endsWith('/settings') ? { ok: true, json: async () => ({ revision: 9, value: structuredClone(DEFAULT) }) } : { ok: false, status: 503, text: async () => 'service unavailable' } })
  await h.click('刷新设置与状态')
  assert.equal(h.find('input', '一键完本').props.checked, true)
  assert.match(h.text(h.render()), /status · HTTP 503/)
  assert.doesNotMatch(h.text(h.render()), /配置服务尚未连接/)
})

test('theme styles are scoped with keyboard and reduced motion support', () => {
  const h = harness()
  const tree = h.render()
  assert.equal(tree.props.className, 'nm-settings')
  const css = h.nodes().find(node => node.type === 'style').children.join('')
  assert.match(css, /--dsw-alias-label-primary/)
  assert.match(css, /\.nm-settings \[hidden\]/)
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion/)
  assert.doesNotMatch(css, /(?:^|\})\s*(?:body|html|input|button)\s*\{/)
})

test('all/group controls change only actual creative keys, use revisions, and show counts', async () => {
  const h = harness()
  assert.match(h.text(h.render()), /已选择 7 \/ 11 项/)
  assert.match(h.text(h.render()), /写作 · 3 \/ 4/)
  assert.match(h.text(h.render()), /其他 · 1 \/ 1/)
  await h.click('写作全关')
  assert.deepEqual(h.calls[0].body, { revision: 3, patch: { commands: { novel: false, continue: false, chapter: false, rewrite: false } } })
  assert.match(h.text(h.render()), /写作 · 0 \/ 4/)
  await h.click('全部开启')
  assert.equal(h.calls[1].body.revision, 4)
  assert.equal(Object.keys(h.calls[1].body.patch.commands).length, 11)
  assert.equal(h.calls[1].body.patch.commands.update, undefined)
  assert.equal(h.calls[1].body.patch.commands.surprise, true)
  await h.click('全部关闭')
  assert.ok(Object.values(h.calls[2].body.patch.commands).every(value => value === false))
  assert.match(h.text(h.render()), /已选择 0 \/ 11 项/)
  await h.edit('学习记录', true)
  assert.deepEqual(h.calls[3].body, { revision: 6, patch: { commands: { learn: true } } })
})

test('every group batches exactly its present keys including dynamic Other', async () => {
  const h = harness()
  const groups = [
    ['写作', ['novel', 'continue', 'chapter', 'rewrite']],
    ['规划', ['idea']], ['分析', ['study']], ['管理', ['backup']],
    ['学习与决策', ['learn', 'memory', 'decide']], ['其他', ['surprise']],
  ]
  for (const [label, keys] of groups) {
    await h.click(`${label}全开`)
    assert.deepEqual(h.calls.at(-1).body.patch, { commands: Object.fromEntries(keys.map(key => [key, true])) })
    await h.click(`${label}全关`)
    assert.deepEqual(h.calls.at(-1).body.patch, { commands: Object.fromEntries(keys.map(key => [key, false])) })
  }
})

test('learning drafts survive unrelated command saves and submit explicit nested fields', async () => {
  const h = harness()
  h.edit('学习存储目录', 'D:/Library/my novels')
  h.edit('摘要生成提供方', 'summary-provider')
  h.edit('摘要生成模型', 'summary-model')
  h.edit('学习输入字符上限', '4321')
  h.edit('学习记录上限', '100')
  h.edit('学习冷却秒数', '0')
  h.edit('启用学习', true)
  await h.click('分析全关')
  assert.equal(h.find('input', '学习存储目录').props.value, 'D:/Library/my novels')
  assert.equal(h.find('input', '摘要生成模型').props.value, 'summary-model')
  await h.submit('学习配置')
  const request = h.calls.at(-1).body
  assert.equal(request.revision, 4)
  assert.deepEqual(Object.keys(request.patch), ['learning'])
  assert.deepEqual(request.patch.learning, { ...DEFAULT.learning, enabled: true, storageDir: 'D:/Library/my novels', summaryProvider: 'summary-provider', summaryModel: 'summary-model', maxInputChars: 4321, maxRecords: 100, cooldownSeconds: 0 })
  h.edit('摘要生成模型', '')
  await h.submit('学习配置')
  assert.equal(h.calls.length, 2)
  assert.match(h.text(h.render()), /必须同时填写/)
})

test('decision route is explicit and saves rationale policy parameters independently', async () => {
  const h = harness()
  h.edit('启用辅助决策', true)
  await h.submit('决策配置')
  assert.equal(h.calls.length, 0)
  assert.match(h.text(h.render()), /必须成对填写/)
  h.edit('决策提供方', 'choice-provider')
  h.edit('决策模型', 'choice-model')
  h.edit('决策推理强度', 'high')
  h.edit('最低决策置信度', '0.85')
  h.edit('决策超时毫秒', '45000')
  await h.click('规划全开')
  assert.equal(h.find('input', '决策模型').props.value, 'choice-model')
  await h.submit('决策配置')
  assert.deepEqual(h.calls.at(-1).body.patch, { decision: { enabled: true, provider: 'choice-provider', model: 'choice-model', reasoningEffort: 'high', minConfidence: 0.85, timeoutMs: 45000 } })
  assert.match(h.text(h.render()), /永不授权删除或恢复/)
  h.edit('最低决策置信度', '1.5')
  await h.submit('决策配置')
  assert.equal(h.calls.length, 2)
  assert.match(h.text(h.render()), /0 到 1/)
})

test('batch and field saves respect backend busy and in-flight saves', async () => {
  const locked = harness({ serverBusy: true })
  assert.equal(locked.find('button', '全部开启').props.disabled, true)
  await locked.click('全部开启')
  assert.equal(locked.calls.length, 0)
  let release
  const h = harness({ hold: new Promise(resolve => { release = resolve }) })
  const pending = h.click('全部关闭')
  await h.click('写作全开')
  assert.equal(h.calls.length, 1)
  assert.equal(h.find('input', '学习存储目录').props.disabled, true)
  release(); await pending
  assert.equal(h.find('button', '全部开启').props.disabled, false)
})

test('activity is read only on demand and renders actual backend status and errors', async () => {
  const h = harness()
  h.render()
  assert.equal(h.calls.length, 0)
  await h.click('读取学习与决策活动')
  assert.equal(h.calls[0].url, '/api/novel-master/intelligence/status')
  assert.equal(h.calls[0].request.method, 'GET')
  assert.match(h.text(h.render()), /配置存储地址：\/real\/library/)
  assert.match(h.text(h.render()), /跟踪会话：2；活动任务：1；本次运行写入：7/)
  assert.match(h.text(h.render()), /summary service unavailable/)
  const unavailable = harness({ activityError: 'not-found' })
  await unavailable.click('读取学习与决策活动')
  assert.match(unavailable.text(unavailable.render()), /读取活动失败：intelligence\/status · HTTP 未知：not-found/)
})
