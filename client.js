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
    }
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
      const alive = useRef(true)
      const saving = useRef(false)
      const operation = useRef(null)
      const acceptForm = value => { setForm(value); setDirectory(value.value?.projectsDir ?? 'novel_projects'); setProxy(value.value?.updateProxy ?? '') }
      useEffect(() => {
        alive.current = true
        const controller = new AbortController()
        Promise.all([api('settings', { signal: controller.signal }), api('status', { signal: controller.signal })])
          .then(([nextForm, nextState]) => { if (alive.current) { acceptForm(nextForm); setState(nextState) } })
          .catch(reason => { if (alive.current && !controller.signal.aborted) setError(reason.message) })
        return () => { alive.current = false; controller.abort(); operation.current?.abort() }
      }, [])

      async function refresh() {
        try {
          setError('')
          const [nextForm, nextState] = await Promise.all([api('settings'), api('status')])
          if (alive.current) { acceptForm(nextForm); setState(nextState) }
        } catch (reason) { if (alive.current) setError(reason.message) }
      }
      async function save(patch) {
        if (!form || saving.current) return
        saving.current = true; setBusy('save'); setError(''); setNotice('')
        try {
          const next = await api('settings', { body: { patch, revision: form.revision } })
          if (alive.current) { acceptForm(next); setNotice('配置已保存。') }
        } catch (reason) {
          if (alive.current) { await refresh(); if (alive.current) setError(`保存失败：${reason.message}`) }
        } finally { saving.current = false; if (alive.current) setBusy('') }
      }
      async function run(action) {
        if (operation.current) return
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
      const value = form?.value ?? {}
      const locked = !!busy || state?.busy
      return h('div', { style: { padding: 20, maxWidth: 1000, color: 'inherit' } },
        h('h2', null, '小说创作大师'),
        h('p', null, '管理写作命令、项目目录与插件更新。关闭写作总开关后，仍可在此检查和拉取更新。'),
        error && h('p', { role: 'alert', style: { whiteSpace: 'pre-wrap' } }, error),
        notice && h('p', { role: 'status', style: { whiteSpace: 'pre-wrap' } }, notice),
        h('button', { type: 'button', onClick: refresh, disabled: !!busy }, '刷新设置与状态'),
        !form ? h('p', null, '配置尚未就绪，请确认 Host 插件已启用。') : h('section', { style: box, 'aria-label': '写作设置' },
          h('h3', null, '写作设置'),
          h('label', { style: row },
            h('input', { type: 'checkbox', checked: value.enabled !== false, disabled: locked,
              onChange: event => save({ enabled: event.target.checked }) }), '启用写作命令'),
          h('form', { onSubmit: event => { event.preventDefault(); if (directory.trim()) save({ projectsDir: directory.trim() }) } },
            h('label', { style: row }, '项目目录', h('input', { value: directory, required: true, disabled: locked,
              onChange: event => setDirectory(event.target.value), 'aria-label': '项目目录' })),
            h('button', { type: 'submit', disabled: locked || !directory.trim() }, '保存项目目录')),
          h('h4', null, '命令开关'),
          h('div', { style: grid }, ...Object.keys(value.commands ?? {}).map(key => h('label', { key, style: row },
            h('input', { type: 'checkbox', checked: value.commands[key] !== false, disabled: locked,
              onChange: event => save({ commands: { [key]: event.target.checked } }) }),
            `${LABELS[key] ?? key} (/${key === 'novel' ? 'novel' : `novel-${key}`})`))),
        ),
        h('section', { style: box, 'aria-label': '插件更新' },
          h('h3', null, '插件更新'),
          form && h('form', { onSubmit: event => { event.preventDefault(); save({ updateProxy: proxy.trim() }) } },
            h('label', { style: row }, '更新检查代理', h('input', { value: proxy, disabled: locked, placeholder: 'http://127.0.0.1:7897', 'aria-label': '更新检查代理', onChange: event => setProxy(event.target.value) })),
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
