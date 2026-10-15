/**
 * Advanced analysis commands for novel writing.
 * Provides conflict analysis, pacing analysis, virtual reader feedback, etc.
 */
import { agentCwd, fail, projectExists, queueTask, resolveProject } from './context.js'
import { listChapters, projectRelativeDir } from './project.js'
import { formatError, formatSuccess } from './validators.js'

/** Resolve the target project or return an error result. */
function target(invocation) {
  const cwd = agentCwd(invocation)
  const { project, note } = resolveProject(cwd, invocation.rawInput)
  if (!projectExists(cwd, project)) return { error: fail(formatError('还没有小说项目')) }
  return { cwd, project, note, dir: projectRelativeDir(project) }
}

/** Validate an explicit chapter selection; never silently fall back on bad input. */
function selectChapters(chapters, note, latest = false) {
  const selector = note.trim()
  if (!selector) {
    return { selected: latest ? chapters.slice(-1) : chapters, rangeText: latest ? '最近一章' : '全书' }
  }
  const match = selector.match(/^(\d+)(?:\s*-\s*(\d+))?$/u)
  if (!match) return { error: fail(formatError('章节范围格式错误，请使用章节号 N 或范围 N-M')) }
  const start = Number(match[1])
  const end = Number(match[2] ?? match[1])
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
    return { error: fail(formatError('章节范围无效，起始章节必须为正整数且不能大于结束章节')) }
  }
  const selected = chapters.filter(c => c.number >= start && c.number <= end)
  const numbers = new Set(selected.map(c => c.number))
  // Require every requested chapter, including both endpoints, to exist.
  if (numbers.size !== end - start + 1) {
    return { error: fail(formatError(`指定章节不存在或范围内缺章：第 ${start}${end === start ? '' : `-${end}`} 章`)) }
  }
  return { selected, rangeText: end === start ? `第 ${start} 章` : `第 ${start}-${end} 章` }
}

function chapterFiles(dir, chapters) {
  return chapters.map(c => `- ${JSON.stringify(`${dir}/正文/${c.file}`)}`).join('\n')
}

/**
 * /novel-conflict - 冲突设计器
 * 分析并建议内部冲突、人际冲突、外部冲突
 */
export function conflictCommand() {
  return {
    name: 'novel-conflict',
    description: '冲突设计：分析内部/人际/外部冲突，给出升级建议',
    input: { hint: '[项目名] [章节范围，如：1-10]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error

      const chapters = listChapters(t.cwd, t.project)
      if (chapters.length === 0) {
        return fail(formatError('这本书还没有正文'))
      }

      const scope = selectChapters(chapters, t.note)
      if (scope.error) return scope.error
      const { selected, rangeText } = scope
      const chapterScope = selected.map(c => c.number)

      const prompt = `【冲突设计分析】项目 ${t.dir}

分析范围：${rangeText}（${chapterScope.join(', ')}）

请执行以下分析：

## 1. 读取必要文件
- 读 ${t.dir}/设定.md - 了解世界观规则
- 读 ${t.dir}/角色.md - 了解人物关系和目标
- 读 ${t.dir}/大纲.md - 了解情节走向
- 只读取以下正文文件进行分析，不要扩大范围：
${chapterFiles(t.dir, selected)}

## 2. 冲突类型分析

分析每个章节的冲突类型和强度：

### 内部冲突（心理矛盾）
- 主角的价值观冲突
- 欲望与恐惧的对抗
- 身份认同危机
- 道德困境

### 人际冲突（关系张力）
- 主角与对手的对抗
- 主角与盟友的分歧
- 情感纠葛
- 利益冲突

### 外部冲突（环境压力）
- 生存威胁
- 时间压力
- 资源限制
- 社会压力

## 3. 冲突强度评估

对每个章节的冲突进行评分（1-5星）：
- ⭐ 极弱：几乎没有冲突
- ⭐⭐ 弱：冲突存在但不明显
- ⭐⭐⭐ 中：有明确冲突但不紧张
- ⭐⭐⭐⭐ 强：冲突紧张，读者关注
- ⭐⭐⭐⭐⭐ 极强：冲突白热化，高潮

## 4. 输出格式

\`\`\`
📊 《${t.project}》冲突分析报告

【${rangeText}整体评估】
内部冲突：[强度] [主要体现]
人际冲突：[强度] [主要体现]
外部冲突：[强度] [主要体现]

【逐章分析】
第 X 章：[标题]
  内部冲突：⭐⭐⭐ [具体描述]
  人际冲突：⭐⭐⭐⭐ [具体描述]
  外部冲突：⭐⭐ [具体描述]
  总体强度：⭐⭐⭐

【问题诊断】
⚠️ 问题 1：第 X-Y 章冲突强度偏低
  影响：读者可能感到无聊
  
⚠️ 问题 2：缺少内部冲突
  影响：主角成长不明显

【优化建议】
🎯 建议 1：第 X 章增加道德困境
  场景：[具体场景建议]
  效果：增强内部冲突，深化人物

🎯 建议 2：第 Y 章设置选择冲突
  场景：[具体场景建议]
  效果：推动剧情分岔

【冲突升级路线】
第 1-10 章：引入期 → 建议强度 ⭐⭐⭐
第 11-20 章：发展期 → 建议强度 ⭐⭐⭐⭐
第 21-30 章：高潮期 → 建议强度 ⭐⭐⭐⭐⭐
\`\`\`

## 注意事项
1. 分析要具体，给出场景级别的建议
2. 考虑角色性格和世界观限制
3. 冲突设计要符合逻辑，不能突兀
4. 每个建议都要说明"为什么"和"怎么做"

开始分析吧！`

      return queueTask(
        { ...invocation, novelProject: t.project },
        prompt,
        formatSuccess(`开始分析《${t.project}》的冲突设计`, {
          '📊 分析范围': rangeText,
          '📝 章节数': chapterScope.length,
          '🎯 分析维度': '内部/人际/外部冲突 + 强度评估'
        })
      )
    }
  }
}

/**
 * /novel-pace - 节奏分析器
 * 分析每章节奏快慢、对话/叙述比例、情绪曲线
 */
export function paceCommand() {
  return {
    name: 'novel-pace',
    description: '节奏分析：检查节奏快慢、对话比例、情绪曲线、高潮分布',
    input: { hint: '[项目名]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error

      const chapters = listChapters(t.cwd, t.project)
      if (chapters.length === 0) {
        return fail(formatError('这本书还没有正文'))
      }

      const prompt = `【节奏分析】项目 ${t.dir}

请执行完整的节奏分析：

## 1. 逐章分析

读取以下全部正文文件，对每一章进行分析：
${chapterFiles(t.dir, chapters)}

### A. 节奏快慢判断
- **快节奏**：事件密集、短句多、对话多、动作场景
- **中节奏**：叙述和对话平衡、场景转换适中
- **慢节奏**：描写细腻、长句多、心理活动多

### B. 内容比例统计
计算每章的：
- 对话比例：%
- 叙述比例：%
- 动作场景比例：%
- 心理描写比例：%

### C. 情绪强度
- 1-5 星评估该章的情绪冲击力

## 2. 可视化输出

使用 ASCII 图表展示节奏曲线：

\`\`\`
📈 《${t.project}》节奏曲线

章节  1  2  3  4  5  6  7  8  9 10
节奏 ━━╋━━╋━━╋━━━━━━╋━╋━━━
     慢 中 快 慢  慢 中 快 高潮 慢 中

情绪 ⭐⭐ ⭐⭐⭐ ⭐⭐⭐⭐ ⭐⭐ ⭐⭐ ⭐⭐⭐ ⭐⭐⭐⭐⭐ ⭐⭐⭐ ⭐⭐

对话 ▂▂▂▃▃▅▅▇▇▅▂▂▂▃
\`\`\`

## 3. 问题诊断

\`\`\`
⚠️ 节奏问题：

问题 1：第 4-5 章连续两章慢节奏
  风险：读者可能感到疲劳，弃书率上升
  原因：过多环境描写，缺少事件推进
  
问题 2：第 8 章高潮后缺少缓冲
  风险：节奏过于紧张，读者喘不过气
  原因：直接进入下一个冲突

问题 3：对话比例失衡
  第 12 章：对话 80%（过多）
  第 15 章：对话 10%（过少）
\`\`\`

## 4. 优化建议

\`\`\`
🎯 节奏优化方案：

建议 1：第 5 章提速
  方法：删减 2-3 段环境描写
  方法：增加突发事件（敌人出现/意外发现）
  预期：从慢节奏提升到中节奏

建议 2：第 9 章增加缓冲
  方法：角色反思和情感铺垫
  方法：日常场景，展示人物关系
  预期：给读者喘息空间

建议 3：对话比例调整
  第 12 章：适当增加叙述，减少无效对话
  第 15 章：增加人物互动，避免纯叙述
\`\`\`

## 5. 节奏规律建议

\`\`\`
📏 理想节奏模式：

【引入期】（前 20%）：慢→中→快
  建立世界观，介绍角色，首次冲突

【发展期】（20%-70%）：中→快→中→快（波浪形）
  多个小高潮，节奏有起有伏

【高潮期】（70%-90%）：快→极快
  冲突白热化，节奏加速

【收尾期】（90%-100%）：快→中→慢
  解决冲突，情感升华，余韵
\`\`\`

开始分析吧！注意数据要真实（从文件中统计），不要编造。`

      return queueTask(
        { ...invocation, novelProject: t.project },
        prompt,
        formatSuccess(`开始分析《${t.project}》的节奏`, {
          '📊 分析章节': `${chapters.length} 章`,
          '📈 分析维度': '快慢/比例/情绪/高潮分布',
          '🎯 输出': 'ASCII 可视化 + 具体建议'
        })
      )
    }
  }
}

/**
 * /novel-reader - 虚拟读者反馈
 * 模拟不同类型读者的阅读体验和反馈
 */
export function readerCommand() {
  return {
    name: 'novel-reader',
    description: '虚拟读者：模拟新手/老读者/挑剔读者的阅读反馈',
    input: { hint: '[项目名] [章节范围] [--persona 新手|老读者|挑剔]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error

      const chapters = listChapters(t.cwd, t.project)
      if (chapters.length === 0) {
        return fail(formatError('这本书还没有正文'))
      }

      // 解析读者类型
      let persona = '新手读者'
      if (t.note.includes('老读者')) persona = '老读者'
      if (t.note.includes('挑剔')) persona = '挑剔读者'

      const scopeNote = t.note.replace(/--persona\s+(新手(?:读者)?|老读者|挑剔(?:读者)?)(?=\s|$)/gu, '').trim()
      const scope = selectChapters(chapters, scopeNote, true)
      if (scope.error) return scope.error
      const { selected, rangeText } = scope
      const chapterScope = selected.map(c => c.number)

      const personaDescriptions = {
        '新手读者': `
**新手读者特征：**
- 第一次读这类小说
- 容易被术语和设定困惑
- 注意力容易分散
- 喜欢直观易懂的情节
- 对慢节奏和复杂伏笔没耐心
- 更关注"有没有意思"而不是"写得好不好"`,

        '老读者': `
**老读者特征：**
- 阅读经验丰富，看过上百本同类作品
- 对套路和俗套敏感
- 追求新意和深度
- 能理解复杂设定和伏笔
- 关注人物塑造和逻辑
- 对"AI 味"非常敏感`,

        '挑剔读者': `
**挑剔读者特征：**
- 对文笔和逻辑要求极高
- 会挑刺每一个不合理的地方
- 关注细节和伏笔
- 难以取悦，标准苛刻
- 发现问题会直接弃书
- 代表最严格的读者标准`
      }

      const prompt = `【虚拟读者反馈】项目 ${t.dir}

阅读范围：${rangeText}（章节号：${chapterScope.join(', ')}）。只分析以下正文文件，不要扩大范围：
${chapterFiles(t.dir, selected)}

## 角色设定

你现在是一个**${persona}**，要对《${t.project}》的 ${rangeText} 给出真实的阅读反馈。

${personaDescriptions[persona]}

## 任务

1. **完整阅读**指定章节的正文
2. **模拟真实读者体验**，给出即时反馈
3. **保持角色一致性**，用${persona}的视角和语气

## 输出格式

\`\`\`
👤 虚拟读者反馈（${persona}视角）

【第 X 章读后感】

😊 喜欢的部分：
  • [具体场景/情节]
    原因：[为什么喜欢，用${persona}的视角]
  • [具体对话/描写]
    原因：[...]

😕 困惑的地方：
  • [不理解的术语/情节]
    疑问：[...]
  • [动机不明的行为]
    疑问：[...]

💤 无聊的部分：
  • [拖沓的描写]
    原因：[...]
  • [重复的内容]
    原因：[...]

😠 反感的地方：
  • [逻辑漏洞/人物OOC]
    原因：[...]
  • [AI味/俗套]
    原因：[...]

📖 期待的内容：
  • 接下来希望看到什么？
  • 对角色/剧情的期待

💭 整体感受：
  [一段话总结阅读体验]
  
  继续阅读意愿：★★★★☆ (4/5)
  推荐给朋友：会/不会，因为[...]
\`\`\`

## 反馈原则

1. **真实性**：像真人读者一样，有喜有厌
2. **具体性**：指出具体的句子、段落、情节
3. **视角一致**：始终保持${persona}的特征
4. **建设性**：批评要指出问题所在，不只是抱怨
5. **情感化**：用表情符号和口语化的表达

## 特别注意

- **新手读者**：关注易读性、是否有趣、是否困惑
- **老读者**：关注创新性、套路、逻辑、人物深度
- **挑剔读者**：关注每一个细节、逻辑、文笔、AI味

现在开始阅读并给出反馈吧！记住，你就是那个真实的读者。`

      return queueTask(
        { ...invocation, novelProject: t.project },
        prompt,
        formatSuccess(`${persona}正在阅读《${t.project}》`, {
          '📖 阅读范围': rangeText,
          '👤 读者类型': persona,
          '🎯 反馈维度': '喜欢/困惑/无聊/反感/期待'
        })
      )
    }
  }
}

/**
 * /novel-dialogue - 对话增强器
 * 检测对话是否符合人设，识别AI味对话
 */
export function dialogueCommand() {
  return {
    name: 'novel-dialogue',
    description: '对话增强：检测角色对话是否符合人设，识别AI味',
    input: { hint: '[项目名] <章节号> [角色名]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error

      const chapters = listChapters(t.cwd, t.project)
      if (chapters.length === 0) {
        return fail(formatError('这本书还没有正文'))
      }

      // 解析章节号
      const chapterMatch = t.note.match(/(\d+)/)
      if (!chapterMatch) {
        return fail(formatError('请指定章节号', ['/novel-dialogue 5', '/novel-dialogue 10 林晓']))
      }

      const chapterNum = parseInt(chapterMatch[1])
      const chapter = chapters.find(c => c.number === chapterNum)
      
      if (!chapter) {
        return fail(formatError(`没有第 ${chapterNum} 章`))
      }

      // 解析角色名（可选）
      const characterName = t.note.replace(/\d+/g, '').trim()

      const prompt = `【对话分析与增强】项目 ${t.dir}

## 任务

分析第 ${chapterNum} 章的对话质量${characterName ? `（重点分析：${characterName}）` : ''}

## 步骤

### 1. 读取文件
- 读 ${t.dir}/角色.md - 了解每个角色的性格、说话习惯、口头禅
- 读 ${JSON.stringify(`${t.dir}/正文/${chapter.file}`)} - 提取所有对话

### 2. 对话提取与归类

提取所有对话，标注说话人：

\`\`\`
[林晓]: "..."
[苏瑶]: "..."
[旁白]: ...
\`\`\`

### 3. 人设符合度检查

对每个主要角色的对话进行检查：

\`\`\`
🗣️ [角色名] 对话分析

人设特征（从角色.md）：
  性格：[...]
  说话习惯：[...]
  口头禅：[...]

对话样本 1：
  ❌ 原文："我觉得我们应该好好谈谈这件事情。"
  问题：太正式，不符合人设（话少、谨慎）
  ✅ 建议："嗯。有事？"
  理由：短句，符合寡言性格

对话样本 2：
  ✅ 原文："......"（沉默）
  评价：完美符合人设
\`\`\`

### 4. AI 味检测

识别以下 AI 味特征：

❌ **AI 味对话特征：**
- 过于正式："我认为...""我觉得...""让我们..."
- 句式工整：每句长度相近，结构类似
- 说教性质：动不动就讲道理
- 缺少口语化：没有语气词、没有停顿
- 信息密度高：一句话包含太多信息
- 所有人一个腔调：不同角色说话方式雷同

✅ **自然对话特征：**
- 口语化：语气词、停顿、重复
- 不完整的句子：说半截、被打断
- 情绪化：惊叹、质疑、犹豫
- 个性化：每个角色有独特说话方式
- 互动性：接话、反问、答非所问

### 5. 改写建议

对每个有问题的对话提供改写方案：

\`\`\`
🎯 改写建议：

第 X 处对话：
  当前："我觉得这样做不太合适。"
  
  问题：
    1. AI味：过于正式
    2. 不符合人设：林晓话少
  
  改写方案 A："不行。"（极简版）
  改写方案 B："......"（沉默拒绝）
  改写方案 C："不好。"（折中版）
  
  推荐：方案 B
  理由：沉默比直接拒绝更符合林晓谨慎的性格
\`\`\`

### 6. 总体评估

\`\`\`
📊 第 ${chapterNum} 章对话质量报告

对话总数：X 句
AI 味对话：Y 句 (Z%)
人设偏离：W 处

质量评分：
  自然度：★★★☆☆ (3/5)
  人设符合度：★★★★☆ (4/5)
  个性化：★★★☆☆ (3/5)

主要问题：
  1. [...]
  2. [...]

优化后预期：
  自然度：★★★★★
  人设符合度：★★★★★
  个性化：★★★★☆
\`\`\`

## 输出要求

1. 具体到每一句对话
2. 给出明确的改写方案
3. 解释"为什么"这样改
4. 保持角色一致性

开始分析吧！`

      return queueTask(
        { ...invocation, novelProject: t.project },
        prompt,
        formatSuccess(`开始分析第 ${chapterNum} 章的对话`, {
          '📖 章节': `第 ${chapterNum} 章`,
          '👤 重点角色': characterName || '所有角色',
          '🎯 检查项': 'AI味/人设符合度/自然度'
        })
      )
    }
  }
}

/**
 * /novel-emotion - 情感曲线追踪
 * 分析每章主要情绪、情感密度、共情点
 */
export function emotionCommand() {
  return {
    name: 'novel-emotion',
    description: '情感曲线：追踪每章情绪变化、情感密度、共情点识别',
    input: { hint: '[项目名] [章节范围]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error

      const chapters = listChapters(t.cwd, t.project)
      if (chapters.length === 0) {
        return fail(formatError('这本书还没有正文'))
      }

      const scope = selectChapters(chapters, t.note)
      if (scope.error) return scope.error
      const { selected, rangeText } = scope
      const chapterScope = selected.map(c => c.number)

      const prompt = `【情感曲线分析】项目 ${t.dir}

分析范围：${rangeText}（章节号：${chapterScope.join(', ')}）。只分析以下正文文件，不要扩大范围：
${chapterFiles(t.dir, selected)}

## 分析任务

### 1. 逐章情绪识别

读取每一章正文，识别主导情绪：

**情绪类别：**
- 正面：喜悦、兴奋、希望、满足、自豪、温暖
- 负面：恐惧、愤怒、悲伤、失望、焦虑、绝望
- 中性：好奇、紧张、疑惑、平静

**情绪强度：**
- ⭐ - 微弱
- ⭐⭐ - 明显
- ⭐⭐⭐ - 强烈
- ⭐⭐⭐⭐ - 很强烈
- ⭐⭐⭐⭐⭐ - 极度强烈

### 2. 可视化输出

\`\`\`
💗 《${t.project}》情感曲线

章节  1    2    3    4    5    6    7    8
情绪  好奇  紧张  惊喜  恐惧  愤怒  希望  兴奋  满足
强度  ⭐⭐  ⭐⭐⭐ ⭐⭐⭐⭐ ⭐⭐⭐⭐⭐ ⭐⭐⭐⭐ ⭐⭐⭐ ⭐⭐⭐⭐⭐ ⭐⭐⭐

情感密度：▂▂▃▅▇▆▅▇▃▂
          低        高

共情点：  ●     ●       ●   ●
         (2)   (4)     (7) (8)
\`\`\`

### 3. 情感层次分析

\`\`\`
🎭 情感结构分析：

【铺垫期】第 1-2 章
  主要情绪：好奇 → 紧张
  情感功能：建立代入感 ✅
  
【发展期】第 3-5 章
  主要情绪：惊喜 → 恐惧 → 愤怒
  情感功能：情绪波动，吸引读者 ✅
  
【高潮期】第 6-8 章
  主要情绪：希望 → 兴奋 → 满足
  情感功能：情感释放 ✅
\`\`\`

### 4. 共情点识别

标注能引发读者强烈共鸣的场景：

\`\`\`
💫 关键共情点：

第 2 章：林晓发现灵气时的惊讶
  共情原因：未知事物的恐惧 + 好奇
  情感强度：⭐⭐⭐⭐
  读者反应：会记住这个场景

第 4 章：被人追杀时的绝望
  共情原因：生存本能
  情感强度：⭐⭐⭐⭐⭐
  读者反应：紧张，心跳加速

第 7 章：苏瑶出手相救的释然
  共情原因：绝境逢生的喜悦
  情感强度：⭐⭐⭐⭐
  读者反应：长舒一口气
\`\`\`

### 5. 问题诊断

\`\`\`
⚠️ 情感问题：

问题 1：第 X-Y 章情感单调
  表现：连续 3 章都是"紧张"
  风险：读者情感疲劳
  
问题 2：缺少情感释放点
  表现：高潮后直接进入下一个冲突
  风险：读者喘不过气

问题 3：情感密度过低
  表现：第 Z 章几乎没有情感波动
  风险：读者感到无聊
\`\`\`

### 6. 优化建议

\`\`\`
🎯 情感优化方案：

建议 1：第 6 章增加"失落"情绪
  方法：让主角的某个期待落空
  目的：避免情感单调，增加层次
  
建议 2：第 9 章设置情感缓冲
  方法：温馨的日常场景
  目的：给读者喘息空间
  
建议 3：第 15 章强化共情点
  方法：增加细节描写，放大情绪
  目的：让这个场景更难忘

【理想情感曲线】
引入：好奇 → 紧张
发展：起伏波动（正负交替）
高潮：强烈情绪（恐惧/愤怒/绝望）
释放：正面情绪（希望/喜悦/满足）
收尾：平静/余韵
\`\`\`

## 输出要求

1. 情感数据要从文本中真实提取
2. 可视化要直观易懂
3. 建议要具体到章节和场景
4. 解释情感设计的逻辑

开始分析吧！`

      return queueTask(
        { ...invocation, novelProject: t.project },
        prompt,
        formatSuccess(`开始分析《${t.project}》的情感曲线`, {
          '📊 分析范围': rangeText,
          '💗 分析维度': '情绪类型/强度/共情点',
          '🎯 输出': 'ASCII 可视化 + 优化建议'
        })
      )
    }
  }
}
