/**
 * Guidance-Writing Separation Architecture
 * 
 * 引导模型负责：
 * - 分析当前项目状态与上下文
 * - 拆解任务为详细的执行步骤
 * - 生成精确的写作大纲与要求
 * - 指定关键情节点与伏笔
 * 
 * 写作模型负责：
 * - 接收引导模型的详细指令
 * - 专注于文字生成
 * - 不需要具备强大的规划能力
 */

import { readIntelligenceField } from './intelligence.js'

const VOLATILE = Symbol.for('cosmokit.volatile.write')

/**
 * 读取引导配置
 * @param {object} config - 插件配置对象
 * @returns {object} 引导配置
 */
export function readGuidanceConfig(config) {
  const guidance = config?.guidance
  if (!guidance) return { enabled: false }
  
  return {
    enabled: readIntelligenceField(guidance, 'enabled', false) === true,
    provider: readIntelligenceField(guidance, 'provider', ''),
    model: readIntelligenceField(guidance, 'model', ''),
    reasoningEffort: readIntelligenceField(guidance, 'reasoningEffort', ''),
    writingProvider: readIntelligenceField(guidance, 'writingProvider', ''),
    writingModel: readIntelligenceField(guidance, 'writingModel', ''),
    writingReasoningEffort: readIntelligenceField(guidance, 'writingReasoningEffort', ''),
    guidanceStyle: readIntelligenceField(guidance, 'guidanceStyle', 'detailed'),
  }
}

/**
 * 构建引导系统提示词
 * @param {string} style - 引导风格：concise/detailed/verbose
 * @param {string} taskType - 任务类型：novel/chapter/rewrite/outline等
 * @returns {string} 系统提示词
 */
export function buildGuidanceSystem(style = 'detailed', taskType = 'chapter') {
  const base = `你是小说创作引导专家。你的任务是分析当前项目状态、拆解创作任务、生成详细的写作大纲与执行指令。

你的输出将交给写作模型执行，因此需要：
1. 明确章节目标与情节转折点
2. 列出关键场景与人物动作
3. 指定需要铺垫的伏笔与设定
4. 提供具体的情感基调与节奏要求`

  const styleGuides = {
    concise: `
【输出要求·简明模式】
- 输出格式：JSON 结构化大纲
- 包含：章节目标、关键场景列表（3-5个）、情感基调
- 适合：GPT-4、Claude、DeepSeek-R1 等强写作模型`,
    
    detailed: `
【输出要求·详细模式（推荐）】
- 输出格式：Markdown 结构化大纲 + 执行清单
- 包含：
  * 章节定位与承上启下
  * 场景序列（5-8个场景，每个场景含地点/人物/动作/对话要点）
  * 情感曲线与节奏控制
  * 伏笔铺设与回收提示
  * 人物状态变化
- 适合：通用场景，平衡质量与可控性`,
    
    verbose: `
【输出要求·极详细模式】
- 输出格式：完整分镜脚本 + 示例片段
- 包含：
  * 逐场景拆解（8-12个场景）
  * 每个场景的开场/转折/结尾示例
  * 对话参考样例（3-5条）
  * 描写风格参考
  * 避坑提示（常见问题与解决方案）
- 适合：Gemini Flash、弱写作模型，需要详细指导`
  }

  const taskGuides = {
    novel: '任务是完整长篇小说的第一章创作，需要建立世界观、引入主角、设置核心冲突。',
    chapter: '任务是续写指定章节，需要承接前文、推进剧情、埋下伏笔。',
    rewrite: '任务是改写现有章节，需要保持剧情主线、提升表达质量、优化节奏。',
    outline: '任务是生成完整大纲，需要设计故事结构、规划章节节奏、布局冲突升级。',
    cast: '任务是建立角色档案，需要设计人物背景、性格特点、成长弧线。',
  }

  return `${base}

${styleGuides[style] || styleGuides.detailed}

${taskGuides[taskType] || taskGuides.chapter}

【关键原则】
- 你的输出是"指令"，不是"成品"，写作模型会基于你的指令完成文字生成
- 保持结构化，避免散文式描述
- 明确"必须"与"建议"，让写作模型有执行依据`
}

/**
 * 构建引导提示词（用户消息）
 * @param {object} context - 上下文信息
 * @param {string} context.projectName - 项目名称
 * @param {string} context.outline - 大纲内容
 * @param {string} context.cast - 角色设定
 * @param {string} context.world - 世界状态
 * @param {string} context.previousChapter - 上一章内容
 * @param {number} context.targetChapter - 目标章节号
 * @param {string} context.userRequest - 用户原始请求
 * @returns {string} 用户消息
 */
export function buildGuidancePrompt(context = {}) {
  const parts = []
  
  parts.push(`【任务】生成第 ${context.targetChapter || '?'} 章的详细写作大纲与执行指令`)
  
  if (context.projectName) {
    parts.push(`\n【项目】${context.projectName}`)
  }
  
  if (context.outline) {
    parts.push(`\n【总纲】\n${context.outline.slice(0, 2000)}`)
  }
  
  if (context.cast) {
    parts.push(`\n【角色档案】\n${context.cast.slice(0, 1500)}`)
  }
  
  if (context.world) {
    parts.push(`\n【世界状态】\n${context.world.slice(0, 1000)}`)
  }
  
  if (context.previousChapter) {
    parts.push(`\n【上一章回顾】\n${context.previousChapter.slice(0, 1000)}`)
  }
  
  if (context.userRequest) {
    parts.push(`\n【用户要求】\n${context.userRequest}`)
  }
  
  parts.push(`\n请基于以上信息，生成详细的写作大纲。`)
  
  return parts.join('\n')
}

/**
 * 构建写作模型的系统提示词（接收引导）
 * @param {string} guidanceOutput - 引导模型的输出
 * @returns {string} 写作系统提示词
 */
export function buildWritingSystemWithGuidance(guidanceOutput) {
  return `你是小说写作执行者。你将收到一份详细的写作大纲与执行指令，请严格按照指令完成文字创作。

【引导大纲】
${guidanceOutput}

【执行要求】
1. 严格遵循大纲中的场景序列与情节点
2. 保持人物性格与设定一致
3. 控制节奏与情感基调
4. 自然铺设伏笔，不生硬暴露
5. 对话真实自然，符合角色口吻
6. 场景描写生动，有画面感

【输出格式】
- 直接输出章节正文，不需要章节号或标题
- 使用自然段分割
- 字数控制在大纲指定范围内（通常 2000-3000 字）

现在开始创作：`
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      guidanceTime: 0,
      writingTime: 0,
      totalTime: 0,
      guidanceTokens: 0,
      writingTokens: 0,
    }
  }

  startGuidance() {
    this._guidanceStart = Date.now()
  }

  endGuidance(tokens = 0) {
    if (this._guidanceStart) {
      this.metrics.guidanceTime = Date.now() - this._guidanceStart
      this.metrics.guidanceTokens = tokens
      delete this._guidanceStart
    }
  }

  startWriting() {
    this._writingStart = Date.now()
  }

  endWriting(tokens = 0) {
    if (this._writingStart) {
      this.metrics.writingTime = Date.now() - this._writingStart
      this.metrics.writingTokens = tokens
      delete this._writingStart
    }
  }

  getMetrics() {
    this.metrics.totalTime = this.metrics.guidanceTime + this.metrics.writingTime
    return { ...this.metrics }
  }

  formatReport() {
    const m = this.getMetrics()
    return `
【性能报告】
- 引导模型耗时: ${(m.guidanceTime / 1000).toFixed(2)}s (${m.guidanceTokens} tokens)
- 写作模型耗时: ${(m.writingTime / 1000).toFixed(2)}s (${m.writingTokens} tokens)
- 总耗时: ${(m.totalTime / 1000).toFixed(2)}s
    `.trim()
  }
}

/**
 * 调用引导模型生成大纲
 * @param {object} options - 调用选项
 * @returns {Promise<{text: string, tokens: number}>}
 */
async function generateGuidance(options) {
  const { guidanceConfig, context, taskType, callGuidanceModel, monitor, onProgress } = options
  
  if (onProgress) onProgress('引导模型正在分析项目状态与上下文...')
  
  const guidanceSystem = buildGuidanceSystem(guidanceConfig.guidanceStyle, taskType)
  const guidancePrompt = buildGuidancePrompt(context)
  
  monitor?.startGuidance()
  
  try {
    const result = await callGuidanceModel({
      provider: guidanceConfig.provider,
      model: guidanceConfig.model,
      reasoningEffort: guidanceConfig.reasoningEffort || undefined,
      system: guidanceSystem,
      prompt: guidancePrompt,
    })
    
    const text = result.text || result.content || String(result)
    const tokens = result.usage?.total_tokens || result.tokens || 0
    
    monitor?.endGuidance(tokens)
    
    if (onProgress) onProgress('引导模型已生成详细写作大纲')
    
    return { text, tokens }
  } catch (error) {
    monitor?.endGuidance(0)
    throw error
  }
}

/**
 * 调用写作模型生成内容
 * @param {object} options - 调用选项
 * @returns {Promise<{text: string, tokens: number}>}
 */
async function generateContent(options) {
  const { guidanceOutput, guidanceConfig, context, callWritingModel, monitor, onProgress } = options
  
  if (onProgress) onProgress('写作模型正在根据大纲生成章节文字...')
  
  const writingSystem = buildWritingSystemWithGuidance(guidanceOutput)
  
  // 确定写作模型路由
  const writingProvider = guidanceConfig.writingProvider || context.sessionProvider
  const writingModel = guidanceConfig.writingModel || context.sessionModel
  
  if (!writingProvider || !writingModel) {
    throw new Error('写作模型未指定，且无法从会话推断')
  }
  
  monitor?.startWriting()
  
  try {
    const result = await callWritingModel({
      provider: writingProvider,
      model: writingModel,
      reasoningEffort: guidanceConfig.writingReasoningEffort || undefined,
      system: writingSystem,
      prompt: context.writingPrompt || '请按照大纲要求完成本章创作。',
    })
    
    const text = result.text || result.content || String(result)
    const tokens = result.usage?.total_tokens || result.tokens || 0
    
    monitor?.endWriting(tokens)
    
    if (onProgress) onProgress('章节生成完成')
    
    return { text, tokens }
  } catch (error) {
    monitor?.endWriting(0)
    throw error
  }
}

/**
 * 执行引导-写作流程（带降级策略）
 * @param {object} options - 执行选项
 * @param {object} options.context - 项目上下文
 * @param {object} options.guidanceConfig - 引导配置
 * @param {function} options.callGuidanceModel - 调用引导模型的函数
 * @param {function} options.callWritingModel - 调用写作模型的函数
 * @param {function} options.fallbackToSingleModel - 降级到单模型的函数
 * @param {function} options.onProgress - 进度回调函数
 * @param {string} options.taskType - 任务类型
 * @returns {Promise<{guidance: string, content: string, metrics: object, usedFallback: boolean}>}
 */
export async function executeGuidedWriting(options) {
  const {
    context,
    guidanceConfig,
    callGuidanceModel,
    callWritingModel,
    fallbackToSingleModel,
    onProgress,
    taskType = 'chapter'
  } = options
  
  // 验证配置
  if (!guidanceConfig.enabled || !guidanceConfig.provider || !guidanceConfig.model) {
    throw new Error('引导模型未正确配置')
  }
  
  const monitor = new PerformanceMonitor()
  
  try {
    // 步骤1：调用引导模型生成大纲
    const guidanceResult = await generateGuidance({
      guidanceConfig,
      context,
      taskType,
      callGuidanceModel,
      monitor,
      onProgress,
    })
    
    // 步骤2：调用写作模型生成内容
    const contentResult = await generateContent({
      guidanceOutput: guidanceResult.text,
      guidanceConfig,
      context,
      callWritingModel,
      monitor,
      onProgress,
    })
    
    return {
      guidance: guidanceResult.text,
      content: contentResult.text,
      metrics: monitor.getMetrics(),
      usedFallback: false,
    }
  } catch (error) {
    // 降级策略：如果引导模型失败，回退到单模型模式
    if (fallbackToSingleModel && typeof fallbackToSingleModel === 'function') {
      if (onProgress) {
        onProgress(`引导模型调用失败（${error.message}），自动降级为单模型模式...`)
      }
      
      try {
        const fallbackResult = await fallbackToSingleModel(context)
        return {
          guidance: null,
          content: fallbackResult.text || fallbackResult.content || String(fallbackResult),
          metrics: monitor.getMetrics(),
          usedFallback: true,
          fallbackReason: error.message,
        }
      } catch (fallbackError) {
        throw new Error(`引导模型和单模型均失败：${error.message} | ${fallbackError.message}`)
      }
    }
    
    throw error
  }
}

import fs from 'node:fs'
import path from 'node:path'

/**
 * 保存引导大纲到项目目录
 * @param {string} projectDir - 项目目录
 * @param {number} chapterNumber - 章节号
 * @param {string} guidanceContent - 引导大纲内容
 * @returns {string} 保存的文件路径
 */
export function saveGuidanceOutline(projectDir, chapterNumber, guidanceContent) {
  
  const guidanceDir = path.join(projectDir, '引导大纲')
  
  // 确保引导大纲目录存在
  if (!fs.existsSync(guidanceDir)) {
    fs.mkdirSync(guidanceDir, { recursive: true })
  }
  
  const filename = `第${chapterNumber}章-大纲.md`
  const filepath = path.join(guidanceDir, filename)
  
  // 添加元数据头部
  const metadata = `# 第${chapterNumber}章 引导大纲

生成时间: ${new Date().toLocaleString('zh-CN')}

---

${guidanceContent}
`
  
  fs.writeFileSync(filepath, metadata, 'utf8')
  
  return filepath
}
