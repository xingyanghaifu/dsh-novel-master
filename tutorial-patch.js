// 引导教程功能补丁代码
// 这些代码需要添加到 client.js 的适当位置

// ========== 1. 教程控制函数（添加到 pickDirectory 函数之后）==========

// 检查是否已完成教程
const isTutorialCompleted = () => {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// 标记教程已完成
const markTutorialCompleted = () => {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')
  } catch {}
}

// 打开教程
const openTutorial = () => {
  setTutorialStep(0)
  setShowTutorial(true)
}

// 关闭教程
const closeTutorial = () => {
  setShowTutorial(false)
}

// 下一步
const nextTutorialStep = () => {
  if (tutorialStep < TUTORIAL_STEPS.length - 1) {
    setTutorialStep(tutorialStep + 1)
  } else {
    markTutorialCompleted()
    closeTutorial()
    showToast('教程已完成！')
  }
}

// 上一步
const prevTutorialStep = () => {
  if (tutorialStep > 0) {
    setTutorialStep(tutorialStep - 1)
  }
}

// 跳过教程
const skipTutorial = () => {
  markTutorialCompleted()
  closeTutorial()
  showToast('已跳过教程')
}

// ========== 2. 首次访问检测（修改 useEffect）==========

// 在 useEffect 的 load(controller.signal) 之后添加：
if (!isTutorialCompleted()) {
  setTimeout(() => {
    if (alive.current) openTutorial()
  }, 800)
}

// ========== 3. TutorialModal 组件（添加到 SettingsPage 函数内部，return 之前）==========

const TutorialModal = () => {
  if (!showTutorial) return null
  
  const currentStep = TUTORIAL_STEPS[tutorialStep]
  const isFirst = tutorialStep === 0
  const isLast = tutorialStep === TUTORIAL_STEPS.length - 1
  
  return h('div', { 
    className: 'nm-tutorial-overlay', 
    onClick: closeTutorial 
  },
    h('div', { 
      className: 'nm-tutorial-modal', 
      onClick: e => e.stopPropagation() 
    },
      h('div', { className: 'nm-tutorial-header' },
        h('div', { className: 'nm-tutorial-icon' }, currentStep.icon),
        h('h3', { className: 'nm-tutorial-title' }, currentStep.title),
        h('button', { 
          className: 'nm-tutorial-close', 
          onClick: closeTutorial,
          'aria-label': '关闭'
        }, '✕')
      ),
      h('div', { className: 'nm-tutorial-content' },
        currentStep.content.split('\n').map((line, i) =>
          h('p', { key: i }, line)
        )
      ),
      h('div', { className: 'nm-tutorial-progress' },
        TUTORIAL_STEPS.map((_, i) =>
          h('div', {
            key: i,
            className: 'nm-tutorial-dot' + (i === tutorialStep ? ' active' : '') + (i < tutorialStep ? ' completed' : '')
          })
        )
      ),
      h('div', { className: 'nm-tutorial-footer' },
        h('button', { 
          className: 'nm-tutorial-skip', 
          onClick: skipTutorial 
        }, '跳过教程'),
        h('div', { className: 'nm-tutorial-nav' },
          !isFirst && h('button', { 
            className: 'nm-tutorial-btn', 
            onClick: prevTutorialStep 
          }, '← 上一步'),
          h('button', { 
            className: 'nm-tutorial-btn nm-tutorial-btn-primary', 
            onClick: nextTutorialStep 
          }, isLast ? '完成 ✓' : '下一步 →')
        )
      )
    )
  )
}

// ========== 4. 帮助按钮（添加到 Hero 区域，在 .nm-hero div 内部）==========

h('button', {
  className: 'nm-help-button',
  onClick: openTutorial,
  'aria-label': '查看教程',
  title: '查看教程'
}, '?')

// ========== 5. 渲染教程模态框（添加到主返回的 fragment 数组末尾）==========

h(TutorialModal)

// ========== 6. CSS 样式（添加到 CSS 常量末尾）==========

const TUTORIAL_CSS = `.nm-tutorial-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:grid;place-items:center;z-index:9999;animation:nm-fade-in .2s ease}
.nm-tutorial-modal{background:var(--nm-card);border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:580px;width:90%;max-height:85vh;display:flex;flex-direction:column;animation:nm-slide-up .3s ease}
.nm-tutorial-header{padding:28px 28px 20px;border-bottom:1px solid var(--nm-border);display:flex;align-items:center;gap:14px;position:relative}
.nm-tutorial-icon{font-size:36px;line-height:1}
.nm-tutorial-title{font-size:20px;font-weight:700;margin:0;flex:1}
.nm-tutorial-close{position:absolute;top:20px;right:20px;background:transparent;border:0;color:var(--nm-muted);font-size:24px;cursor:pointer;width:32px;height:32px;border-radius:8px;display:grid;place-items:center;transition:all .2s ease}
.nm-tutorial-close:hover{background:var(--nm-bg);color:var(--nm-text)}
.nm-tutorial-content{padding:28px;overflow-y:auto;flex:1;line-height:1.7}
.nm-tutorial-content p{margin:0 0 14px;white-space:pre-wrap}
.nm-tutorial-content p:last-child{margin:0}
.nm-tutorial-progress{padding:0 28px;display:flex;gap:8px;justify-content:center}
.nm-tutorial-dot{width:8px;height:8px;border-radius:50%;background:var(--nm-border);transition:all .3s ease}
.nm-tutorial-dot.active{background:var(--nm-accent);transform:scale(1.3)}
.nm-tutorial-dot.completed{background:var(--nm-good)}
.nm-tutorial-footer{padding:20px 28px 28px;border-top:1px solid var(--nm-border);display:flex;align-items:center;justify-content:space-between;gap:14px}
.nm-tutorial-skip{background:transparent;border:0;color:var(--nm-muted);cursor:pointer;font-size:13px;padding:10px 16px;border-radius:10px;transition:all .2s ease}
.nm-tutorial-skip:hover{background:var(--nm-bg);color:var(--nm-text)}
.nm-tutorial-nav{display:flex;gap:10px}
.nm-tutorial-btn{background:var(--nm-bg);border:1px solid var(--nm-border);color:var(--nm-text);cursor:pointer;font-size:13px;font-weight:550;padding:10px 20px;border-radius:10px;transition:all .2s ease}
.nm-tutorial-btn:hover{background:var(--nm-raised);border-color:var(--nm-border-glow)}
.nm-tutorial-btn-primary{background:var(--nm-accent);border-color:var(--nm-accent);color:white}
.nm-tutorial-btn-primary:hover{background:color-mix(in srgb,var(--nm-accent) 90%,black);transform:translateY(-1px)}
.nm-help-button{position:absolute;top:28px;right:28px;background:var(--nm-accent);color:white;border:0;border-radius:50%;width:40px;height:40px;font-size:20px;font-weight:700;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,0.15);transition:all .2s ease;z-index:10}
.nm-help-button:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(0,0,0,0.25)}
@keyframes nm-fade-in{from{opacity:0}}
@keyframes nm-slide-up{from{transform:translateY(30px);opacity:0}}`
