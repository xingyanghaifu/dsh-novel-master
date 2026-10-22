/**
 * 引导-写作分离的命令集成层。
 *
 * 这个文件原本还导出一个 generateChapterWithGuidance，通过
 * `invocation.agent.chat` 调模型——而那个 API 在宿主里不存在，所以它一次都
 * 没跑通过，只有测试在调它。真正的双模型路径现在是 guided-write.js 里的
 * /novel-guided（走 callText）。这里只留下仍然被用到的两个判断。
 */

import { readGuidanceConfig } from './guidance.js'

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
 * 只标注「本命令走双模型」，不声称已有大纲。
 *
 * 这里刻意不再写「引导模型已生成详细写作大纲」——真实命令链路拿不到待写章节的
 * 大纲（规划要针对具体章号现做，而这里只有提示词）。声称有而实际没有，会让写作
 * 模型照着不存在的大纲自由发挥，比不加这句更糟。
 * 真正带大纲的路径是 /novel-guided（见 guided-write.js）。
 */
export async function enhancePromptWithGuidance(config, invocation, basePrompt) {
  if (!shouldUseGuidance(config)) {
    return basePrompt
  }
  return `${basePrompt}\n\n【双模型协作】本次写作启用引导-写作分离。需要逐章规划时用 /novel-guided。`
}
