/**
 * client-components.js
 * UI 组件层
 * 负责：可复用组件、渲染逻辑、用户交互
 */

/**
 * 基础表单字段
 */
export function field(h, label, key, draft, edit, type = 'text', props = {}, locked = false) {
  return h('label', { className: 'nm-field' },
    h('span', null, label),
    h('input', {
      type,
      value: draft[key],
      disabled: locked,
      'aria-label': label,
      ...props,
      onChange: event => edit(key, event.target.value)
    })
  )
}

/**
 * 开关组件
 */
export function toggle(h, label, checked, onChange, description, aria = label, locked = false) {
  return h('label', { className: 'nm-switch' },
    h('span', { className: 'nm-switchcopy' },
      h('strong', null, label),
      description && h('small', null, description)
    ),
    h('input', {
      type: 'checkbox',
      role: 'switch',
      'aria-label': aria,
      checked,
      disabled: locked,
      onChange: event => onChange(event.target.checked)
    }),
    h('i', { className: 'nm-track', 'aria-hidden': true })
  )
}

/**
 * 复选框（基于 toggle）
 */
export function check(h, label, key, draft, edit, description, locked = false) {
  return toggle(h, label, draft[key] === true, next => edit(key, next), description, label, locked)
}

/**
 * 卡片容器
 */
export function card(h, title, description, ...children) {
  return h('div', { className: 'nm-card' },
    h('div', null,
      h('h3', null, title),
      description && h('p', { className: 'nm-muted' }, description)
    ),
    ...children
  )
}

/**
 * 操作按钮
 */
export function actionButton(h, label, onClick, disabled = false, primary = false) {
  return h('button', {
    type: 'button',
    onClick,
    disabled,
    className: primary ? 'nm-primary' : ''
  }, label)
}

/**
 * 保存栏（带脏数据提示）
 */
export function saveBar(h, section, label, dirtyRef, busy, disabled = false, locked = false) {
  return h('div', { className: 'nm-savebar' },
    h('span', {
      className: dirtyRef[section] ? 'nm-dirty' : 'nm-muted'
    }, dirtyRef[section] ? '● 有未保存的修改' : '✓ 配置已同步'),
    h('button', {
      type: 'submit',
      className: 'nm-primary',
      disabled: locked || disabled
    }, busy === 'save' ? '正在保存…' : label)
  )
}

/**
 * 面板容器（用于标签页）
 */
export function panel(h, id, tab, ...children) {
  return h('section', {
    id: `nm-panel-${id}`,
    role: 'tabpanel',
    'aria-labelledby': `nm-tab-${id}`,
    hidden: tab !== id,
    className: 'nm-stack',
    tabIndex: 0
  }, ...children)
}

/**
 * 状态芯片
 */
export function chip(h, label, on) {
  return h('span', {
    className: 'nm-chip',
    'data-on': on === true
  }, h('i', { 'aria-hidden': true }), label)
}

/**
 * 模型选择器
 */
export function renderModelSelect(h, label, currentProvider, currentModel, onSelect, availableModels, locked, showToast, isSummary = false) {
  const curKey = currentProvider && currentModel ? `${currentProvider}::${currentModel}` : ''
  const isCustom = curKey && !availableModels.some(m => `${m.provider}::${m.model}` === curKey)
  
  return h('div', { className: 'nm-field', style: { marginBottom: '6px' } },
    h('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      label,
      h('small', { className: 'nm-muted' },
        isCustom
          ? '当前选用自定义模型'
          : `已实时发现 ${availableModels.length} 个 DSH 可用模型`
      )
    ),
    h('select', {
      className: 'nm-select',
      value: curKey,
      disabled: locked,
      'aria-label': `${label}选择器`,
      onChange: event => {
        const val = event.target.value
        if (!val) {
          onSelect('', '')
          showToast('已选用：跟随来源 (默认)')
        } else {
          const [p, m] = val.split('::')
          onSelect(p, m)
          const target = availableModels.find(x => x.provider === p && x.model === m)
          showToast(`已选用：${target?.label || m}`)
        }
      }
    },
      isSummary && h('option', { value: '' }, '✨ 跟随来源 (默认，不指定独立模型)'),
      !isSummary && h('option', { value: '', disabled: true }, '-- 请在现有模型列表中选择 --'),
      isCustom && h('option', { value: curKey }, `⚙️ 当前配置：${currentProvider} / ${currentModel}`),
      ...availableModels.map(m => h('option', {
        key: `${m.provider}::${m.model}`,
        value: `${m.provider}::${m.model}`
      }, m.label || `${m.provider} / ${m.model}`))
    )
  )
}

/**
 * 推理强度选择器
 */
export function renderReasoningSelect(h, label, currentEffort, onSelectEffort, provider, model, availableModels, locked, showToast) {
  const curEff = currentEffort || ''
  const targetModel = availableModels.find(x => x.provider === provider && x.model === model)
  const efforts = targetModel?.efforts || []
  const hasCustomEffort = curEff && !['', 'low', 'medium', 'high', 'extra_high'].includes(curEff) && !efforts.some(e => e.id === curEff)
  
  return h('div', { className: 'nm-field' },
    h('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      label,
      h('small', { className: 'nm-muted' },
        efforts.length ? `模型已声明 ${efforts.length} 档思考等级` : '留空使用默认强度'
      )
    ),
    h('select', {
      className: 'nm-select',
      value: curEff,
      disabled: locked,
      'aria-label': `${label}选择器`,
      onChange: event => {
        const val = event.target.value
        onSelectEffort(val)
        showToast(val ? `思考强度已切换为：${val}` : '思考强度已切换为：默认强度')
      }
    },
      h('option', { value: '' }, '⚡ 默认思考强度 (Default)'),
      h('option', { value: 'low' }, '🌱 低思考强度 (Low · 极速响应)'),
      h('option', { value: 'medium' }, '⚖️ 中等思考强度 (Medium · 平衡)'),
      h('option', { value: 'high' }, '🧠 高深度思考 (High · 严密推演)'),
      h('option', { value: 'extra_high' }, '🔥 极限思考模式 (Extra High)'),
      hasCustomEffort && h('option', { value: curEff }, `⚙️ 自定义强度：${curEff}`),
      ...efforts.filter(e => !['low', 'medium', 'high', 'extra_high'].includes(e.id)).map(e =>
        h('option', { key: e.id, value: e.id }, `💡 ${e.name || e.id}`)
      )
    )
  )
}

/**
 * 工作台流水线卡片
 */
export function workbenchCard(h, form, PIPELINE_STEPS, QUICK_ACTIONS, copyCommand) {
  if (!form) return null
  
  return card(h, '创作流水线工作台', '标准网文创作五阶段流转，点击指令代码可快速复制使用。',
    h('div', { className: 'nm-workbench-pipeline' },
      ...PIPELINE_STEPS.map(item => h('div', { className: 'nm-pipeline-step', key: item.step },
        h('span', { className: 'nm-pipeline-badge' }, `阶段 ${item.step}`),
        h('div', { className: 'nm-pipeline-title' }, item.title),
        h('div', { className: 'nm-pipeline-desc' }, item.desc),
        h('code', {
          className: 'nm-inlinecode',
          onClick: () => copyCommand(item.cmd),
          title: '点击复制指令'
        }, item.cmd)
      ))
    ),
    h('div', { className: 'nm-quick-grid' },
      ...QUICK_ACTIONS.map(item => h('div', {
        className: 'nm-quick-card',
        key: item.label,
        onClick: () => copyCommand(item.cmd)
      },
        h('div', null,
          h('strong', { style: { display: 'block', marginBottom: '3px' } }, item.label),
          h('span', { className: 'nm-muted' }, item.desc)
        ),
        h('code', { className: 'nm-inlinecode' }, '复制')
      ))
    )
  )
}

/**
 * 智能活动面板
 */
export function activityPanel(h, activity, activityError, activityBusy, readActivity, actionButton, chip, locked) {
  return h('div', { className: 'nm-card' },
    h('div', { className: 'nm-cardhead' },
      h('div', null,
        h('h3', null, '智能活动'),
        h('p', { className: 'nm-muted' }, '按需读取实际运行状态，不推测当前模型。')
      ),
      actionButton(h, activityBusy ? '正在读取活动…' : '读取学习与决策活动', readActivity, locked)
    ),
    activityError && h('p', { role: 'alert', className: 'nm-alert' }, activityError),
    activity
      ? h('div', { role: 'status', className: 'nm-stack' },
          h('div', { className: 'nm-row' },
            chip(h, `学习：${activity.learningEnabled === true ? '启用' : activity.learningEnabled === false ? '关闭' : '未知'}`, activity.learningEnabled),
            chip(h, `决策：${activity.decisionEnabled === true ? '启用' : activity.decisionEnabled === false ? '关闭' : '未知'}`, activity.decisionEnabled)
          ),
          h('p', { className: 'nm-muted' }, `配置存储地址：${activity.storageDir ?? '未返回'}；最近实际目录：${activity.location ?? '尚未访问'}`),
          h('p', { className: 'nm-muted' }, `跟踪会话：${activity.trackedSessions ?? '未返回'}；活动任务：${activity.activeJobs ?? '未返回'}；本次运行写入：${activity.recordsWrittenThisRun ?? '未返回'}`),
          activity.lastError && h('p', { role: 'alert' }, `最近错误：${activity.lastError}`)
        )
      : h('p', { className: 'nm-muted' }, '尚未读取。使用 /novel-memory 可查询已保存的经验。')
  )
}
