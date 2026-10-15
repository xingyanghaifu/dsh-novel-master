/** Heuristic writing-fit suggestions, not live platform research. */
import { agentCwd, fail, projectExists, queueTask, resolveProject } from './context.js'
import { listChapters, projectRelativeDir } from './project.js'
import { formatError, formatSuccess } from './validators.js'

const platforms = {
  qidian: '起点中文网', qd: '起点中文网', 起点: '起点中文网',
  zongheng: '纵横中文网', zh: '纵横中文网', 纵横: '纵横中文网',
  jjwxc: '晋江文学城', jj: '晋江文学城', 晋江: '晋江文学城',
  '17k': '17K小说网', chuangshi: '创世中文网', 创世: '创世中文网',
}

// These are prompts for editorial consideration, not measured audience profiles.
const profiles = {
  '起点中文网': '可从类型叙事、主线目标和连载推进方式讨论适配；不能将男频或爽文视为所有分区的统一要求。',
  '纵横中文网': '可从情节推进、人物动机与长线叙事的清晰度讨论适配；不能据此断言某题材当前热销。',
  '晋江文学城': '可从人物关系、情感线或其他核心叙事线的连贯性讨论适配；不同频道题材差异大，不能假定所有作品都必须以恋爱为主。',
  '17K小说网': '可从连载结构、故事辨识度和持续创作能力讨论适配；没有实时依据时，不能声称新人更容易签约或竞争更小。',
  '创世中文网': '仅提供一般类型小说与连载结构的编辑建议。未核实该品牌当前独立投稿入口、频道政策或读者构成，投稿前须查验官方当前说明；不能假定入口仍可用。',
}

export function marketCommand() {
  return {
    name: 'novel-market',
    description: '市场适配建议：基于正文的启发式评估，不含实时市场数据',
    input: { hint: '<平台名> [项目名]' },
    handler: (invocation) => {
      const rawInput = invocation.rawInput.trim()
      if (!rawInput) {
        return fail(formatError('请指定平台名称', ['/novel-market qidian 我的项目', '/novel-market jjwxc 我的项目']))
      }
      const [platformInput, ...projectParts] = rawInput.split(/\s+/u)
      const platform = platforms[platformInput.toLowerCase()]
      if (!platform) {
        return fail(formatError('不支持的平台', ['支持：qidian / 起点、zongheng / 纵横、jjwxc / 晋江、17k、chuangshi / 创世']))
      }
      const cwd = agentCwd(invocation)
      const projectInput = projectParts.join(' ')
      const { project, note } = resolveProject(cwd, projectInput)
      // An explicit name must resolve exactly; do not silently analyze the latest book.
      if (projectInput && note.trim()) return fail(formatError(`找不到指定项目：${projectInput}`))
      if (!projectExists(cwd, project)) return fail(formatError('还没有小说项目'))
      const dir = projectRelativeDir(project)
      const chapters = listChapters(cwd, project)
      if (!chapters.length) return fail(formatError('这本书还没有正文'))
      const totalChars = chapters.reduce((sum, chapter) => sum + chapter.chars, 0)
      const averageChars = Math.round(totalChars / chapters.length)
      const chapterFiles = chapters.slice(0, 5)
        .map(chapter => `- ${JSON.stringify(`${dir}/正文/${chapter.file}`)}`).join('\n')
      const prompt = `【市场适配建议（启发式）】平台：${platform}
项目：${dir}

## 数据边界（必须遵守）
本命令没有联网，也没有实时市场数据。这是基于本地正文的启发式编辑建议，不是实际市场调研。
禁止编造读者人数、年龄分布、订阅量、收入、签约/推荐位概率、成功率或市场份额。
禁止声称已完成真实读者调查或实际市场研究，禁止把主观匹配评价写成统计概率，禁止承诺收益或增长数字。
平台政策、热度、投稿入口、收费或更新要求若无可核验的当前官方来源，明确写“未核实”，不得伪装成现行规定。

## 已计算的本地统计
正文共 ${chapters.length} 章，总计 ${totalChars} 字，平均 ${averageChars} 字/章（四舍五入）。
统计口径：去除 Markdown 标题行、空白及部分 Markdown 标记；来自所有正文文件，不代表平台字数统计。

## 阅读材料
- ${JSON.stringify(`${dir}/脑洞.md`)}
- ${JSON.stringify(`${dir}/设定.md`)}
- ${JSON.stringify(`${dir}/角色.md`)}
- ${JSON.stringify(`${dir}/大纲.md`)}
辅助文件如不存在应注明，不要编造其内容。开头样本为以下实际文件（最多五章）：
${chapterFiles}
不要将开头样本判断泛化成已经阅读全书。

## 平台讨论背景（非实时画像，需按频道核实）
${profiles[platform]}

## 输出任务
1. 从上述文本提取题材、主线、人物与叙事风格，引用具体章节或段落作为依据。
2. 讨论与目标平台可能的内容适配，分别标出文本事实、编辑判断和待核实的平台信息。不提供伪精确的匹配分或概率。
3. 检查开篇吸引力、人物动机、节奏与连载结构；章节长度现状使用实际平均 ${averageChars} 字/章，不凭空填写平台硬性字数要求。
4. 给出可执行的修改建议、取舍与验证方法；效果仅作为假设，不能承诺读者增长或收入。
5. 建议符合实际故事内容的标签和简介方向，更新计划以作者可持续能力为依据。收费与投稿政策只提醒核对官方说明。
6. 最后列出不确定性和投稿前需核实的信息，明确“本报告是启发式建议，不含实时市场数据”。`
      return queueTask({ ...invocation, novelProject: project }, prompt, formatSuccess(`开始为《${project}》生成 ${platform} 适配建议（非实时市场调研）`, {
        '📱 目标平台': platform,
        '📖 分析项目': project,
        '📝 实际平均字数': `${averageChars} 字/章`,
        '📊 数据边界': '本地文本 + 启发式建议，无实时市场数据',
      }))
    },
  }
}
