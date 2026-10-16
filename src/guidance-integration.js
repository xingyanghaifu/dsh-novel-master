/**
 * 引导-写作分离功能的命令集成层
 * 
 * 这个模块负责将引导功能集成到小说创作命令中
 */

import fs from 'node:fs'
import path from 'node:path'
import { readGuidanceConfig, executeGuidedWriting, saveGuidanceOutline } from './guidance.js'
import { projectDir, CHAPTER_DIR } from './project.js'
import { withProjectsDirectory } from './project.js'

/**
 * 检查是否应该使用引导模型
 * @param {object} config - 插件配置
 * @returns {boolean}
 */
export function shouldUseGuidance(config) {
  const guidanceConfig = readGuidanceConfig(config)
  return !!(guidanceConfig.enabled && guidanceConfig.provider && guidanceConfig.model)
}

/**
 * 读取项目上下文信息
 * @param {string} cwd - 当前工作目录
 * @param {string} projectName - 项目名称
 * @param {number} targetChapter - 目标章节号
 * @param {string} projectsDirectory - 项目根目录
 * @returns {object} 项目上下文
 */
export function readProjectContext(cwd, projectName, targetChapter, projectsDirectory) {
  const root = withProjectsDirectory(projectsDirectory, () => projectDir(cwd, projectName))
  const context = {
    projectName,
    targetChapter,
    outline: '',
    cast: '',
    world: '',
    previousChapter: '',
    userRequest: '',
  }

  // 读取大纲
  try {
    const outlinePath = path.join(root, '大纲.md')
    if (fs.existsSync(outlinePath)) {
      context.outline = fs.readFileSync(outlinePath, 'utf8')
    }
  } catch (error) {
    // 大纲不存在或读取失败，继续
  }

  // 读取角色设定
  try {
    const castPath = path.join(root, '角色.md')
    if (fs.existsSync(castPath)) {
      context.cast = fs.readFileSync(castPath, 'utf8')
    }
  } catch (error) {
    // 角色设定不存在或读取失败，继续
  }

  // 读取世界设定
  try {
    const worldPath = path.join(root, '世界.md')
    if (fs.existsSync(worldPath)) {
      context.world = fs.readFileSync(worldPath, 'utf8')
    }
  } catch (error) {
    // 世界设定不存在或读取失败，继续
  }

  // 读取上一章内容
  if (targetChapter > 1) {
    try {
      const chapterDir = path.join(root, CHAPTER_DIR)
      const prevChapterFile = path.join(chapterDir, `第${targetChapter - 1}章.md`)
      if (fs.existsSync(prevChapterFile)) {
        const content = fs.readFileSync(prevChapterFile, 'utf8')
        // 只取最后 1000 字作为上下文
        context.previousChapter = content.slice(-1000)
      }
    } catch (error) {
      // 上一章不存在或读取失败，继续
    }
  }

  return context
}

/**
 * 使用引导-写作分离架构生成章节
 * @param {object} options - 执行选项
 * @returns {Promise<{content: string, guidance: string|null, metrics: object, usedFallback: boolean}>}
 */
export async function generateChapterWithGuidance(options) {
  const {
    config,
    invocation,
    projectName,
    targetChapter,
    userRequest = '',
    onProgress = () => {},
  } = options

  const guidanceConfig = readGuidanceConfig(config)
  
  if (!shouldUseGuidance(config)) {
    throw new Error('引导模型未启用或配置不完整')
  }

  // 读取项目上下文
  const cwd = invocation.cwd || process.cwd()
  const projectsDirectory = config.projectsDir || 'novel_projects'
  
  const context = readProjectContext(cwd, projectName, targetChapter, projectsDirectory)
  context.userRequest = userRequest
  context.sessionProvider = invocation.agent?.provider
  context.sessionModel = invocation.agent?.model

  // 构建模型调用函数
  const callGuidanceModel = async (opts) => {
    const messages = [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.prompt }
    ]

    const response = await invocation.agent.chat({
      messages,
      provider: opts.provider,
      model: opts.model,
      ...(opts.reasoningEffort ? { reasoningEffort: opts.reasoningEffort } : {}),
    })

    return {
      text: response.content || response.text || '',
      usage: response.usage,
    }
  }

  const callWritingModel = async (opts) => {
    const messages = [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.prompt }
    ]

    const response = await invocation.agent.chat({
      messages,
      provider: opts.provider,
      model: opts.model,
      ...(opts.reasoningEffort ? { reasoningEffort: opts.reasoningEffort } : {}),
    })

    return {
      text: response.content || response.text || '',
      usage: response.usage,
    }
  }

  // 降级到单模型的函数
  const fallbackToSingleModel = async (ctx) => {
    const messages = [
      { role: 'user', content: `请为《${ctx.projectName}》写第${ctx.targetChapter}章。\n\n${ctx.userRequest || ''}` }
    ]

    const response = await invocation.agent.chat({ messages })
    
    return {
      text: response.content || response.text || '',
      usage: response.usage,
    }
  }

  // 执行引导-写作流程
  const result = await executeGuidedWriting({
    context,
    guidanceConfig,
    callGuidanceModel,
    callWritingModel,
    fallbackToSingleModel,
    onProgress,
    taskType: 'chapter',
  })

  // 保存引导大纲
  if (result.guidance && !result.usedFallback) {
    try {
      const root = withProjectsDirectory(projectsDirectory, () => projectDir(cwd, projectName))
      saveGuidanceOutline(root, targetChapter, result.guidance)
    } catch (error) {
      // 保存失败不影响主流程，只记录错误
      console.error('保存引导大纲失败:', error.message)
    }
  }

  return result
}

/**
 * 格式化性能报告
 * @param {object} metrics - 性能指标
 * @returns {string}
 */
export function formatPerformanceReport(metrics) {
  if (!metrics || !metrics.totalTime) return ''
  
  const lines = []
  lines.push('\n【性能报告】')
  lines.push(`- 引导模型耗时: ${(metrics.guidanceTime / 1000).toFixed(2)}s`)
  if (metrics.guidanceTokens) {
    lines.push(`  (${metrics.guidanceTokens} tokens)`)
  }
  lines.push(`- 写作模型耗时: ${(metrics.writingTime / 1000).toFixed(2)}s`)
  if (metrics.writingTokens) {
    lines.push(`  (${metrics.writingTokens} tokens)`)
  }
  lines.push(`- 总耗时: ${(metrics.totalTime / 1000).toFixed(2)}s`)
  
  return lines.join('\n')
}

/**
 * 增强提示词以包含引导信息（用于与现有智能系统集成）
 * @param {object} config - 插件配置
 * @param {object} invocation - 调用上下文
 * @param {string} basePrompt - 基础提示词
 * @returns {Promise<string>} 增强后的提示词
 */
export async function enhancePromptWithGuidance(config, invocation, basePrompt) {
  if (!shouldUseGuidance(config)) {
    return basePrompt
  }

  const additions = []
  additions.push('【引导-写作分离模式】')
  additions.push('本次创作使用引导模型规划 + 写作模型执行的双模型协作架构。')
  additions.push('引导模型已分析项目状态并生成详细写作大纲，请严格按照大纲执行文字创作。')
  
  return `${basePrompt}\n\n${additions.join('\n')}`
}
