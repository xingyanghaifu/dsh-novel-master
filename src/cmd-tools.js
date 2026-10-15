/**
 * Project-scoped helper commands. Model-driven ones queue one task; read-only
 * ones (/novel-world, /novel-stats, /novel-export) answer directly from files.
 */
import fs from 'node:fs'
import path from 'node:path'
import { leadingChapter } from './args.js'
import { NO_PROJECT, agentCwd, fail, ok, projectExists, queueTask, resolveProject } from './context.js'
import { CHAPTER_DIR, RULES_FILE, listChapters, projectDir, readProjectFile, readState } from './project.js'

/** Resolve the target project or return an error result. */
function target(invocation) {
  const cwd = agentCwd(invocation)
  const { project, note } = resolveProject(cwd, invocation.rawInput)
  if (!projectExists(cwd, project)) return { error: fail(NO_PROJECT) }
  return { cwd, project, note, dir: `novel_projects/${project}` }
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
      return queueTask(invocation, built.prompt, built.receipt)
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
  description: '审校：查错字、AI 味、人设崩坏、设定矛盾与伏笔，并直接修',
  hint: '[项目名] [章节号|最近N章]',
  build: ({ cwd, dir, project, note }) => {
    const chapters = listChapters(cwd, project)
    if (chapters.length === 0) return { error: '这本书还没有正文。' }
    const recent = note.match(/最近\s*(\d+)\s*章/u)
    const { chapter } = leadingChapter(note)
    let scope
    if (recent !== null) scope = chapters.slice(-Number(recent[1]))
    else if (chapter !== undefined) scope = chapters.filter((c) => c.number === chapter)
    else scope = chapters.slice(-3)
    if (scope.length === 0) return { error: `没有第 ${chapter} 章。` }
    const files = scope.map((c) => `${dir}/${CHAPTER_DIR}/${c.file}`).join('\n')
    return {
      receipt: `开始审校《${project}》第 ${scope[0].number}-${scope.at(-1).number} 章。`,
      prompt: `【审校】逐章细读：
${files}
对照 ${dir}/${RULES_FILE}、设定.md、角色.md、世界状态.md、伏笔.md 检查：
1. 错别字、病句、标点
2. AI 味（写作规范里列的套话、总结升华、排比、所有人一个腔调）
3. 人物 OOC、说话口气跑偏
4. 设定或时间线矛盾、前后数值对不上
5. 埋了没收或忘了的伏笔
小问题直接改原文件；大问题（要改剧情）先列出来问我。
回复：每章一行说改了什么，最后列需要我拍板的问题。`,
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

export function worldCommand() {
  return {
    name: 'novel-world',
    description: '世界：查看世界时钟、势力动向和剧情分岔树；带要求则推演世界',
    input: { hint: '[项目名] [推演要求，如：推进一个月]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error
      if (t.note.length > 0) {
        return queueTask(invocation, `【世界推演】项目 ${t.dir}。读 设定.md、角色.md、世界状态.md、大纲.md。
要求：${t.note}
按每个势力/角色自己的目标和性格推进他们的计划（不为主角让路），写进 世界状态.md 的「幕后推进」并推进世界时钟；会影响主线的变化同步进 大纲.md 后续章节。回复列出关键变化。`, `开始推演《${t.project}》的世界。`)
      }
      const world = readProjectFile(t.cwd, t.project, '世界状态.md')
      const tree = readProjectFile(t.cwd, t.project, '剧情树.md')
      return ok(`《${t.project}》世界状态\n\n${clip(world)}\n\n———— 剧情树 ————\n${clip(tree, 1200)}`)
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
      return queueTask(invocation, `【角色】项目 ${t.dir}。读 角色.md、最近 3 章、世界状态.md。
要求：${t.note}
改 角色.md（保持每人：身份/性格/说话习惯/目标/当前状态/关系），必要时同步 世界状态.md。回复说改了谁、改了什么。`, `开始更新《${t.project}》的角色。`)
    },
  }
}

export function statsCommand() {
  return {
    name: 'novel-stats',
    description: '统计：字数、章节、进度与伏笔情况',
    input: { hint: '[项目名]' },
    handler: (invocation) => {
      const t = target(invocation)
      if (t.error) return t.error
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
