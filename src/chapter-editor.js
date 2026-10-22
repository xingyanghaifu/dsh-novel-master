/**
 * 正文阅读与片段改写（侧边栏用）。
 *
 * 三条路径：读一章正文、就选中片段请模型改一版、采纳后写回。
 *
 * 「改一版」不碰文件。这对使用者的意义是：模型给的东西先看，不满意就直接
 * 丢掉，磁盘上什么都没发生；只有点了采纳才落盘，而且落盘前会留一份旧稿。
 * 生成和写入刻意分成两步，就是为了让「不满意」的代价为零。
 */
import fs from 'node:fs'
import path from 'node:path'
import { callText } from './model-intelligence.js'
import { CHAPTER_DIR, RULES_FILE, listChapters, projectDir, readProjectFile, readState, safeName } from './project.js'

/** 旧稿目录，和 /novel-rewrite 保持一致。 */
const BACKUP_DIR = '_旧稿'

/** 章节正文；不存在时返回 undefined。 */
export function readChapter(cwd, name, number) {
  const hit = listChapters(cwd, name).find(chapter => chapter.number === number)
  if (hit === undefined) return undefined
  const text = readProjectFile(cwd, name, `${CHAPTER_DIR}/${hit.file}`) ?? ''
  return { number: hit.number, title: hit.title, file: hit.file, chars: hit.chars, text }
}

/**
 * 片段的提示词。
 *
 * 关键在于把「只改这一段」说死：模型拿到片段就很容易顺手改剧情、加情节、
 * 换人称——那会让上下文的接续断掉，而使用者只是想把这句话写得顺一点。
 */
function snippetPrompt({ mode, snippet, before, after, requirement }) {
  const taste = mode === 'polish'
    ? [
        '润色：只改表达，不改事实。',
        '- 谁做了什么、结果如何、说了哪些话，全部保持原样。',
        '- 可以调整语序、换更准确的动词、删掉 AI 味的空话和重复的形容词。',
        '- 不要加新的情节、动作、心理活动或对话。',
        '- 字数控制在大约原片段的 0.8 到 1.2 倍。',
      ]
    : [
        '重写：可以换写法，但事实边界不变。',
        '- 允许重组这一段内部的结构、换叙述角度、换句式节奏。',
        '- 这一段之外的事不要动，不要提前透露后面的内容。',
        '- 不要新增人物、设定或情节转折。',
      ]
  return [
    '【任务】修改一段小说正文。',
    '',
    ...taste,
    '',
    `【选中片段】\n${snippet}`,
    before ? `\n【上文（只用于保持衔接，不要改动，也不要复述）】\n${before}` : '',
    after ? `\n【下文（只用于保持衔接，不要改动，也不要提前透露）】\n${after}` : '',
    requirement ? `\n【这次的要求】\n${requirement}` : '',
    '',
    '【输出格式】',
    '- 只输出改好的这一段正文。',
    '- 不要输出标题、不要解释改了什么、不要用代码块包起来、不要加引号。',
    '- 如果认为这段不需要改，就原样返回它。',
  ].join('\n')
}

/**
 * 让模型改一段，返回候选文本。**不写任何文件。**
 *
 * @returns {Promise<{text: string, route: object}>}
 */
export async function proposeSnippet(ctx, { cwd, name, number, snippet, mode = 'polish', requirement = '', config, signal }) {
  const chapter = readChapter(cwd, name, number)
  if (chapter === undefined) throw new Error(`没有第 ${number} 章`)
  const wanted = String(snippet ?? '')
  if (!wanted.trim()) throw new Error('没有选中任何文字')
  // 片段必须真的在这一章里：否则是在凭空改写，接回去必然错位。
  if (!chapter.text.includes(wanted)) throw new Error('选中的文字没有出现在这一章里（可能刚被改过，刷新一下）')

  const route = snippetRoute(config)
  if (route === undefined) throw new Error('尚未配置模型：插件设置 → 批量写作 → 引导模型，或直接在对话里用 /novel-rewrite')

  const at = chapter.text.indexOf(wanted)
  // 上下各取一段以便衔接；取多了只会挤占注意力，不帮助判断。
  const before = chapter.text.slice(Math.max(0, at - 400), at).trim()
  const after = chapter.text.slice(at + wanted.length, at + wanted.length + 400).trim()
  const rules = readProjectFile(cwd, name, RULES_FILE) ?? ''
  const state = readState(cwd, name) ?? {}

  const text = await callText(ctx, {
    ...route,
    // 片段改写不需要整章那么大的预算，但也别用 default 档：120s 对长段落偏紧。
    limits: 'batch',
    system: [
      `你是一位小说编辑，正在帮作者改《${state.title ?? name}》第 ${number} 章里的一段。`,
      '你的职业习惯是把作者的意图放在第一位，不把自己的偏好塞进去。',
      rules ? `\n这部作品的写作规范（必须遵守）：\n${rules.slice(0, 4000)}` : '',
    ].join('\n'),
    prompt: snippetPrompt({ mode, snippet: wanted, before, after, requirement }),
    signal,
    timeoutMs: 120000,
    maxTokens: 3000,
    maxOutputChars: 12000,
  })
  return { text: cleanSnippet(text), route }
}

/** 去掉模型爱加的代码块围栏和成对引号。 */
function cleanSnippet(text) {
  let out = String(text ?? '').trim()
  const fenced = out.match(/^```[a-z]*\s*\n([\s\S]*?)\n?```$/iu)
  if (fenced) out = fenced[1].trim()
  out = out.replace(/^["“「]([\s\S]*)["”」]$/u, '$1').trim()
  return out
}

/** 片段改写用哪条路由：引导模型优先，没有就退回批量写作的模型。 */
function snippetRoute(config) {
  const pick = (section) => {
    const value = (key) => {
      const raw = section?.[key]
      if (raw && typeof raw === 'object' && typeof raw.get === 'function') {
        try { return raw.get() } catch { return undefined }
      }
      return raw
    }
    const provider = String(value('provider') ?? '').trim()
    const model = String(value('model') ?? '').trim()
    if (!provider || !model) return undefined
    const effort = String(value('reasoningEffort') ?? '').trim()
    return { provider, model, ...(effort ? { reasoningEffort: effort } : {}) }
  }
  return pick(config?.guidance) ?? pick(config?.batch)
}

/**
 * 采纳：把片段替换成新版，并留一份旧稿。
 *
 * 写入前再确认一次「旧文本仍然存在且只出现一次」。窗口可能开着很久，
 * 期间章节被别的地方改过；直接按位置替换会把别人的改动覆盖掉。
 *
 * @returns {{ok: true, backup?: string, chars: number}}
 */
export function applySnippet(cwd, name, number, original, replacement) {
  const chapter = readChapter(cwd, name, number)
  if (chapter === undefined) throw new Error(`没有第 ${number} 章`)
  const from = String(original ?? '')
  const to = String(replacement ?? '')
  if (!from.trim()) throw new Error('原文为空，无法替换')
  if (!to.trim()) throw new Error('改写结果为空，没有采纳')

  const hits = chapter.text.split(from).length - 1
  if (hits === 0) throw new Error('原文已经不在了（这一章可能刚被改过），请刷新后重试')
  if (hits > 1) throw new Error(`原文在这一章里出现了 ${hits} 次，无法确定改哪一处；请多选一点让它是唯一的`)

  const dir = projectDir(cwd, name)
  const target = path.join(dir, CHAPTER_DIR, chapter.file)
  const backupDir = path.join(dir, CHAPTER_DIR, BACKUP_DIR)
  fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
  const backupName = `${safeName(chapter.file.replace(/\.md$/u, ''), 60)}.${stamp}.md`
  fs.writeFileSync(path.join(backupDir, backupName), chapter.text, 'utf8')

  const next = chapter.text.slice(0, chapter.text.indexOf(from)) + to + chapter.text.slice(chapter.text.indexOf(from) + from.length)
  // 原子替换，和项目里其它写入保持一致。
  const temp = `${target}.${process.pid}.tmp`
  try {
    fs.writeFileSync(temp, next, 'utf8')
    fs.renameSync(temp, target)
  } catch (error) {
    try { fs.rmSync(temp, { force: true }) } catch { /* 清理失败就算了 */ }
    throw error
  }
  return { ok: true, backup: `${CHAPTER_DIR}/${BACKUP_DIR}/${backupName}`, chars: next.length }
}
