/* Hand-written DSH ModuleLoader client, following the installed Our Free Model
 * entry pattern. Uses the shell's React; no JSX, bundler, or extra dependency. */
window.__ModuleLoader__.load({
  id: 'dsh-novel-master',
  factory: require => {
    const React = require('react')
    const { createElement: h, useState, useEffect, useRef } = React
    const API = new URL('api/novel-master/', document.baseURI).pathname
    const box = { border: '1px solid currentColor', borderRadius: 10, padding: 16, margin: '16px 0' }
    const row = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '12px 0' }
    const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }
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
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`)
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
      const editLearning = (key, next) => { dirty.current.learning = true; setLearning(current => ({ ...current, [key]: next })) }
      const editDecision = (key, next) => { dirty.current.decision = true; setDecision(current => ({ ...current, [key]: next })) }
      useEffect(() => {
        alive.current = true
        const controller = new AbortController()
        Promise.all([api('settings', { signal: controller.signal }), api('status', { signal: controller.signal })])
          .then(([nextForm, nextState]) => { if (alive.current) { acceptForm(nextForm); setState(nextState) } })
          .catch(reason => { if (alive.current && !controller.signal.aborted) setError(reason.message) })
        return () => { alive.current = false; controller.abort(); operation.current?.abort(); activityRequest.current?.abort() }
      }, [])

      async function refresh() {
        try {
          setError('')
          const [nextForm, nextState] = await Promise.all([api('settings'), api('status')])
          if (alive.current) { acceptForm(nextForm); setState(nextState) }
        } catch (reason) { if (alive.current) setError(reason.message) }
      }
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
      const field = (label, key, draft, edit, type = 'text', props = {}) => h('label', { style: row }, label,
        h('input', { type, value: draft[key], disabled: locked, 'aria-label': label, ...props, onChange: event => edit(key, event.target.value) }))
      const check = (label, key, draft, edit) => h('label', { style: row },
        h('input', { type: 'checkbox', checked: draft[key] === true, disabled: locked, 'aria-label': label, onChange: event => edit(key, event.target.checked) }), label)
      return h('div', { style: { padding: 20, maxWidth: 1000, color: 'inherit' } },
        h('h2', null, '小说创作大师'),
        h('p', null, '管理功能开关、学习总结、决策模型和插件更新。关闭总开关会移除创作命令并停止智能处理，配置和更新入口仍保留。'),
        error && h('p', { role: 'alert', style: { whiteSpace: 'pre-wrap' } }, error),
        notice && h('p', { role: 'status', style: { whiteSpace: 'pre-wrap' } }, notice),
        h('button', { type: 'button', onClick: refresh, disabled: locked }, '刷新设置与状态'),
        !form ? h('p', null, '配置尚未就绪，请确认 Host 插件已启用。') : h('section', { style: box, 'aria-label': '写作设置' },
          h('h3', null, '写作设置'),
          h('label', { style: row },
            h('input', { type: 'checkbox', checked: value.enabled !== false, disabled: locked,
              onChange: event => save({ enabled: event.target.checked }) }), '启用小说功能'),
          h('form', { onSubmit: event => { event.preventDefault(); if (directory.trim()) save({ projectsDir: directory.trim() }) } },
            h('label', { style: row }, '项目目录', h('input', { value: directory, required: true, disabled: locked,
              onChange: event => { dirty.current.projectsDir = true; setDirectory(event.target.value) }, 'aria-label': '项目目录' })),
            h('button', { type: 'submit', disabled: locked || !directory.trim() }, '保存项目目录')),
          h('h4', null, '功能选择'),
          h('p', { role: 'status' }, `已选择 ${enabledCount(commandKeys)} / ${commandKeys.length} 项创作功能${value.enabled === false ? '（总开关已关闭，创作命令当前不运行）' : ''}；更新维护始终保留。`),
          h('div', { style: row },
            h('button', { type: 'button', disabled: locked || !commandKeys.length, onClick: () => batch(commandKeys, true) }, '全部开启'),
            h('button', { type: 'button', disabled: locked || !commandKeys.length, onClick: () => batch(commandKeys, false) }, '全部关闭')),
          ...groups.map(([id, label, keys]) => {
            const available = keys.filter(key => commandKeys.includes(key))
            if (!available.length) return null
            return h('fieldset', { key: id, style: box, 'aria-label': `${label}功能` },
              h('legend', null, `${label} · ${enabledCount(available)} / ${available.length}`),
              h('div', { style: row },
                h('button', { type: 'button', disabled: locked, onClick: () => batch(available, true) }, `${label}全开`),
                h('button', { type: 'button', disabled: locked, onClick: () => batch(available, false) }, `${label}全关`)),
              h('div', { style: grid }, ...available.map(key => h('label', { key, style: row },
                h('input', { type: 'checkbox', checked: value.commands[key] !== false, disabled: locked, 'aria-label': LABELS[key] ?? key,
                  onChange: event => batch([key], event.target.checked) }),
                `${LABELS[key] ?? key} (/${key === 'novel' ? 'novel' : `novel-${key}`})`))))
          }),
        ),
        form && h('section', { style: box, 'aria-label': '学习与决策设置' },
          h('h3', null, '学习与决策'),
          h('p', null, '学习仅使用插件发起的小说任务的有界输出，按工作目录和实际提供方 / 模型分组；不训练模型权重，不收集任意聊天。'),
          !value.learning ? h('p', null, '当前 Host 尚未提供学习配置。') : h('form', { 'aria-label': '学习配置', onSubmit: saveLearning },
            check('启用学习', 'enabled', learning, editLearning),
            check('自动生成摘要', 'autoSummarize', learning, editLearning),
            check('复用学习记录', 'reuse', learning, editLearning),
            field('学习存储目录', 'storageDir', learning, editLearning, 'text', { required: true }),
            h('p', null, '存储目录支持用户指定的绝对路径或相对路径。摘要生成路由与来源分组路由分别记录。'),
            field('摘要生成提供方', 'summaryProvider', learning, editLearning),
            field('摘要生成模型', 'summaryModel', learning, editLearning),
            h('p', null, '摘要提供方和模型同时留空时，使用观察到的来源路由；自定义时必须成对填写。'),
            field('学习输入字符上限', 'maxInputChars', learning, editLearning, 'number', { required: true, min: 1000, max: 24000, step: 1 }),
            field('学习记录上限', 'maxRecords', learning, editLearning, 'number', { required: true, min: 1, max: 10000, step: 1 }),
            field('学习冷却秒数', 'cooldownSeconds', learning, editLearning, 'number', { required: true, min: 0, max: 86400, step: 1 }),
            h('button', { type: 'submit', disabled: locked }, '保存学习配置')),
          !value.decision ? h('p', null, '当前 Host 尚未提供决策配置。') : h('form', { 'aria-label': '决策配置', onSubmit: saveDecision },
            check('启用辅助决策', 'enabled', decision, editDecision),
            field('决策提供方', 'provider', decision, editDecision),
            field('决策模型', 'model', decision, editDecision),
            field('决策推理强度', 'reasoningEffort', decision, editDecision),
            field('最低决策置信度', 'minConfidence', decision, editDecision, 'number', { required: true, min: 0, max: 1, step: 0.01 }),
            field('决策超时毫秒', 'timeoutMs', decision, editDecision, 'number', { required: true, min: 1, step: 1 }),
            h('p', null, '决策必须明确指定提供方和模型；不会推断所谓特殊智能。输出理由与置信度，低置信度交由用户判断，永不授权删除或恢复操作。'),
            h('button', { type: 'submit', disabled: locked }, '保存决策配置')),
          h('button', { type: 'button', disabled: locked, onClick: readActivity }, activityBusy ? '正在读取活动…' : '读取学习与决策活动'),
          activityError && h('p', { role: 'alert' }, activityError),
          activity && h('div', { role: 'status' },
            h('p', null, `学习：${activity.learningEnabled === true ? '启用' : activity.learningEnabled === false ? '关闭' : '未知'}；决策：${activity.decisionEnabled === true ? '启用' : activity.decisionEnabled === false ? '关闭' : '未知'}`),
            h('p', null, `配置存储地址：${activity.storageDir ?? '未返回'}；最近实际目录：${activity.location ?? '尚未访问'}；跟踪会话：${activity.trackedSessions ?? '未返回'}；活动任务：${activity.activeJobs ?? '未返回'}；本次运行写入：${activity.recordsWrittenThisRun ?? '未返回'}`),
            activity.lastError && h('p', { role: 'alert' }, `最近错误：${activity.lastError}`)),
          h('p', null, '可使用 /novel-memory 查看学习库；活动状态按需读取，不猜测当前使用的模型。')),
        h('section', { style: box, 'aria-label': '插件更新' },
          h('h3', null, '插件更新'),
          form && h('form', { onSubmit: event => { event.preventDefault(); save({ updateProxy: proxy.trim() }) } },
            h('label', { style: row }, '更新检查代理', h('input', { value: proxy, disabled: locked, placeholder: 'http://127.0.0.1:7897', 'aria-label': '更新检查代理', onChange: event => { dirty.current.updateProxy = true; setProxy(event.target.value) } })),
            h('button', { type: 'submit', disabled: locked }, '保存更新代理')),
          h('p', null, '留空使用代理环境变量或直连；安装仍使用 DSH 插件管理器的网络设置。'),
          h('p', null, `当前运行：${version(state?.running)}`),
          h('p', null, `磁盘安装：${version(state?.disk)}`),
          h('p', null, `main 最新：${state?.latest ? version(state.latest) : '尚未检查'}`),
          state?.latest && h('p', null, state.updateAvailable === false ? '磁盘已是此提交。' : state.updateAvailable === null ? '本地提交未知，版本号相同不能证明代码相同。' : '可拉取最新提交。'),
          h('p', null, '拉取会安装本次检查得到的完整提交 SHA；运行代码是否已切换以 DSH 的安装结果为准。'),
          h('div', { style: row },
            h('button', { type: 'button', disabled: locked, onClick: () => run('check') }, busy === 'check' ? '检查中…' : '检查更新'),
            h('button', { type: 'button', disabled: locked || !state?.latest, onClick: () => run('apply') }, busy === 'apply' ? '正在拉取并安装…' : '拉取此提交'),
            (busy === 'apply' || state?.busy) && h('button', { type: 'button', onClick: cancel }, '取消安装'),
            h('button', { type: 'button', disabled: locked || !state?.reloadSupported, onClick: () => run('reload'), title: state?.reloadSupported ? '重新加载磁盘上的插件代码' : '当前宿主未公开独立代码重载接口' }, '重载插件'),
            h('button', { type: 'button', disabled: !!busy, onClick: () => window.location.reload() }, '刷新界面')),
          !state?.reloadSupported && h('p', null, '当前宿主没有独立的代码重载入口；需要时请重启 DSH。刷新界面只刷新浏览器页面。'),
        ),
      )
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
