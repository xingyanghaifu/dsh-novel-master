/**
 * Project bootstrap and the per-round workflow file that drives 完本 / 续写.
 */
import fs from 'node:fs'
import path from 'node:path'
import { STYLE_RULES, WORLD_RULES } from './prompts.js'
import { CHAPTER_DIR, RULES_FILE, listChapters, projectDir, readState, writeState } from './project.js'

export const WORKFLOW_FILE = '完本流程.md'

/** Files created empty-with-header so the model always has a place to write. */
const SEED_FILES = {
  '设定.md': '# 设定\n\n> 世界观、力量体系、地理、规则。写进来的设定后文不能自相矛盾。\n',
  '角色.md': '# 角色\n\n> 每个角色：身份 / 性格 / 说话习惯与口头禅 / 目标 / 当前状态 / 与他人关系。\n',
  '世界状态.md': '# 世界状态\n\n## 世界时钟\n故事开始前\n\n## 势力与角色动向\n\n## 幕后推进\n',
  '伏笔.md': '# 伏笔\n\n| 伏笔 | 埋于 | 计划回收 | 状态 |\n|---|---|---|---|\n',
  '剧情树.md': '# 剧情树\n\n> 每个分岔点：章节 / 局势 / 各条路 / 选择 / 理由。\n',
}

/**
 * Create the project skeleton without overwriting anything that exists.
 * @returns {string} absolute project directory.
 */
export function ensureProject(cwd, name, idea) {
  const dir = projectDir(cwd, name)
  fs.mkdirSync(path.join(dir, CHAPTER_DIR), { recursive: true })
  const seeds = { ...SEED_FILES, [RULES_FILE]: STYLE_RULES }
  if (idea) seeds['脑洞.md'] = `# 脑洞\n\n${idea}\n`
  for (const [file, text] of Object.entries(seeds)) {
    const target = path.join(dir, file)
    if (!fs.existsSync(target)) fs.writeFileSync(target, text, 'utf8')
  }
  return dir
}

/** Pick a project directory name that does not collide with an existing one. */
export function uniqueName(cwd, base) {
  let name = base || '未命名小说'
  for (let i = 2; fs.existsSync(projectDir(cwd, name)); i++) name = `${base}${i}`
  return name
}

/**
 * Render 完本流程.md for the current target.
 * @param {{ name: string, target: number, branchMode: 'ask'|'auto', mode: 'finish'|'continue', done: number }} s
 */
export function renderWorkflow(s) {
  const continuing = s.mode === 'continue'
  return `# 《${s.name}》${continuing ? '续写' : '完本'}流程

- 目标：正文写满第 ${s.target} 章（开始时已有 ${s.done} 章）
- 分岔模式：${s.branchMode}（ask = 用 ask_user_question 问用户；auto = 自己按人物逻辑选）
${s.note ? `- 用户这次的要求：${s.note}\n` : ''}- 所有文件都在 novel_projects/${s.name}/ 下。上下文随时会被压缩：要记住的东西一律写进文件，别只记在脑子里。

## 每一轮都这样做
1. 先读：项目.json、写作规范.md、本文件、世界状态.md。再用 glob 看 正文/ 现在写到第几章。
2. 准备（只在缺的时候做）：
${continuing
    ? `   - 这是续写：先把 正文/ 最后 3 章完整读一遍，前面的章节读开头结尾抓主线。
   - 设定.md / 角色.md / 世界状态.md / 伏笔.md 是空的就从已有正文里整理出来；人物说话习惯从原文对话里提炼。
   - 写作规范.md 末尾没有「风格档案」就先按原文拆一遍风格追加进去，续写必须和原文一个味道。
   - 大纲.md 只覆盖到已有章节或没写到第 ${s.target} 章：补写后续大纲。`
    : `   - 设定.md、角色.md 还空：根据 脑洞.md 把世界观、力量体系、主要角色（含说话习惯）定下来。
   - 大纲.md 不存在或没覆盖到第 ${s.target} 章：写分卷大纲，每章一行梗概，标出 [分岔点] 和 [高潮]，节奏要有起伏。
   - 书名还是临时名就顺手起个正式书名写进 项目.json 的 title。`}
3. 写正文：本轮按顺序写 1-3 章，不跳号。每章动笔前重读 写作规范.md、大纲里这一章、世界状态.md、上一章结尾。
4. 每写完一章：
   - 保存到 正文/第N章_标题.md（格式见写作规范）。
   - 更新 世界状态.md：推进世界时钟，给不在场的势力/角色各推进一步幕后行动。
   - 更新 角色.md 的状态与关系、伏笔.md；剧情偏离大纲就同步改大纲后续。
5. 这一章在大纲里是 [分岔点]：先按下面「剧情分岔」处理，再写下一章。
6. 每满 10 章自查一次：人物有没有 OOC、伏笔有没有积压、节奏有没有拖；有问题直接改文件，不写报告。
7. 写完第 ${s.target} 章：做收尾检查（主线闭环、主要角色有交代、伏笔收完或明确留白），生成 目录.md，然后调用 update_goal 把目标标记为 complete。

## 回复要求
- 回复里不要贴正文，正文只写进文件。每轮回复一两句：写到第几章、发生了什么关键事。
- 不确定的小事自己拿主意，别停下来问。只有分岔点（ask 模式）才问用户。

${WORLD_RULES}`
}

/**
 * Write state + workflow for a 完本/续写 run.
 * @returns {{ state: object, done: number }}
 */
export function prepareRun(cwd, name, patch) {
  const previous = readState(cwd, name) ?? {}
  const done = listChapters(cwd, name).at(-1)?.number ?? 0
  const state = {
    name,
    title: previous.title ?? name,
    createdAt: previous.createdAt ?? new Date().toISOString(),
    ...previous,
    ...patch,
  }
  writeState(cwd, name, state)
  fs.writeFileSync(path.join(projectDir(cwd, name), WORKFLOW_FILE), renderWorkflow({ ...state, done }), 'utf8')
  return { state, done }
}
