/**
 * 引导-写作分离的提示词构造。
 *
 * 只剩两件事：读配置、拼引导模型的系统提示词。
 *
 * 这里原本还有一整套 executeGuidedWriting / generateContent / PerformanceMonitor，
 * 通过 invocation.agent.chat 调模型 —— 那个 API 在宿主里不存在，所以它一次都
 * 没跑通过，只有 test/guidance.test.js 在调。真正的双模型路径是
 * guided-write.js 里的 /novel-guided（走 callText）。留着那条错的路，
 * 下一个人很可能接上去，重演一遍「看起来接好了其实没接」。
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
