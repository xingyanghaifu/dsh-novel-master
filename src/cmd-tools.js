/**
 * Project-scoped helper commands. Model-driven ones queue one task; read-only
 * ones (/novel-world, /novel-stats, /novel-export) answer directly from files.
 */
import fs from 'node:fs'
import path from 'node:path'
import { leadingChapter } from './args.js'
import { NO_PROJECT, agentCwd, fail, ok, projectExists, queueTask, resolveProject } from './context.js'
import { CHAPTER_DIR, RULES_FILE, countChars, listChapters, projectDir, projectRelativeDir, readProjectFile, readState } from './project.js'
import { regionsOf } from './atlas.js'
import { enrichRegions } from './world-model.js'

/** Resolve the target project or return an error result. */
function target(invocation) {
  const cwd = agentCwd(invocation)
  const { project, note } = resolveProject(cwd, invocation.rawInput)
  if (!projectExists(cwd, project)) return { error: fail(NO_PROJECT) }
  return { cwd, project, note, dir: projectRelativeDir(project) }
}

/** Factory for commands that hand one task to the model. */
function modelCommand({ name, description, hint, needsProject = true, build }) {
  return {
    name,
    description,
    input: { hint, attachments: true },
    handler: (invocation) => {
      let t
      if (needsProject) {
        t = target(invocation)
        if (t.error) return t.error
      } else {
        t = { cwd: agentCwd(invocation), note: invocation.rawInput.trim() }
      }
      const built = build(t)
      if (built.error) return fail(built.error)
      return queueTask({ ...invocation, novelProject: t.project ?? null }, built.prompt, built.receipt)
    },
  }
}

const RULES_HINT = (dir) => `动笔前先读 ${dir}/${RULES_FILE}，所有新写的文字都按它来，别有 AI 味。`

export const outlineCommand = () => modelCommand({
  name: 'novel-outline',
  description: '大纲：生成或调整分卷大纲，标出分岔点和高潮',
  hint: '[项目名] [调整要求]',
  build: ({ dir, project, note }) => ({
    receipt: `开始整理《${project}》的大纲。`,
    prompt: `【大纲】项目 ${dir}。读 脑洞.md、设定.md、角色.md、已有 大纲.md 和 正文/ 进度。
${note ? `用户要求：${note}\n` : ''}写或改 ${dir}/大纲.md：分卷，每卷一句核心冲突；每章一行梗概；标出 [分岔点]（3-8 个，真正改变走向的选择）和 [高潮]；节奏要有起伏，别平铺直叙。已经写完的章节梗概按正文实际内容来。
回复只说大纲的骨架（几卷、主线一句话、分岔点在哪几章）。`,
  }),
})

export const mapCommand = () => modelCommand({
  name: 'novel-map',
  description: '地图：整理地区与事件（地区.md / 事件.md），点亮设定树面板的地区地图与时间轴',
  hint: '[项目名] [补充要求]',
  build: ({ dir, project, note }) => ({
    receipt: `开始整理《${project}》的地区与事件。`,
    prompt: `【地图】项目 ${dir}。读 设定.md、角色.md、大纲.md、世界状态.md、伏笔.md 和已有正文。
${note ? `用户要求：${note}\n` : ''}整理出地区与事件两个文件（没有就新建，已有则只补全表格、不删已有行）：
1. ${dir}/地区.md：一张 Markdown 表格 | 地区 | 方位 | 地形 | 说明 | 人物 |，5-12 个地区。方位填 北/南/西/东/中/东北/西南 这类方位词；地形从 山地/雪原/森林/沙漠/水域/沼泽/城邦/原野/地下/火山/岛屿 里选一个最贴切的（这决定面板上的地貌小图）；说明一句话讲清地貌与氛围；人物填该地活跃的角色。
2. ${dir}/事件.md：一张 Markdown 表格 | 事件 | 章号 | 地区 | 状态 |，按大纲逐章与伏笔的埋设/回收整理，一行一个事件。章号写「第N章」，史前/背景事件章号留空；地区必须用地区.md 里出现的名称；状态用 未发生/进行中/已发生。
表格之外不要写其他正文。回复只列地区名、地形和事件数量。

方位就是纬度：北边冷、南边热，越往两端越极端。分配地形时守住这条 —— 雪原放北、雨林和沙漠的取舍看它离赤道多远；沙漠要么贴副热带（离正中偏三到四成的位置），要么就在山脉背风的一侧。聚落必须有水：河、湖、海岸、泉，至少挨着一个水域或湿地。写不出理由的极端地形（赤道上的雪原、雨林里的沙海）要么换位置，要么在说明里补一句为什么（高海拔、寒流、魔法）。
如果 世界状态.md 的「地理」段是列表形式，给它每条加上方位与地形标注，写成 \`- **地名**（方位·地形）：说明\`，这样面板能推出气候。`,
  }),
})

export const castCommand = () => modelCommand({
  name: 'novel-cast',
  description: '人设：生成主要角色，含性格、说话习惯、目标与关系',
  hint: '[项目名] [角色要求，如：加一个嘴毒的师姐]',
  build: ({ dir, project, note }) => ({
    receipt: `开始给《${project}》做人设。`,
    prompt: `【人设】项目 ${dir}。读 脑洞.md、设定.md、大纲.md、角色.md。
${note ? `要求：${note}\n` : '补齐主要角色（主角、对手、关键配角，5-8 人）。\n'}写进 ${dir}/角色.md，每人包含：身份、性格（要有矛盾面）、说话习惯和 1-2 个口头禅（附一句示范台词）、想要什么/怕什么、当前状态、和其他人的关系。
反派和配角有自己的目标和计划，不是给主角送经验的。同时在 世界状态.md「势力与角色动向」里给每人写一条当前动向。
回复只列人名和一句话定位。`,
  }),
})

export const rewriteCommand = () => modelCommand({
  name: 'novel-rewrite',
  description: '改写：按要求重写指定章节（风格、节奏、视角、去 AI 味）',
  hint: '[项目名] <章节号> [要求，如：节奏快一点、去 AI 味]',
  build: ({ cwd, dir, project, note }) => {
    const { chapter, note: wish } = leadingChapter(note)
    const chapters = listChapters(cwd, project)
    const hit = chapter === undefined ? chapters.at(-1) : chapters.find((c) => c.number === chapter)
    if (hit === undefined) return { error: chapter === undefined ? '这本书还没有正文。' : `没有第 ${chapter} 章。` }
    return {
      receipt: `开始改写《${project}》第 ${hit.number} 章。`,
      prompt: `【改写】${dir}/${CHAPTER_DIR}/${hit.file}
要求：${wish || '去掉 AI 味，让它更像人写的'}。
${RULES_HINT(dir)}先读前后各一章保证衔接，读 角色.md 保证人物口气不变。
先把原文另存为 ${dir}/${CHAPTER_DIR}/_旧稿/${hit.file}，再直接覆盖原文件。剧情事实（谁做了什么、结果如何）不改，除非要求里说了要改；如果改了，同步 世界状态.md / 大纲.md。
回复用两三句话说改了哪些地方。`,
    }
  },
})

export const reviewCommand = () => modelCommand({
  name: 'novel-review',
  description: '审校：查错字、AI 味、人设崩坏、设定矛盾与伏笔，支持深度模式',
  hint: '[项目名] [章节号|最近N章] [--deep]',
  build: ({ cwd, dir, project, note }) => {
    const chapters = listChapters(cwd, project)
    if (chapters.length === 0) return { error: '这本书还没有正文。' }
    
    // 检查是否启用深度模式
    const deepMode = note.includes('--deep')
    const cleanNote = note.replace(/--deep/g, '').trim()
    
    const recent = cleanNote.match(/最近\s*(\d+)\s*章/u)
    const { chapter } = leadingChapter(cleanNote)
    let scope
    if (recent !== null) scope = chapters.slice(-Number(recent[1]))
    else if (chapter !== undefined) scope = chapters.filter((c) => c.number === chapter)
    else scope = chapters.slice(-3)
    if (scope.length === 0) return { error: `没有第 ${chapter} 章。` }
    const files = scope.map((c) => `${dir}/${CHAPTER_DIR}/${c.file}`).join('\n')
    
    const basicChecks = `【基础审校】逐章细读：
${files}

对照 ${dir}/${RULES_FILE}、设定.md、角色.md、世界状态.md、伏笔.md 检查：

## 1. 基础错误
- 错别字、病句、标点
- 标点符号使用规范
- 段落格式

## 2. AI 味检测
检查写作规范里列出的 AI 味特征：
- 套话："不禁""缓缓""嘴角勾起一抹弧度"
- 总结升华：段尾总结、"这一刻他明白了"
- 排比三连、对仗工整
- 所有人一个腔调

## 3. 人物一致性
- 人物 OOC（性格崩坏）
- 说话口气跑偏
- 行为动机不符合人设

## 4. 设定一致性
- 设定或时间线矛盾
- 前后数值对不上
- 能力突然变化

## 5. 伏笔管理
- 埋了没收的伏笔
- 忘记的伏笔
- 伏笔.md 更新`

    const deepChecks = `

## 6. 逻辑检查（深度模式）
- **时间线冲突**：
  上章晚上，本章突然白天但没交代
  事件顺序混乱
  
- **地点穿越**：
  上章在 A 地，本章在 B 地但没说怎么去的
  场景转换不自然
  
- **能力不一致**：
  上章不会的技能，本章突然会了
  实力前后不符
  
- **物品和伤势**：
  上章受伤，本章没了
  重要物品突然消失/出现

## 7. 剧情质量（深度模式）
- **无效剧情**：
  与主线无关的冗长描写
  重复的内容
  
- **信息密度**：
  信息过载（一段话塞太多）
  信息过少（水文）
  
- **节奏问题**：
  该快的地方慢
  该慢的地方快

## 8. 情感真实性（深度模式）
- 人物情绪转变是否合理
- 情感描写是否真实
- 是否有情感断层`

    const finalPrompt = deepMode ? basicChecks + deepChecks : basicChecks

    const instructions = `

## 修改原则
- **小问题直接改**：错字、AI 味、格式问题
- **中等问题标注**：逻辑小瑕疵，建议改法
- **大问题列出**：需要改剧情的问题，先问我

## 输出格式

\`\`\`
📋 审校报告：《${project}》第 ${scope[0].number}-${scope.at(-1).number} 章

【已修复的问题】
第 X 章：
  ✅ 修复 3 处错别字
  ✅ 删除 AI 味套话 5 处："不禁""缓缓"等
  ✅ 调整对话标点

第 Y 章：
  ✅ 修复时间线矛盾（改为"第二天早上"）
  ✅ 补充场景转换（增加"一个小时后"）

【标注的问题】
第 X 章：
  ⚠️  信息密度过高（第 3 段）
     建议：拆成 2 段，增加喘息空间
     
  ⚠️  对话略显生硬（林晓 vs 苏瑶）
     建议：增加停顿和语气词

【需要确认的问题】
❓ 第 Y 章：林晓的实力设定前后不一致
   上章：刚学会"引气"
   本章：能用"破煞掌"（需要练气境）
   → 是剧情需要突破，还是笔误？

❓ 第 Z 章：苏瑶的态度转变太快
   上章：对林晓冷淡
   本章：突然关心
   → 是否需要补充转变的理由？

【统计】
- 审校章节：${scope.length} 章
- 修复问题：X 处
- 标注建议：Y 处
- 待确认：Z 处
${deepMode ? '- 深度模式：已启用 ✅' : ''}
\`\`\`

${deepMode ? '\n💡 提示：深度模式已启用，检查项更全面' : '\n💡 提示：使用 --deep 启用深度审校（逻辑、节奏、情感）'}`

    return {
      receipt: `开始${deepMode ? '深度' : ''}审校《${project}》第 ${scope[0].number}-${scope.at(-1).number} 章`,
      prompt: finalPrompt + instructions,
    }
  },
})

export const ideaCommand = () => modelCommand({
  name: 'novel-idea',
  description: '构思：把一句脑洞展开成几个可写的方向',
  hint: '<一句话脑洞>',
  needsProject: false,
  build: ({ note }) => note.length === 0
    ? { error: '用法：/novel-idea <一句话脑洞>' }
    : {
      receipt: '开始构思。',
      prompt: `【构思】脑洞：${note}
像跟编辑聊选题那样，给 3 个差异明显的展开方向。每个方向：
- 一句话卖点（读者为什么点进来）
- 主角是谁、想要什么、最大的阻碍
- 核心爽点/情绪钩子，前三章怎么抓人
- 适合多长（章数）、最大的写崩风险
别客套，直接说哪个最好写、为什么。最后提醒：选定后用 /novel <方向> 开书。`,
    },
})

export const sparkCommand = () => modelCommand({
  name: 'novel-spark',
  description: '灵感：卡文时给出接下来几种走法',
  hint: '[项目名] [卡在哪]',
  build: ({ dir, project, note }) => ({
    receipt: `帮《${project}》找找接下来的路。`,
    prompt: `【灵感】项目 ${dir}。读最近 2 章、大纲.md、世界状态.md（尤其「幕后推进」）、伏笔.md。
${note ? `卡点：${note}\n` : ''}给 3-5 个接下来的走法，每个两三句：发生什么、哪个势力/角色的幕后行动在这里爆出来、读者情绪怎么走、对后面的影响。至少一个要出乎意料但合情理。
不改任何文件。说你最推荐哪个。`,
  }),
})

/** Clip long file text for direct display. */
function clip(text, max = 1800) {
  if (text === undefined) return '（空）'
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}\n…（已截断，完整内容见文件）` : t
}

/** clip 的补充：把世界推演结果压成一段能读的摘要。 */
function worldBrief(cwd, project) {
  const { regions, issues, coherent } = enrichRegions(regionsOf(cwd, project))
  // 没写地理的项目不显示这一节 —— 空表格只会占地方
  if (regions.length === 0) return ''
  const rows = regions
    .filter((region) => region.climate)
    .map((region) => {
      const c = region.climate
      return `  ${region.name}｜${c.bandLabel}｜${c.terrainLabel}｜${c.summary}`
    })
  const lines = ['———— 世界概览（按方位推演） ————', ...rows]
  if (issues.length > 0) {
    lines.push('', coherent ? '可能有出入的地方：' : '讲不通的地方：')
    for (const issue of issues.slice(0, 6)) {
      lines.push(`  · ${issue.region}：${issue.message}`)
    }
    // 一次最多列六条：全列出来会把原文挤掉，作者反而看不到设定本身
    if (issues.length > 6) lines.push(`  …还有 ${issues.length - 6} 条，见 Web 面板`)
  }
  return `${lines.join('\n')}\n\n`
}

export function worldCommand() {
  return {
    name: 'novel-world',
    description: '世界：查看世界时钟、势力动向和剧情分岔树；带要求则推演世界',
    input: { hint: '[项目名] [推演要求，如：推进一个月]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error
      if (t.note.length > 0) {
        return queueTask({ ...invocation, novelProject: t.project ?? null }, `【世界推演】项目 ${t.dir}。读 设定.md、角色.md、世界状态.md、大纲.md。
要求：${t.note}
按每个势力/角色自己的目标和性格推进他们的计划（不为主角让路），写进 世界状态.md 的「幕后推进」并推进世界时钟；会影响主线的变化同步进 大纲.md 后续章节。回复列出关键变化。
地理不要推倒重来：地名、方位、地形沿用 世界状态.md 与 地区.md 里已有的。新增地点沿用 \`- **地名**（方位·地形）：说明\` 这个格式，方位用 北/南/西/东/中 加 东北/西北/东南/西南，地形用 山地/雪原/森林/沙漠/水域/沼泽/城邦/原野/地下/火山/岛屿。新地点的气候要跟它所在方位说得通 —— 北边不能长雨林，赤道不能常年积雪，城市必须挨着水。`, `开始推演《${t.project}》的世界。`)
      }
      const world = readProjectFile(t.cwd, t.project, '世界状态.md')
      const tree = readProjectFile(t.cwd, t.project, '剧情树.md')
      // 光把 Markdown 原样打出来，作者看不出世界讲不讲得通。
      // 这里顺手推演一遍气候、跑一次一致性审计 —— 已经读过的盘，不额外花钱。
      const brief = worldBrief(t.cwd, t.project)
      return ok(`《${t.project}》世界状态\n\n${brief}${clip(world)}\n\n———— 剧情树 ————\n${clip(tree, 1200)}`)
    },
  }
}

export function roleCommand() {
  return {
    name: 'novel-role',
    description: '角色：查看角色档案；带要求则更新角色状态与关系',
    input: { hint: '[项目名] [角色名|更新要求]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error
      const roles = readProjectFile(t.cwd, t.project, '角色.md')
      if (t.note.length === 0) return ok(`《${t.project}》角色\n\n${clip(roles, 2500)}`)
      // A bare name that appears as a heading: show just that section.
      const section = roles?.split(/\n(?=#{2,3}\s)/u).find((s) => s.replace(/^#+\s*/u, '').startsWith(t.note))
      if (section !== undefined) return ok(section.trim())
      return queueTask({ ...invocation, novelProject: t.project ?? null }, `【角色】项目 ${t.dir}。读 角色.md、最近 3 章、世界状态.md。
要求：${t.note}
改 角色.md（保持每人：身份/性格/说话习惯/目标/当前状态/关系），必要时同步 世界状态.md。回复说改了谁、改了什么。`, `开始更新《${t.project}》的角色。`)
    },
  }
}

export function statsCommand() {
  return {
    name: 'novel-stats',
    description: '统计：字数、章节、进度与伏笔情况，支持详细模式',
    input: { hint: '[项目名] [--detailed]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error
      
      // 检查是否启用详细模式
      const detailedMode = /(?:^|\s)--detailed(?:\s|$)/u.test(t.note)
      
      const state = readState(t.cwd, t.project) ?? {}
      const chapters = listChapters(t.cwd, t.project)
      const total = chapters.reduce((sum, c) => sum + c.chars, 0)
      const last = chapters.at(-1)
      const goal = Number(state.target) || 0
      const avg = chapters.length ? Math.round(total / chapters.length) : 0
      const foreshadow = readProjectFile(t.cwd, t.project, '伏笔.md') ?? ''
      const rows = foreshadow.split('\n').filter((l) => /^\|/u.test(l) && !/^\|\s*-|伏笔\s*\|\s*埋于/u.test(l))
      const open = rows.filter((l) => !/(已回收|已收|✓|✅)/u.test(l)).length
      const branches = (readProjectFile(t.cwd, t.project, '剧情树.md')?.match(/^#{2,3}\s/gmu) ?? []).length
      const lines = [
        `《${state.title ?? t.project}》`,
        `正文：${chapters.length} 章，约 ${(total / 10000).toFixed(1)} 万字（平均每章 ${avg} 字）`,
        goal ? `进度：${last?.number ?? 0}/${goal} 章（${Math.min(100, Math.round(((last?.number ?? 0) / goal) * 100))}%）` : '进度：未设目标章数',
        `伏笔：${rows.length} 条，未回收 ${open} 条`,
        `剧情分岔：已记录 ${branches} 个`,
      ]
      const missing = []
      for (let i = 1, j = 0; last && i <= last.number; i++) {
        while (j < chapters.length && chapters[j].number < i) j++
        if (chapters[j]?.number !== i) missing.push(i)
      }
      if (missing.length) lines.push(`缺章：${missing.slice(0, 20).join('、')}${missing.length > 20 ? '…' : ''}`)
      const thin = chapters.filter((c) => avg && c.chars < avg * 0.4).map((c) => c.number)
      if (thin.length) lines.push(`明显偏短的章：${thin.slice(0, 20).join('、')}`)
      if (detailedMode) {
        lines.push('', '详细统计（正文字符不含空白、Markdown 标记及标题；对话为成对引号内文字的占比）')
        if (chapters.length === 0) {
          lines.push('暂无章节；最短/最长章：无；全书对话占比：0.0%')
        } else {
          let dialogueTotal = 0
          for (const chapter of chapters) {
            const text = readProjectFile(t.cwd, t.project, `${CHAPTER_DIR}/${chapter.file}`) ?? ''
            const prose = text.replace(/^#+\s.*$/gmu, '')
            const dialogueChars = [...prose.matchAll(/“([^”]*)”|「([^」]*)」|『([^』]*)』|"([^"]*)"/gu)]
              .reduce((sum, match) => sum + countChars(match.slice(1).find((part) => part !== undefined) ?? ''), 0)
            dialogueTotal += dialogueChars
            const ratio = chapter.chars ? (dialogueChars / chapter.chars) * 100 : 0
            lines.push(`第 ${chapter.number} 章${chapter.title ? ` ${chapter.title}` : ''}：${chapter.chars} 字；对话占比 ${ratio.toFixed(1)}%${chapter.chars === 0 ? '（空章）' : ''}`)
          }
          const shortest = chapters.reduce((best, chapter) => chapter.chars < best.chars ? chapter : best)
          const longest = chapters.reduce((best, chapter) => chapter.chars > best.chars ? chapter : best)
          lines.push(`最短章：第 ${shortest.number} 章，${shortest.chars} 字`)
          lines.push(`最长章：第 ${longest.number} 章，${longest.chars} 字`)
          lines.push(`全书对话占比：${(total ? dialogueTotal / total * 100 : 0).toFixed(1)}%`)
        }
      }
      return ok(lines.join('\n'))
    },
  }
}

/** Strip the leading `# 第N章 标题` line so export can re-render headings. */
function chapterBody(text) {
  return text.replace(/^\uFEFF?#\s.*\n+/u, '').trim()
}

const escapeHtml = (s) => s.replace(/[&<>"]/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function exportCommand() {
  return {
    name: 'novel-export',
    description: '导出：合并全书为 TXT / Markdown / HTML，并生成目录',
    input: { hint: '[项目名] [txt|md|html]（默认 txt）' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error
      const format = (t.note.match(/\b(txt|md|html)\b/iu)?.[1] ?? 'txt').toLowerCase()
      const chapters = listChapters(t.cwd, t.project)
      if (chapters.length === 0) return fail('这本书还没有正文。')
      const dir = projectDir(t.cwd, t.project)
      const title = readState(t.cwd, t.project)?.title ?? t.project
      const parts = chapters.map((c) => ({
        heading: c.title ? `第${c.number}章 ${c.title}` : `第${c.number}章`,
        body: chapterBody(fs.readFileSync(path.join(dir, CHAPTER_DIR, c.file), 'utf8')),
      }))
      let text
      if (format === 'md') {
        text = `# ${title}\n\n${parts.map((p) => `## ${p.heading}\n\n${p.body}`).join('\n\n')}\n`
      } else if (format === 'html') {
        const toc = parts.map((p, i) => `<li><a href="#c${i + 1}">${escapeHtml(p.heading)}</a></li>`).join('')
        const body = parts.map((p, i) => `<h2 id="c${i + 1}">${escapeHtml(p.heading)}</h2>\n${p.body.split(/\n+/u).filter(Boolean).map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}`).join('\n')
        text = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{max-width:42em;margin:2em auto;padding:0 1em;line-height:1.9;font-family:serif}p{text-indent:2em;margin:.4em 0}</style></head>
<body><h1>${escapeHtml(title)}</h1><nav><ol>${toc}</ol></nav>\n${body}\n</body></html>\n`
      } else {
        text = `${title}\n\n${parts.map((p) => `${p.heading}\n\n${p.body}`).join('\n\n\n')}\n`
      }
      const outDir = path.join(dir, '导出')
      fs.mkdirSync(outDir, { recursive: true })
      const file = path.join(outDir, `${title}.${format}`)
      fs.writeFileSync(file, text, 'utf8')
      fs.writeFileSync(path.join(dir, '目录.md'), `# ${title} 目录\n\n${parts.map((p) => `- ${p.heading}`).join('\n')}\n`, 'utf8')
      const total = chapters.reduce((s, c) => s + c.chars, 0)
      return ok(`已导出 ${chapters.length} 章，约 ${(total / 10000).toFixed(1)} 万字：\n${file}`)
    },
  }
}
