import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

/**
 * 「生成进度」侧边栏页签的挂载与渲染。
 *
 * 这一层只验证前端：后端 atlas 已经用 test/atlas.test.js 独立覆盖。这里关心的是
 * 「注册进去了没有」「读到的数字有没有真的画出来」「没有数据时会不会崩」。
 */
const SOURCE = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function mount(options = {}) {
  const payload = options.payload ?? {
    defaultProject: '测试书',
    projects: [{
      name: '测试书',
      title: '测试书',
      progress: { chapters: 5, goal: 12, chars: 23000 },
      readiness: {
        done: 5, total: 8, percent: 63, next: 'outline',
        items: [
          { key: 'setting', label: '世界观', exists: true, created: true, headings: 4, chars: 900 },
          { key: 'cast', label: '人设', exists: true, created: true, headings: 6, chars: 1200 },
          { key: 'outline', label: '大纲', exists: false, created: false, headings: 0, chars: 0 },
          { key: 'foreshadow', label: '伏笔', exists: true, created: true, headings: 0, chars: 86 },
          { key: 'chapters', label: '正文', exists: true, created: true, headings: 5, chars: 0 },
        ],
      },
      batch: options.batch === undefined
        ? { phase: 'running', phaseLabel: '正在写', done: 5, target: 12, percent: 42, requestSize: 2, lastError: '', updatedAt: '2026-10-19T04:00:00.000Z', staleMs: 20000 }
        : options.batch,
    }],
  }

  const states = []
  let stateIndex = 0
  const requests = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const i = stateIndex++
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }]
    },
    useRef(initial) { return { current: initial } },
    // 真实 React 会执行副作用。这里同步跑一次，首次加载才会真的发出请求 ——
    // 空实现会让组件永远停在「暂无进度」，测试就变成自欺欺人。
    useEffect(fn) { try { fn() } catch { /* 清理函数留给调用方 */ } },
    Fragment: 'fragment',
  }

  let loaded
  vm.runInNewContext(SOURCE, {
    window: { __ModuleLoader__: { load: bundle => { loaded = bundle } } },
    location: { reload() {} },
    document: { baseURI: 'http://localhost/', visibilityState: 'visible', hidden: false },
    URL, AbortController, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    fetch: async (url) => {
      requests.push(url)
      if (options.fetchError) throw new Error(options.fetchError)
      return { ok: true, status: 200, json: async () => payload }
    },
  })

  const plugin = loaded.factory(() => React)
  const slots = {}
  const tabs = []
  plugin.apply({
    slots: {
      inject: (_, m) => m(),
      register: (meta, component) => {
        slots[meta.name] = slots[meta.name] ?? {}
        slots[meta.name][meta.key ?? meta.id] = component
        return () => {}
      },
    },
    sidebarRightTabs: { register: (meta) => { tabs.push(meta); return () => {} } },
    effect: () => {},
    remote: {},
  })

  const body = slots['sidebar.right.pane.tab']?.['dsh-novel-master/progress']
  const title = slots['sidebar.right.pane.tab.title']?.['dsh-novel-master/progress']
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : !node || typeof node !== 'object' ? [] : [node, ...(node.children ?? []).flatMap(flatten)]
  const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? (node.children ?? []).map(text).join('') : node == null || node === false ? '' : String(node)

  const paint = () => {
    stateIndex = 0
    const tree = body({ sessionId: 's1', useSessions: () => undefined })
    const flat = flatten(tree)
    return { tree, flat, text: text(flat) }
  }

  return { tabs, body, title, paint, requests, slots }
}

test('生成进度页签注册在设定树与生图之间', () => {
  const { tabs, body, title } = mount()
  assert.equal(typeof body, 'function')
  assert.equal(typeof title, 'function')
  const progress = tabs.find((tab) => tab.id === 'dsh-novel-master/progress')
  assert.ok(progress, '进度页签必须注册')
  assert.equal(progress.title(), '生成进度')
  // 顺序：设定树 20 < 进度 21 < 生图 22。进度排在生图前面是因为
  // 「下一步该做什么」比「我已经有什么图」更常看。
  const order = Object.fromEntries(tabs.map((tab) => [tab.id, tab.guide?.[0]?.order]))
  assert.ok(order['dsh-novel-master/atlas'] < order['dsh-novel-master/progress'])
  assert.ok(order['dsh-novel-master/progress'] < order['dsh-novel-master/art'])
})

test('进度面板把后端的完成度、下一步与批量进度都画出来', async () => {
  const canvas = mount()
  canvas.paint()                       // 触发 effect 里的首次加载
  await new Promise((resolve) => setTimeout(resolve, 10))
  const { flat, text } = canvas.paint()

  assert.match(text, /基础资产/u)
  assert.match(text, /5\/8/u, '完成数要显示')
  assert.match(text, /63%/u, '百分比要显示')
  assert.match(text, /下一步/u)
  assert.match(text, /生成大纲/u)
  assert.match(text, /\/novel-outline/u, '下一步要给出可照抄的命令')
  // 五个资产项各自渲染一行
  assert.equal(flat.filter((n) => n.props?.className === 'nm-prog-item').length, 5)
  assert.match(text, /正在写/u)
  assert.match(text, /5 \/ 12 章/u)
  // 进度条宽度来自后端百分比，不是前端自己算的
  const bar = flat.find((n) => n.props?.className === 'nm-prog-bar-fill')
  assert.equal(bar?.props?.style?.width, '42%')
})

test('三种资产状态用不同标记，空文件与未创建要能区分', async () => {
  const canvas = mount()
  canvas.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  const { flat, text } = canvas.paint()
  const states = flat.filter((n) => n.props?.className === 'nm-prog-item').map((n) => n.props['data-state'])
  assert.deepEqual(states, ['done', 'done', 'missing', 'done', 'done'])
  assert.match(text, /未创建/u)
  // 空文件（created 但没内容）既不是 done 也不是 missing
  const empty = mount({
    payload: {
      defaultProject: '书',
      projects: [{
        name: '书', title: '书',
        progress: { chapters: 0, goal: 0, chars: 0 },
        readiness: { done: 0, total: 1, percent: 0, next: 'setting', items: [{ key: 'setting', label: '世界观', exists: false, created: true, headings: 0, chars: 0 }] },
        batch: null,
      }],
    },
  })
  empty.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  const emptyPaint = empty.paint()
  assert.equal(emptyPaint.flat.find((n) => n.props?.className === 'nm-prog-item')?.props['data-state'], 'empty')
  assert.match(emptyPaint.text, /空文件/u)
})

test('没跑过批量写作时不显示批量区块', async () => {
  const canvas = mount({ batch: null })
  canvas.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  const { flat, text } = canvas.paint()
  assert.doesNotMatch(text, /批量写作/u)
  assert.equal(flat.filter((n) => n.props?.className === 'nm-prog-bar').length, 0)
})

test('批量写作超过三分钟没更新时提示可能已中断', async () => {
  const fresh = mount()
  fresh.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.doesNotMatch(fresh.paint().text, /可能已中断/u)

  const stale = mount({ batch: { phase: 'running', phaseLabel: '正在写', done: 2, target: 9, percent: 22, requestSize: 2, lastError: '', updatedAt: '2026-10-19T04:00:00.000Z', staleMs: 600000 } })
  stale.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.match(stale.paint().text, /可能已中断/u)
})

test('出错与空项目都给出可读提示而不是空白面板', async () => {
  const failed = mount({ fetchError: '后端没响应' })
  failed.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.match(failed.paint().text, /读取进度失败/u)

  const none = mount({ payload: { projects: [] } })
  none.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.match(none.paint().text, /还没有小说项目/u)

  const noCwd = mount({ payload: { error: 'no-cwd', message: '无法定位 novel_projects' } })
  noCwd.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.match(noCwd.paint().text, /无法定位 novel_projects/u)
})

test('进度条与环形图都带无障碍标签', async () => {
  const canvas = mount()
  canvas.paint()
  await new Promise((resolve) => setTimeout(resolve, 10))
  const { flat } = canvas.paint()
  const bar = flat.find((n) => n.props?.className === 'nm-prog-bar')
  assert.equal(bar.props.role, 'progressbar')
  assert.equal(bar.props['aria-valuenow'], 42)
  const ring = flat.find((n) => n.props?.className === 'nm-prog-ring')
  assert.equal(ring.props.role, 'img')
  assert.match(ring.props['aria-label'], /63%/u)
})
