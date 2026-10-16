# 小说创作大师 - 引导教程修复与功能介绍方案

## 问题分析

### 崩溃问题定位

**问题根源**：
1. `refresh()` 函数调用 `load()` 时没有传递 AbortController signal
2. 组件卸载后，异步操作可能仍然尝试更新已卸载组件的状态
3. `loadModels` 异步调用缺少组件生命周期检查

**修复方案**：
```javascript
// 修复前（第 260 行）
async function refresh() { setError(''); await load() }

// 修复后
async function refresh(signal) { 
  if (!alive.current) return
  setError(''); 
  await load(signal ?? new AbortController().signal) 
}

// 修复前（第 268 行）
if (alive.current) { await refresh(); if (alive.current) setError(`保存失败：${reason.message}`) }

// 修复后
if (alive.current) { 
  const refreshController = new AbortController()
  await refresh(refreshController.signal)
  if (alive.current) setError(`保存失败：${reason.message}`) 
}
```

### 引导教程设计

**功能需求**：
1. 首次使用时自动显示引导教程
2. 可以随时重新查看教程
3. 教程内容包含各功能的介绍和使用说明
4. 支持分步骤引导
5. 支持跳过教程

**UI 设计**：
- 教程模态框（Modal）
- 分步骤内容（Step by Step）
- 进度指示器
- 上一步/下一步/跳过按钮
- "不再显示"选项

**教程内容结构**：
1. 欢迎页 - 介绍插件功能
2. 功能选择 - 引导模型、学习总结、决策助手
3. 基本配置 - 项目目录、更新设置
4. 快速开始 - 常用命令示例
5. 高级功能 - 引导-写作分离详解

## 实现方案

### 1. 修复崩溃问题

**文件**: `client.js`

**修改位置**:
- 第 260 行：修复 `refresh()` 函数
- 第 268 行：传递 signal 到 `refresh()`
- 第 242 行：增强 `load()` 函数的生命周期检查
- 第 201 行：增强 `loadModels()` 函数的生命周期检查

### 2. 添加引导教程功能

**新增状态**:
```javascript
const [showTutorial, setShowTutorial] = useState(false)
const [tutorialStep, setTutorialStep] = useState(0)
const [neverShowTutorial, setNeverShowTutorial] = useState(false)
```

**教程数据结构**:
```javascript
const TUTORIAL_STEPS = [
  {
    title: '欢迎使用小说创作大师',
    content: '这是一个强大的 AI 辅助小说创作插件...',
    image: '📚',
  },
  {
    title: '引导-写作分离',
    content: '使用强模型（如 Claude Opus）引导规划，快速模型（如 Gemini Flash）执行写作...',
    image: '🎯',
  },
  // ... 更多步骤
]
```

**新增组件**:
```javascript
function TutorialModal({ step, onNext, onPrev, onSkip, onClose }) {
  // 教程模态框组件
}
```

**LocalStorage 存储**:
```javascript
// 存储用户的"不再显示"偏好
const TUTORIAL_KEY = 'novel-master-tutorial-completed'
```

### 3. 添加帮助按钮

**位置**: Hero 区域右上角

**功能**: 点击显示教程

**样式**:
```css
.nm-help-button {
  position: absolute;
  top: 20px;
  right: 20px;
  background: var(--nm-accent);
  color: white;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
}
```

## 测试验证

### 崩溃修复测试
1. ✅ 打开插件设置页
2. ✅ 执行 `/novel-update apply`
3. ✅ 刷新插件设置页
4. ✅ 验证 DSH 不崩溃
5. ✅ 验证配置正常加载

### 教程功能测试
1. ✅ 首次打开自动显示教程
2. ✅ 点击"下一步"切换步骤
3. ✅ 点击"上一步"返回
4. ✅ 点击"跳过"关闭教程
5. ✅ 勾选"不再显示"后再次打开不显示
6. ✅ 点击帮助按钮重新显示教程

## 实施步骤

1. **修复崩溃问题** (优先级：高)
   - 修改 `refresh()` 函数
   - 修改 `load()` 和 `loadModels()` 函数
   - 添加生命周期检查

2. **添加教程数据** (优先级：中)
   - 定义教程步骤内容
   - 准备功能说明文案
   - 设计教程流程

3. **实现教程 UI** (优先级：中)
   - 创建教程模态框组件
   - 添加帮助按钮
   - 实现状态管理

4. **测试验证** (优先级：高)
   - 测试崩溃修复
   - 测试教程功能
   - 测试跨浏览器兼容性

## 预期效果

### 崩溃修复
- ✅ 刷新插件页不再导致 DSH 崩溃
- ✅ 异步操作正确处理组件卸载
- ✅ 用户体验流畅稳定

### 引导教程
- ✅ 新用户能快速了解插件功能
- ✅ 老用户能随时查看帮助
- ✅ 降低学习成本
- ✅ 提升用户满意度
