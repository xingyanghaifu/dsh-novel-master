# 引导教程功能完整实现方案

## 📋 实施概览

**目标**: 在客户端添加完整的引导教程功能，帮助用户快速了解插件功能

**实现方式**: 
1. 在 `client.js` 中添加教程状态和控制函数
2. 创建教程模态框 UI 组件（React）
3. 添加帮助按钮到 Hero 区域
4. 使用 LocalStorage 存储用户偏好
5. 首次访问自动显示教程

---

## 🎯 核心功能

### 1. 教程数据结构 ✅

已完成 - 5 个教程步骤：
- 欢迎使用小说创作大师
- 引导-写作分离架构
- 学习总结功能
- AI 决策助手
- 快速开始

### 2. 状态管理

**新增状态**:
```javascript
const [showTutorial, setShowTutorial] = useState(false)
const [tutorialStep, setTutorialStep] = useState(0)
```

**已添加** ✅

### 3. LocalStorage 逻辑

**存储键**: `novel-master-tutorial-completed`

**函数**:
```javascript
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

// 重置教程状态
const resetTutorial = () => {
  try {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY)
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
```

### 4. 教程 UI 组件

**TutorialModal 组件**:
```javascript
function TutorialModal({ step, onNext, onPrev, onSkip, onClose }) {
  const currentStep = TUTORIAL_STEPS[step]
  const isFirst = step === 0
  const isLast = step === TUTORIAL_STEPS.length - 1
  
  return h('div', { className: 'nm-tutorial-overlay', onClick: onClose },
    h('div', { className: 'nm-tutorial-modal', onClick: e => e.stopPropagation() },
      // 头部
      h('div', { className: 'nm-tutorial-header' },
        h('div', { className: 'nm-tutorial-icon' }, currentStep.icon),
        h('h3', { className: 'nm-tutorial-title' }, currentStep.title),
        h('button', { 
          className: 'nm-tutorial-close', 
          onClick: onClose,
          'aria-label': '关闭'
        }, '✕')
      ),
      
      // 内容
      h('div', { className: 'nm-tutorial-content' },
        currentStep.content.split('\n').map((line, i) =>
          h('p', { key: i }, line)
        )
      ),
      
      // 进度指示器
      h('div', { className: 'nm-tutorial-progress' },
        TUTORIAL_STEPS.map((_, i) =>
          h('div', {
            key: i,
            className: 'nm-tutorial-dot' + (i === step ? ' active' : '') + (i < step ? ' completed' : '')
          })
        )
      ),
      
      // 底部按钮
      h('div', { className: 'nm-tutorial-footer' },
        h('button', { 
          className: 'nm-tutorial-skip', 
          onClick: onSkip 
        }, '跳过教程'),
        h('div', { className: 'nm-tutorial-nav' },
          !isFirst && h('button', { 
            className: 'nm-tutorial-btn', 
            onClick: onPrev 
          }, '← 上一步'),
          h('button', { 
            className: 'nm-tutorial-btn nm-tutorial-btn-primary', 
            onClick: onNext 
          }, isLast ? '完成 ✓' : '下一步 →')
        )
      )
    )
  )
}
```

### 5. 帮助按钮

**位置**: Hero 区域右上角

**代码**:
```javascript
h('button', {
  className: 'nm-help-button',
  onClick: openTutorial,
  'aria-label': '查看教程',
  title: '查看教程'
}, '?')
```

### 6. CSS 样式

**新增样式**:
```css
.nm-tutorial-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:grid;place-items:center;z-index:9999;animation:nm-fade-in .2s ease}
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
.nm-help-button{position:absolute;top:28px;right:28px;background:var(--nm-accent);color:white;border:0;border-radius:50%;width:40px;height:40px;font-size:20px;font-weight:700;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,0.15);transition:all .2s ease}
.nm-help-button:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(0,0,0,0.25)}
@keyframes nm-fade-in{from{opacity:0}}
@keyframes nm-slide-up{from{transform:translateY(30px);opacity:0}}
```

### 7. 首次访问检测

**在 useEffect 中添加**:
```javascript
useEffect(() => {
  alive.current = true
  const controller = new AbortController()
  load(controller.signal)
  
  // 检查是否首次访问
  if (!isTutorialCompleted()) {
    setTimeout(() => {
      if (alive.current) openTutorial()
    }, 800) // 延迟 800ms 显示教程
  }
  
  return () => { 
    alive.current = false
    controller.abort()
    operation.current?.abort()
    activityRequest.current?.abort()
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }
}, [])
```

---

## 📝 实施步骤

### Step 1: 添加教程控制函数 ✅
已在方案中定义

### Step 2: 创建 TutorialModal 组件
需要在 SettingsPage 组件内部添加

### Step 3: 添加帮助按钮
在 Hero 区域添加按钮

### Step 4: 添加 CSS 样式
在 CSS 常量中添加新样式

### Step 5: 集成到主渲染逻辑
在主返回语句中条件渲染教程模态框

### Step 6: 测试
- 首次访问自动显示
- 步骤导航正常
- LocalStorage 正常存储
- 帮助按钮正常工作

---

## 🎯 完成标准

- ✅ 教程数据结构定义
- ✅ 教程状态管理
- ⏳ 教程控制函数
- ⏳ 教程 UI 组件
- ⏳ 帮助按钮
- ⏳ CSS 样式
- ⏳ 首次访问自动显示
- ⏳ 测试验证
- ⏳ 提交并推送到 GitHub

---

## 💡 用户体验流程

1. **首次访问**: 
   - 页面加载完成 800ms 后自动显示教程
   - 用户可以选择观看或跳过

2. **观看教程**:
   - 5 个步骤依次展示
   - 每步包含图标、标题、详细说明
   - 底部显示进度指示器
   - 可以前进、后退或跳过

3. **完成教程**:
   - 最后一步点击"完成"
   - 标记为已完成，下次不再自动显示
   - 显示提示消息

4. **随时查看**:
   - Hero 区域右上角帮助按钮（?）
   - 点击重新打开教程
   - 从第一步开始

---

## 🔧 技术细节

**React Hooks 使用**:
- `useState` - 管理教程状态
- `useEffect` - 检测首次访问
- `useRef` - 不需要（使用现有 alive ref）

**LocalStorage**:
- 键：`novel-master-tutorial-completed`
- 值：`'true'` 表示已完成
- 错误处理：try-catch 包裹所有 localStorage 操作

**样式**:
- 使用现有 CSS 变量
- 响应式设计（max-width: 90%）
- 流畅动画（fade-in, slide-up）
- 高对比度按钮

**可访问性**:
- 适当的 aria-label
- 键盘导航支持（通过按钮）
- 高对比度文本
- 清晰的焦点状态

---

## 📌 下一步行动

由于实现较复杂，建议：

1. **方案 A（推荐）**: 我一次性完成所有修改，包括：
   - 添加所有控制函数
   - 创建完整的 UI 组件
   - 添加 CSS 样式
   - 集成到主组件
   - 测试并提交

2. **方案 B**: 分步实现，每个步骤单独提交

请告诉我您的选择，或者直接发送空消息让我采用方案 A（一次性完成）。
