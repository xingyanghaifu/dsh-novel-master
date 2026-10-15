/* Hand-written DSH ModuleLoader client, following the installed Our Free Model
 * entry pattern. Uses the shell's React; no JSX, bundler, or extra dependency. */
window.__ModuleLoader__.load({
  id: 'dsh-novel-master',
  factory: require => {
    const React = require('react')
    const { createElement: h, useState, useEffect, useRef } = React
    const API = new URL('api/novel-master/', document.baseURI).pathname
    const CSS = `
.nm-settings{--nm-bg:var(--dsw-alias-bg-layer-1,Canvas);--nm-card:var(--dsw-alias-bg-layer-2,Canvas);--nm-raised:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-3,Canvas));--nm-text:var(--dsw-alias-label-primary,CanvasText);--nm-muted:var(--dsw-alias-label-secondary,GrayText);--nm-border:var(--dsw-alias-border-l2,color-mix(in srgb,CanvasText 15%,transparent));--nm-accent:var(--dsw-alias-brand-primary,var(--dsw-alias-state-business-primary,#5275d8));--nm-good:var(--dsw-alias-state-success-primary,#25836b);--nm-error:var(--dsw-alias-state-error-primary,#c84d55);max-width:1120px;margin:0 auto;padding:24px;color:var(--nm-text);font-size:13px;line-height:1.6;display:flex;flex-direction:column;gap:20px}
.nm-settings *{box-sizing:border-box}.nm-settings [hidden]{display:none!important}.nm-settings h2,.nm-settings h3,.nm-settings h4,.nm-settings p{margin:0}.nm-settings h2{font-size:26px;font-weight:750;letter-spacing:-.7px}.nm-settings h3{font-size:17px;font-weight:700}.nm-settings h4{font-size:14px;font-weight:650}.nm-settings .nm-muted{color:var(--nm-muted);font-size:12px}.nm-settings .nm-hero{padding:26px;border-radius:22px;border:1px solid var(--nm-border);background:radial-gradient(ellipse at 95% 0%,color-mix(in srgb,var(--nm-accent) 13%,transparent),transparent 65%),linear-gradient(145deg,var(--nm-raised),var(--nm-card));display:flex;flex-direction:column;gap:20px}.nm-settings .nm-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.nm-settings .nm-between{justify-content:space-between}.nm-settings .nm-brand{display:flex;align-items:center;gap:15px}.nm-settings .nm-logo{width:52px;height:52px;display:grid;place-items:center;border-radius:16px;color:var(--nm-accent);background:color-mix(in srgb,var(--nm-accent) 12%,var(--nm-card));border:1px solid color-mix(in srgb,var(--nm-accent) 25%,transparent)}.nm-settings .nm-logo svg{width:28px;height:28px}.nm-settings .nm-badge,.nm-settings .nm-chip{font-size:11px;border:1px solid var(--nm-border);border-radius:999px;padding:4px 10px;display:inline-flex;align-items:center;gap:7px;background:var(--nm-card);color:var(--nm-muted)}.nm-settings .nm-badge{color:var(--nm-accent);font-weight:650}.nm-settings .nm-chip i{width:6px;height:6px;border-radius:50%;background:var(--nm-muted)}.nm-settings .nm-chip[data-on=true] i{background:var(--nm-good)}.nm-settings .nm-tabs{display:flex;gap:5px;padding:5px;border:1px solid var(--nm-border);background:var(--nm-bg);border-radius:14px;overflow:auto}.nm-settings .nm-tabs button{flex:1;white-space:nowrap;border:0;background:transparent;border-radius:10px;color:var(--nm-muted);padding:10px 16px}.nm-settings .nm-tabs button[aria-selected=true]{background:var(--nm-raised);color:var(--nm-accent);box-shadow:0 2px 7px color-mix(in srgb,CanvasText 7%,transparent);font-weight:650}.nm-settings button{font:inherit;cursor:pointer;color:var(--nm-text);border:1px solid var(--nm-border);border-radius:9px;background:var(--nm-raised);padding:7px 12px;transition:background .15s,border-color .15s,box-shadow .15s}.nm-settings button:hover:not(:disabled){border-color:var(--nm-accent);background:color-mix(in srgb,var(--nm-accent) 6%,var(--nm-raised))}.nm-settings button:focus-visible,.nm-settings input:focus-visible,.nm-settings summary:focus-visible{outline:2px solid var(--nm-accent);outline-offset:3px}.nm-settings button:disabled{opacity:.45;cursor:not-allowed}.nm-settings .nm-primary{background:color-mix(in srgb,var(--nm-accent) 14%,var(--nm-card));border-color:color-mix(in srgb,var(--nm-accent) 55%,var(--nm-border));color:var(--nm-accent);font-weight:650}.nm-settings .nm-quiet{background:transparent;border-color:transparent;color:var(--nm-muted);font-size:12px}.nm-settings .nm-stack{display:flex;flex-direction:column;gap:18px}.nm-settings .nm-card{padding:22px;border:1px solid var(--nm-border);border-radius:17px;background:var(--nm-card);display:flex;flex-direction:column;gap:18px;min-width:0}.nm-settings .nm-cardhead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.nm-settings .nm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.nm-settings .nm-wide{grid-column:1/-1}.nm-settings .nm-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.nm-settings .nm-search{flex:1;min-width:200px}.nm-settings input:not([type=checkbox]){font:inherit;color:var(--nm-text);width:100%;min-width:0;border:1px solid var(--nm-border);border-radius:10px;background:var(--nm-bg);padding:10px 12px;transition:border-color .15s}.nm-settings input:not([type=checkbox]):focus{border-color:var(--nm-accent)}.nm-settings input:disabled{opacity:.55}.nm-settings .nm-field{display:flex;flex-direction:column;gap:7px;min-width:0}.nm-settings .nm-field>span{font-weight:550;font-size:12px;color:var(--nm-muted)}.nm-settings .nm-switch{display:flex;align-items:center;justify-content:space-between;gap:16px;position:relative;cursor:pointer;min-height:42px}.nm-settings .nm-switch input{position:absolute;right:0;top:50%;transform:translateY(-50%);width:38px;height:22px;opacity:0;margin:0;cursor:pointer}.nm-settings .nm-switch input:focus-visible + .nm-track{outline:2px solid var(--nm-accent);outline-offset:4px}.nm-settings .nm-track{width:38px;height:22px;border-radius:99px;border:1px solid var(--nm-border);background:var(--nm-bg);position:relative;flex:none;pointer-events:none;transition:background .18s}.nm-settings .nm-track:after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--nm-muted);transition:transform .18s,background .18s}.nm-settings .nm-switch input:checked + .nm-track{background:color-mix(in srgb,var(--nm-accent) 20%,var(--nm-bg));border-color:var(--nm-accent)}.nm-settings .nm-switch input:checked + .nm-track:after{transform:translateX(16px);background:var(--nm-accent)}.nm-settings .nm-switch:has(input:disabled){opacity:.55;cursor:not-allowed}.nm-settings .nm-switchcopy{display:flex;flex-direction:column;gap:3px;min-width:0}.nm-settings .nm-switchcopy strong{font-size:13px;font-weight:600}.nm-settings .nm-switchcopy small{font-size:11px;color:var(--nm-muted);line-height:1.5}.nm-settings .nm-group{padding:0;border:0;min-width:0;margin:0}.nm-settings .nm-group legend{font-weight:650;font-size:15px;margin-bottom:8px;width:100%}.nm-settings .nm-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.nm-settings .nm-feature{padding:13px 14px;border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-bg);transition:border-color .16s}.nm-settings .nm-feature:hover{border-color:color-mix(in srgb,var(--nm-accent) 50%,var(--nm-border))}.nm-settings .nm-feature code{font-size:10px;color:var(--nm-muted);overflow-wrap:anywhere}.nm-settings .nm-savebar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:16px;border-top:1px solid var(--nm-border);flex-wrap:wrap}.nm-settings .nm-dirty{color:var(--nm-accent);font-size:12px}.nm-settings .nm-callout{padding:14px 16px;border-radius:12px;border:1px solid color-mix(in srgb,var(--nm-accent) 24%,var(--nm-border));background:color-mix(in srgb,var(--nm-accent) 5%,var(--nm-card));color:var(--nm-muted);font-size:12px}.nm-settings .nm-alert{padding:16px 18px;border-radius:13px;border:1px solid color-mix(in srgb,var(--nm-error) 40%,var(--nm-border));background:color-mix(in srgb,var(--nm-error) 6%,var(--nm-card));display:flex;align-items:center;justify-content:space-between;gap:12px;white-space:pre-wrap;overflow-wrap:anywhere}.nm-settings .nm-success{border-color:color-mix(in srgb,var(--nm-good) 40%,var(--nm-border));background:color-mix(in srgb,var(--nm-good) 6%,var(--nm-card))}.nm-settings details{border:1px solid var(--nm-border);border-radius:12px;padding:13px 15px}.nm-settings summary{cursor:pointer;color:var(--nm-muted);font-weight:550}.nm-settings details[open]>summary{margin-bottom:16px}.nm-settings .nm-metric{padding:16px;border:1px solid var(--nm-border);background:var(--nm-bg);border-radius:12px;min-width:0}.nm-settings .nm-metric span{font-size:11px;color:var(--nm-muted);display:block}.nm-settings .nm-metric strong{display:block;font-size:20px;font-weight:700;margin:4px 0}.nm-settings .nm-metric code{display:block;font-size:11px;color:var(--nm-muted);overflow-wrap:anywhere}.nm-settings .nm-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.nm-settings .nm-skeleton{height:95px;border-radius:14px;background:linear-gradient(100deg,var(--nm-card),var(--nm-raised),var(--nm-card));background-size:200% 100%;animation:nm-settings-load 1.6s ease infinite}.nm-settings .nm-empty{text-align:center;padding:28px;color:var(--nm-muted)}.nm-settings .nm-footer{font-size:11px;color:var(--nm-muted);text-align:center}.nm-settings .nm-inlinecode{font-family:ui-monospace,monospace;font-size:11px;background:var(--nm-bg);padding:3px 7px;border-radius:5px;overflow-wrap:anywhere}
@keyframes nm-settings-load{to{background-position:-200% 0}}@media(max-width:700px){.nm-settings{padding:14px;gap:15px}.nm-settings .nm-hero{padding:20px}.nm-settings .nm-grid,.nm-settings .nm-three{grid-template-columns:1fr}.nm-settings .nm-card{padding:17px}.nm-settings .nm-tabs button{padding:9px 12px}.nm-settings h2{font-size:22px}.nm-settings .nm-features{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.nm-settings *{animation:none!important;transition:none!important}}
`
    const LABELS = {
      novel: '一键完本', continue: '续写', study: '拆书', outline: '大纲', cast: '人设',
      rewrite: '改写', review: '审校', idea: '构思', spark: '灵感', world: '世界', role: '角色',
      stats: '统计', export: '导出', conflict: '冲突分析', pace: '节奏分析', reader: '虚拟读者',
      dialogue: '对话增强', emotion: '情感曲线', market: '市场分析', compare: '作品对比',
      chapter: '章节生成', tips: '写作建议', trope: '套路分析', backup: '备份', merge: '合并', split: '拆分',
      learn: '学习记录', memory: '学习库', decide: '辅助决策',
    }
    const GROUPS = [
      ['writing', '写作', ['novel', 'continue', 'chapter', 'rewrite']],
      ['planning', '规划', ['idea', 'outline', 'cast', 'world', 'role', 'spark']],
      ['analysis', '分析', ['study', 'review', 'conflict', 'pace', 'reader', 'dialogue', 'emotion', 'market', 'compare']],
      ['management', '管理', ['stats', 'export', 'backup', 'merge', 'split', 'tips', 'trope']],
      ['intelligence', '学习与决策', ['learn', 'memory', 'decide']],
    ]
    const LEARNING = { enabled: false, autoSummarize: true, reuse: true, storageDir: 'novel_learning', summaryProvider: '', summaryModel: '', maxInputChars: 12000, maxRecords: 500, cooldownSeconds: 60 }
    const DECISION = { enabled: false, provider: '', model: '', reasoningEffort: '', minConfidence: 0.7, timeoutMs: 30000 }
    const short = value => value ? value.slice(0, 12) : '提交未知'
    const version = value => `${value?.version ?? '未知'} · ${short(value?.commit)}`

    async function api(action, { body, signal, timeoutMs = 20000 } = {}) {
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) controller.abort()
      const timer = setTimeout(abort, timeoutMs)
      try {
        const response = await fetch(`${API}${action}`, {
          method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', redirect: 'error',
          headers: { 'content-type': 'application/json', 'x-novel-master': 'settings' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
        })
        let payload
        if (typeof response.text === 'function') {
          const text = await response.text()
          try { payload = text ? JSON.parse(text) : {} } catch {
            throw new Error(`${action} · HTTP ${response.status ?? '未知'}：${response.status === 404 ? '插件后端尚未就绪，请重启 DSH 后重试。' : response.status === 401 ? '登录状态已失效，请刷新当前页面。' : '后端未返回有效数据，请刷新状态或重启 DSH。'}`)
          }
        } else payload = await response.json()
        if (!response.ok) throw new Error(`${action} · HTTP ${response.status ?? '未知'}：${payload.error ?? (response.status === 404 ? '插件后端尚未就绪，请重启 DSH 后重试。' : '请求失败，请稍后重试。')}`)
        return payload
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    }

    function SettingsPage() {
      const [form, setForm] = useState(null)
      const [state, setState] = useState(null)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [directory, setDirectory] = useState('')
      const [proxy, setProxy] = useState('')
      const [learning, setLearning] = useState({ ...LEARNING, ...form?.value?.learning })
      const [decision, setDecision] = useState({ ...DECISION, ...form?.value?.decision })
      const [activity, setActivity] = useState(null)
      const [activityError, setActivityError] = useState('')
      const [activityBusy, setActivityBusy] = useState(false)
      const [tab, setTab] = useState('features')
      const [search, setSearch] = useState('')
      const [loading, setLoading] = useState(!form)
      const alive = useRef(true)
      const saving = useRef(false)
      const operation = useRef(null)
      const dirty = useRef({})
      const activityRequest = useRef(null)
      const acceptForm = (next, saved = {}) => {
        setForm(next)
        for (const key of Object.keys(saved)) delete dirty.current[key]
        if (!dirty.current.projectsDir) setDirectory(next.value?.projectsDir ?? 'novel_projects')
        if (!dirty.current.updateProxy) setProxy(next.value?.updateProxy ?? '')
        if (!dirty.current.learning) setLearning({ ...LEARNING, ...next.value?.learning })
        if (!dirty.current.decision) setDecision({ ...DECISION, ...next.value?.decision })
      }
      const changed = (draft, original) => Object.keys(draft).some(key => String(draft[key]) !== String(original[key]))
      const editLearning = (key, next) => setLearning(current => { const draft = { ...current, [key]: next }; dirty.current.learning = changed(draft, { ...LEARNING, ...form?.value?.learning }); return draft })
      const editDecision = (key, next) => setDecision(current => { const draft = { ...current, [key]: next }; dirty.current.decision = changed(draft, { ...DECISION, ...form?.value?.decision }); return draft })
      async function load(signal) {
        setLoading(true)
        const results = await Promise.allSettled([api('settings', { signal }), api('status', { signal })])
        if (!alive.current || signal?.aborted) return
        if (results[0].status === 'fulfilled') acceptForm(results[0].value)
        if (results[1].status === 'fulfilled') setState(results[1].value)
        const failures = results.filter(result => result.status === 'rejected').map(result => result.reason.message)
        if (failures.length) setError(failures.join('\n'))
        setLoading(false)
      }
      useEffect(() => {
        alive.current = true
        const controller = new AbortController()
        load(controller.signal)
        return () => { alive.current = false; controller.abort(); operation.current?.abort(); activityRequest.current?.abort() }
      }, [])

      async function refresh() { setError(''); await load() }
      async function save(patch) {
        if (!form || saving.current || operation.current || activityRequest.current || busy || state?.busy) return
        saving.current = true; setBusy('save'); setError(''); setNotice('')
        try {
          const next = await api('settings', { body: { patch, revision: form.revision } })
          if (alive.current) { acceptForm(next, patch); setNotice('配置已保存。') }
        } catch (reason) {
          if (alive.current) { await refresh(); if (alive.current) setError(`保存失败：${reason.message}`) }
        } finally { saving.current = false; if (alive.current) setBusy('') }
      }
      async function run(action) {
        if (operation.current || saving.current || activityRequest.current || busy || state?.busy) return
        const controller = new AbortController()
        operation.current = controller
        setBusy(action); setError(''); setNotice('')
        try {
          const next = await api(action, { body: {}, signal: controller.signal, timeoutMs: action === 'apply' ? 195000 : 20000 })
          if (!alive.current) return
          if (action === 'reload') {
            const message = next.diagnostic ?? `重载结果：${next.application ?? (next.ok ? '成功' : '未完成')}`
            if (next.application === 'applied') setNotice(message)
            else setError(message)
          } else {
            setState(next)
            if (next.result) {
              const result = next.result
              const detail = result.error?.diagnostic ?? result.error?.code ?? ''
              const scripts = result.pendingBuilds?.length ? ` 构建脚本未获自动批准，请在插件管理器处理：${result.pendingBuilds.join(', ')}。` : ''
              const reload = result.codeReload ? ` 代码重载：${result.codeReload.application}。${result.codeReload.diagnostic ?? ''}` : ''
              const text = `安装结果：${result.application}。${detail}${scripts}${reload}${result.application === 'restart-required' ? (result.codeReload?.application === 'applied' ? ' Host 代码已切换；界面请刷新，新增页面仍可能需要重启。' : ' 请重启 DSH。') : ''}`
              if (['failed', 'cancelled', 'overridden'].includes(result.application) || result.codeReload?.application === 'failed') setError(text)
              else setNotice(text)
            }
          }
        } catch (reason) { if (alive.current) setError(reason.name === 'AbortError' ? '请求已取消或超时，请刷新状态确认安装结果。' : reason.message) }
        finally { operation.current = null; if (alive.current) setBusy('') }
      }
      async function cancel() {
        try {
          const result = await api('cancel', { body: {} })
          if (alive.current) setNotice(`取消结果：${result.status}。安装锁会保留到插件管理器结束操作。`)
        } catch (reason) { if (alive.current) setError(reason.message) }
      }
      async function readActivity() {
        if (activityRequest.current || saving.current || operation.current || busy || state?.busy) return
        const controller = new AbortController()
        activityRequest.current = controller; setActivityBusy(true); setActivityError('')
        try {
          const next = await api('intelligence/status', { signal: controller.signal })
          if (alive.current) setActivity(next)
        } catch (reason) { if (alive.current && !controller.signal.aborted) setActivityError(`读取活动失败：${reason.message}`) }
        finally { activityRequest.current = null; if (alive.current) setActivityBusy(false) }
      }
      function saveLearning(event) {
        event.preventDefault()
        const next = { ...learning, storageDir: learning.storageDir.trim(), summaryProvider: learning.summaryProvider.trim(), summaryModel: learning.summaryModel.trim() }
        if (!next.storageDir) return setError('学习存储目录不能为空；支持绝对路径或相对路径。')
        if (!!next.summaryProvider !== !!next.summaryModel) return setError('摘要提供方和模型必须同时填写，或同时留空。')
        const ranges = { maxInputChars: [1000, 24000], maxRecords: [1, 10000], cooldownSeconds: [0, 86400] }
        for (const [key, [min, max]] of Object.entries(ranges)) {
          next[key] = Number(next[key])
          if (!Number.isSafeInteger(next[key]) || next[key] < min || next[key] > max) return setError(`${key} 必须为 ${min} 到 ${max} 之间的整数。`)
        }
        return save({ learning: next })
      }
      function saveDecision(event) {
        event.preventDefault()
        const next = { ...decision, provider: decision.provider.trim(), model: decision.model.trim(), reasoningEffort: decision.reasoningEffort.trim(), minConfidence: Number(decision.minConfidence), timeoutMs: Number(decision.timeoutMs) }
        if (!!next.provider !== !!next.model || (next.enabled && (!next.provider || !next.model))) return setError('决策需要明确配置提供方和模型，必须成对填写。')
        if (!Number.isFinite(next.minConfidence) || next.minConfidence < 0 || next.minConfidence > 1) return setError('最低置信度必须是 0 到 1 之间的数值。')
        if (!Number.isSafeInteger(next.timeoutMs) || next.timeoutMs < 1000 || next.timeoutMs > 120000) return setError('决策超时必须为 1000 到 120000 毫秒之间的整数。')
        return save({ decision: next })
      }
      const value = form?.value ?? {}
      const locked = !!busy || state?.busy || activityBusy
      const commandKeys = Object.keys(value.commands ?? {}).filter(key => key !== 'update' && key !== 'novel-update')
      const known = new Set(GROUPS.flatMap(([, , keys]) => keys))
      const groups = [...GROUPS, ['other', '其他', commandKeys.filter(key => !known.has(key))]]
      const enabledCount = keys => keys.filter(key => value.commands[key] !== false).length
      const batch = (keys, enabled) => { if (!locked && !saving.current) return save({ commands: Object.fromEntries(keys.map(key => [key, enabled])) }) }
      const field = (label, key, draft, edit, type = 'text', props = {}) => h('label', { className: 'nm-field' }, h('span', null, label),
        h('input', { type, value: draft[key], disabled: locked, 'aria-label': label, ...props, onChange: event => edit(key, event.target.value) }))
      const toggle = (label, checked, onChange, description, aria = label) => h('label', { className: 'nm-switch' },
        h('span', { className: 'nm-switchcopy' }, h('strong', null, label), description && h('small', null, description)),
        h('input', { type: 'checkbox', role: 'switch', 'aria-label': aria, checked, disabled: locked, onChange: event => onChange(event.target.checked) }), h('i', { className: 'nm-track', 'aria-hidden': true }))
      const check = (label, key, draft, edit, description) => toggle(label, draft[key] === true, next => edit(key, next), description)
      const card = (title, description, ...children) => h('div', { className: 'nm-card' }, h('div', null, h('h3', null, title), description && h('p', { className: 'nm-muted' }, description)), ...children)
      const actionButton = (label, onClick, disabled = locked, primary = false) => h('button', { type: 'button', onClick, disabled, className: primary ? 'nm-primary' : '' }, label)
      const saveBar = (section, label, disabled = false) => h('div', { className: 'nm-savebar' }, h('span', { className: dirty.current[section] ? 'nm-dirty' : 'nm-muted' }, dirty.current[section] ? '有未保存的修改' : '配置已同步'), h('button', { type: 'submit', className: 'nm-primary', disabled: locked || disabled }, busy === 'save' ? '正在保存…' : label))
      const panel = (id, ...children) => h('section', { id: `nm-panel-${id}`, role: 'tabpanel', 'aria-labelledby': `nm-tab-${id}`, hidden: tab !== id, className: 'nm-stack', tabIndex: 0 }, ...children)
      const chip = (label, on) => h('span', { className: 'nm-chip', 'data-on': on === true }, h('i', { 'aria-hidden': true }), label)
      const query = search.trim().toLowerCase()
      const matches = key => !query || `${LABELS[key] ?? key} novel-${key}`.toLowerCase().includes(query)
      const descriptions = { novel: '从脑洞到完整长篇', continue: '接续项目或导入作品', chapter: '按指定章号生成新稿', rewrite: '调整表达与叙事方式', idea: '展开脑洞与故事方向', outline: '搭建分卷与章节结构', cast: '建立角色档案', world: '查看或推演世界状态', role: '查看与调整角色设定', spark: '为创作卡点提供灵感', study: '拆解参考作品的风格', review: '检查逻辑与文字问题', conflict: '梳理冲突与升级空间', pace: '检查叙事节奏和张弛', reader: '模拟不同读者的反馈', dialogue: '检查人物口吻与对话', emotion: '追踪情绪变化与弧线', market: '讨论平台适配方向', compare: '对比作品差异与优势', stats: '计算字数与章节进度', export: '导出可阅读的整书文件', backup: '保留可恢复的项目快照', merge: '将选定章节合成新文件', split: '按长度拆分为新文件', tips: '获取针对性的写作建议', trope: '设计套路变体与风险', learn: '提炼可复用的写作经验', memory: '查询模型专属经验', decide: '获得有依据的取舍建议' }
      const applyPreset = keys => { if (!locked && !saving.current) return save({ commands: Object.fromEntries(commandKeys.map(key => [key, keys.includes(key)])) }) }
      const activityPanel = h('div', { className: 'nm-card' }, h('div', { className: 'nm-cardhead' }, h('div', null, h('h3', null, '智能活动'), h('p', { className: 'nm-muted' }, '按需读取实际运行状态，不推测当前模型。')), actionButton(activityBusy ? '正在读取活动…' : '读取学习与决策活动', readActivity)),
        activityError && h('p', { role: 'alert', className: 'nm-alert' }, activityError),
        activity ? h('div', { role: 'status', className: 'nm-stack' }, h('div', { className: 'nm-row' }, chip(`学习：${activity.learningEnabled === true ? '启用' : activity.learningEnabled === false ? '关闭' : '未知'}`, activity.learningEnabled), chip(`决策：${activity.decisionEnabled === true ? '启用' : activity.decisionEnabled === false ? '关闭' : '未知'}`, activity.decisionEnabled)),
          h('p', { className: 'nm-muted' }, `配置存储地址：${activity.storageDir ?? '未返回'}；最近实际目录：${activity.location ?? '尚未访问'}`),
          h('p', { className: 'nm-muted' }, `跟踪会话：${activity.trackedSessions ?? '未返回'}；活动任务：${activity.activeJobs ?? '未返回'}；本次运行写入：${activity.recordsWrittenThisRun ?? '未返回'}`), activity.lastError && h('p', { role: 'alert' }, `最近错误：${activity.lastError}`)) : h('p', { className: 'nm-muted' }, '尚未读取。使用 /novel-memory 可查询已保存的经验。'))
      return h('div', { className: 'nm-settings' }, h('style', null, CSS),
        h('header', { className: 'nm-hero' }, h('div', { className: 'nm-row nm-between' }, h('div', { className: 'nm-brand' }, h('div', { className: 'nm-logo', 'aria-hidden': true }, h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z' }), h('path', { d: 'M12 6v14M6 9h3M6 12h3M15 9h3M15 12h3' }))), h('div', null, h('div', { className: 'nm-row' }, h('h2', null, '小说创作大师'), h('span', { className: 'nm-badge' }, 'v1.4.1')), h('p', { className: 'nm-muted' }, '把创作、经验与判断，整理成自己的写作工作台。'))), actionButton('刷新设置与状态', refresh)),
          h('div', { className: 'nm-row' }, chip(form ? value.enabled === false ? '小说功能已关闭' : '小说功能已启用' : '配置待连接', form && value.enabled !== false), chip(form ? `已选择 ${enabledCount(commandKeys)} / ${commandKeys.length} 项功能` : '功能加载中', !!form), chip(!form ? '学习状态待连接' : value.learning?.enabled ? value.enabled === false ? '学习总结已暂停' : '学习总结已启用' : '学习总结未启用', !!form && value.enabled !== false && value.learning?.enabled), chip(!form ? '决策状态待连接' : value.decision?.enabled ? value.enabled === false ? '决策助手已暂停' : '决策助手已启用' : '决策助手未启用', !!form && value.enabled !== false && value.decision?.enabled))),
        error && h('div', { role: 'alert', className: 'nm-alert' }, h('div', null, h('strong', null, '暂时无法完成操作'), h('p', null, error)), actionButton('重试连接', refresh)),
        notice && h('div', { role: 'status', className: 'nm-alert nm-success' }, notice),
        h('nav', { role: 'tablist', 'aria-label': '小说设置导航', className: 'nm-tabs' }, ...[['features', '功能选择'], ['learning', '学习总结'], ['decision', '决策助手'], ['updates', '更新维护']].map(([id, label], index, tabs) => h('button', { type: 'button', role: 'tab', id: `nm-tab-${id}`, 'aria-controls': `nm-panel-${id}`, 'aria-selected': tab === id, tabIndex: tab === id ? 0 : -1, onClick: () => setTab(id), onKeyDown: event => { const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1; if (next >= 0) { event.preventDefault(); setTab(tabs[next][0]); event.currentTarget.parentElement?.querySelector(`#nm-tab-${tabs[next][0]}`)?.focus() } } }, label))),
        !form && loading && h('div', { className: 'nm-grid', role: 'status', 'aria-label': '正在加载设置' }, ...[0, 1, 2, 3].map(key => h('div', { className: 'nm-skeleton', key }))),
        !form && !loading && h('div', { className: 'nm-card nm-empty' }, h('h3', null, '配置服务尚未连接'), h('p', null, '请确认插件已启用；安装或更新后可重启 DSH 再连接。'), actionButton('重新读取配置', refresh)),
        panel('features', form && card('创作工作台', '关闭总开关会移除功能命令并停止智能处理，配置和更新入口仍保留。',
          toggle('启用小说功能', value.enabled !== false, next => save({ enabled: next }), '已运行的写作目标可通过 /goal pause 暂停。'),
          h('form', { 'aria-label': '项目目录配置', onSubmit: event => { event.preventDefault(); if (directory.trim()) save({ projectsDir: directory.trim() }) } }, field('项目目录', 'directory', { directory }, (_, next) => { dirty.current.projectsDir = next !== (value.projectsDir ?? 'novel_projects'); setDirectory(next) }, 'text', { required: true, placeholder: 'novel_projects' }), h('p', { className: 'nm-muted' }, '相对于工作目录保存小说项目；修改地址不会自动搬迁已有文件。'), saveBar('projectsDir', '保存项目目录', !directory.trim()))),
          form && card('选择适合你的工具', '按创作阶段选择，开关保存后立即生效；更新维护始终保留。',
            h('div', { className: 'nm-toolbar' }, h('input', { className: 'nm-search', type: 'search', value: search, placeholder: '搜索功能名称或命令…', 'aria-label': '搜索功能', onChange: event => setSearch(event.target.value) }), actionButton('全部开启', () => batch(commandKeys, true), locked || !commandKeys.length), actionButton('全部关闭', () => batch(commandKeys, false), locked || !commandKeys.length)),
            h('div', { className: 'nm-row' }, h('span', { className: 'nm-muted' }, '快速选择'), actionButton('基础工具', () => applyPreset(['novel', 'continue', 'chapter', 'outline', 'cast', 'stats', 'export', 'backup'])), actionButton('写作进阶', () => applyPreset(GROUPS.slice(0, 4).flatMap(([, , keys]) => keys))), actionButton('完整工具', () => applyPreset(commandKeys))),
            h('p', { role: 'status', className: 'nm-muted' }, `已选择 ${enabledCount(commandKeys)} / ${commandKeys.length} 项创作功能${value.enabled === false ? '（总开关已关闭）' : ''}`),
            ...groups.map(([id, label, keys]) => { const available = keys.filter(key => commandKeys.includes(key)); const visible = available.filter(matches); if (!available.length || !visible.length) return null
              return h('fieldset', { className: 'nm-group', key: id, 'aria-label': `${label}功能` }, h('legend', null, `${label} · ${enabledCount(available)} / ${available.length}`), h('div', { className: 'nm-row' }, actionButton(`${label}全开`, () => batch(available, true)), actionButton(`${label}全关`, () => batch(available, false))), h('div', { className: 'nm-features' }, ...visible.map(key => h('div', { className: 'nm-feature', key }, toggle(LABELS[key] ?? key, value.commands[key] !== false, next => batch([key], next), descriptions[key] ?? '按需加入你的创作工作流。'), h('code', null, `/${key === 'novel' ? 'novel' : `novel-${key}`}`))))) }),
            !commandKeys.some(matches) && h('div', { className: 'nm-empty', role: 'status' }, '没有找到匹配功能，试试其他关键词。'))),
        panel('learning', form && !value.learning ? card('学习配置尚未就绪', '当前 Host 尚未提供学习配置，请重载插件或重启 DSH。') : form && h('form', { className: 'nm-stack', 'aria-label': '学习配置', onSubmit: saveLearning },
          card('让每次创作留下经验', '从小说任务的成功输出中总结经验，按工作目录与实际提供方 / 模型分别保存。', check('启用学习', 'enabled', learning, editLearning, '保存可查询的经验，不训练模型权重，也不收集任意聊天。'), h('div', { className: 'nm-grid' }, h('div', { className: 'nm-feature' }, check('自动生成摘要', 'autoSummarize', learning, editLearning, '小说任务完成后自动总结。')), h('div', { className: 'nm-feature' }, check('复用学习记录', 'reuse', learning, editLearning, '将同模型经验加入后续任务参考。')))),
          card('经验存储', '你决定记录保存在哪里。', field('学习存储目录', 'storageDir', learning, editLearning, 'text', { required: true, placeholder: 'novel_learning 或绝对路径' }), h('p', { className: 'nm-callout' }, '支持工作目录相对路径或绝对地址。不同工作目录与模型独立存储，切换地址不会自动迁移旧记录。')),
          card('摘要生成模型', '留空跟随被总结结果的来源模型；指定其他模型时仍保留原始归属。', h('div', { className: 'nm-grid' }, field('摘要生成提供方', 'summaryProvider', learning, editLearning, 'text', { placeholder: '留空跟随来源' }), field('摘要生成模型', 'summaryModel', learning, editLearning, 'text', { placeholder: '填写准确的 model ID' })), h('details', null, h('summary', null, '高级设置 · 输入与存储限额'), h('div', { className: 'nm-grid' }, field('学习输入字符上限', 'maxInputChars', learning, editLearning, 'number', { required: true, min: 1000, max: 24000, step: 1 }), field('学习记录上限', 'maxRecords', learning, editLearning, 'number', { required: true, min: 1, max: 10000, step: 1 }), field('学习冷却秒数', 'cooldownSeconds', learning, editLearning, 'number', { required: true, min: 0, max: 86400, step: 1 })), h('p', { className: 'nm-muted' }, '达到记录上限停止追加，不自动删除旧资料。')), saveBar('learning', '保存学习配置'))), activityPanel),
        panel('decision', form && !value.decision ? card('决策配置尚未就绪', '当前 Host 尚未提供决策配置，请重载插件或重启 DSH。') : form && h('form', { className: 'nm-stack', 'aria-label': '决策配置', onSubmit: saveDecision },
          card('为关键取舍增加第二种判断', '在剧情分岔与审校选择中，调用你指定的模型提供有依据的建议。', check('启用辅助决策', 'enabled', decision, editDecision, '返回选择、简短理由、置信度与人工复核要求。'), h('div', { className: 'nm-callout' }, '决策仅作建议；低置信度或调用失败时交回用户，永不授权删除或恢复操作。')),
          card('决策模型', '明确指定已注册的模型路由，不根据名称推断模型能力。', h('div', { className: 'nm-grid' }, field('决策提供方', 'provider', decision, editDecision, 'text', { placeholder: 'provider ID' }), field('决策模型', 'model', decision, editDecision, 'text', { placeholder: 'model ID' })), h('details', null, h('summary', null, '高级设置 · 推理与复核'), h('div', { className: 'nm-grid' }, field('决策推理强度', 'reasoningEffort', decision, editDecision, 'text', { placeholder: '留空使用模型默认值' }), field('最低决策置信度', 'minConfidence', decision, editDecision, 'number', { required: true, min: 0, max: 1, step: 0.01 }), field('决策超时毫秒', 'timeoutMs', decision, editDecision, 'number', { required: true, min: 1000, max: 120000, step: 1 })), h('p', { className: 'nm-muted' }, '推理强度需由所选模型支持。低于置信度阈值的结果须人工复核。')), saveBar('decision', '保存决策配置'))), h('div', { className: 'nm-callout' }, '手动发起：', h('code', { className: 'nm-inlinecode' }, '/novel-decide 问题 | 选项A | 选项B'))),
        panel('updates', card('版本与更新', '按完整提交 SHA 安装，保留安装结果与代码重载结果。', h('div', { className: 'nm-three' }, ...[['当前运行', state?.running], ['磁盘安装', state?.disk], ['main 最新', state?.latest]].map(([label, info]) => h('div', { className: 'nm-metric', key: label }, h('span', null, label), h('strong', null, info?.version ?? (label === 'main 最新' ? '尚未检查' : '未知')), h('code', null, short(info?.commit))))),
          state?.latest && h('p', { className: 'nm-callout' }, state.updateAvailable === false ? '磁盘已是此提交。' : state.updateAvailable === null ? '本地提交未知，版本号相同不能证明代码相同。' : '发现可安装的提交。检查后拉取会锁定本次完整 SHA。'),
          h('div', { className: 'nm-row' }, actionButton(busy === 'check' ? '检查中…' : '检查更新', () => run('check'), locked, true), actionButton(busy === 'apply' ? '正在拉取并安装…' : '拉取此提交', () => run('apply'), locked || !state?.latest), (busy === 'apply' || state?.busy) && actionButton('取消安装', cancel, false)), state?.result && h('p', { className: 'nm-callout' }, `最近安装结果：${state.result.application}${state.result.codeReload ? `；代码重载：${state.result.codeReload.application}` : ''}`)),
          form && card('更新网络', '代理只影响更新检查；安装使用 DSH 插件管理器的网络设置。', h('form', { 'aria-label': '更新代理配置', onSubmit: event => { event.preventDefault(); save({ updateProxy: proxy.trim() }) } }, field('更新检查代理', 'proxy', { proxy }, (_, next) => { dirty.current.updateProxy = next !== (value.updateProxy ?? ''); setProxy(next) }, 'text', { placeholder: 'http://127.0.0.1:7897' }), h('p', { className: 'nm-muted' }, '留空使用代理环境变量或直连。'), saveBar('updateProxy', '保存更新代理'))),
          card('运行维护', '代码重载切换 Host 运行实例，刷新界面只重新加载浏览器页面。', h('div', { className: 'nm-row' }, actionButton('重载插件', () => run('reload'), locked || !state?.reloadSupported), actionButton('刷新界面', () => window.location.reload(), !!busy)), !state?.reloadSupported && h('p', { className: 'nm-muted' }, '当前运行实例未提供可用重载入口，需要时请重启 DSH。'))),
        h('footer', { className: 'nm-footer' }, '创作由你掌舵 · 功能按需开启 · 配置保存后生效'))
    }
    return {
      name: 'novel-master', inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'novel-master', order: 36, label: () => '小说创作大师',
        }, props => h(SettingsPage, props)))
      },
    }
  },
})
