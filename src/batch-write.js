/**
 * Per-request billing: cost is the number of model requests, so the cheapest
 * possible shape writes N chapters in ONE request with zero tool calls. The
 * host agent cannot hand a plugin its own text output, so this module drives a
 * direct `llm.stream` call (the real contract; `agent.chat` does not exist),
 * inlines every reference file the model needs, and splits the reply back into
 * chapter files itself so the model never spends a request on write/verify.
 */
import fs from 'node:fs'
import path from 'node:path'
import { callText, BATCH_LIMITS } from './model-intelligence.js'
import { CHAPTER_DIR, CHAPTER_RE, RULES_FILE, countChars, listChapters, projectDir, projectRelativeDir, readProjectFile, readState, safeName, writeState } from './project.js'

/** Marker the model must emit between chapters; split on it, never on prose. */
export const CHAPTER_SEPARATOR = '===第{{N}}章==='

const MAX_INLINE_CHARS = 60000
const READ_FILES = ['设定.md', '角色.md', '大纲.md', '世界状态.md', '伏笔.md', '剧情树.md']

/**
 * Resolve the explicit route only. An agent object carries no provider/model of
 * its own, so inventing a fallback here would silently bill the wrong model.
 */
export function routeOf(route) {
  const provider = String(route?.provider ?? '').trim()
  const model = String(route?.model ?? '').trim()
  const reasoningEffort = String(route?.reasoningEffort ?? '').trim()
  if (!provider || !model) return undefined
  return { provider, model, ...(reasoningEffort ? { reasoningEffort } : {}) }
}

/** Read one project file, capped so a huge outline cannot blow the input limit. */
function readCapped(cwd, name, file, cap) {
  const text = readProjectFile(cwd, name, file)
  if (!text) return ''
  const value = text.trim()
  return value.length > cap ? `${value.slice(0, cap)}\n\n…（已按长度截断）` : value
}

/**
 * Build the single self-contained request: every reference the model needs is
 * inlined because it gets no chance to read files with tools.
 */
export function buildBatchPrompt({ cwd, name, chapters, startChapter, requirement }) {
  const state = readState(cwd, name) ?? {}
  const rules = readCapped(cwd, name, RULES_FILE, 8000)
  const refs = READ_FILES
    .map(file => {
      const text = readCapped(cwd, name, file, Math.floor(MAX_INLINE_CHARS / READ_FILES.length))
      return text ? `\n===== ${file} =====\n${text}` : ''
    })
    .join('\n')
  const recent = listChapters(cwd, name).slice(-2)
  const recentText = recent
    .map(chapter => `\n===== ${chapter.file} =====\n${readProjectFile(cwd, name, `${CHAPTER_DIR}/${chapter.file}`) ?? ''}`)
    .join('\n')

  const numbers = chapters.map(chapter => chapter.number)
  const plan = chapters.map(chapter => `第${chapter.number}章 目标 ${chapter.chars} 字：${chapter.brief || '按大纲推进'}`).join('\n')
  const separatorSample = CHAPTER_SEPARATOR.replace('{{N}}', String(numbers[0]))
  // State the total explicitly. Without it a large batch makes the model shave
  // every chapter down to fit, which is how 30 requested chapters arrived at
  // ~1100 characters each instead of the 2500 the plan asked for.
  const totalChars = chapters.reduce((sum, chapter) => sum + chapter.chars, 0)
  const minChars = Math.min(...chapters.map(chapter => chapter.chars))

  return `你现在一次性撰写《${state.title ?? name}》的第 ${numbers[0]} 章到第 ${numbers.at(-1)} 章，共 ${chapters.length} 章，总计约 ${totalChars} 字。

【最重要的约束】
- 本次回复只输出正文，不要调用任何工具，不要读写文件，不要询问确认，不要输出解释、前言或总结。
- 章与章之间必须单独一行输出分隔标记，格式严格为 ${CHAPTER_SEPARATOR}，把 N 换成该章章号，例如第一处是 ${separatorSample}。
- 除分隔标记外，不要再输出任何说明文字。
- 每章第一行写「# 第N章 标题」，不写作者说明、不打分、不写构思。
- 每章字数按下面清单执行，剧情连贯、承接上一章结尾。
- 每章不得少于 ${minChars} 字。宁可少写一章的进度，也不要把章节压缩成梗概；写不下就写细，不要缩水。

【写作规范】
${rules || '（无，按中文网文常规：节奏快、对话自然、细节具体。）'}

【项目资料】
${refs || '（暂无额外设定资料，请依据本章清单与上一章自行保持一致。）'}
${recentText ? `\n【最近正文（保持衔接）】${recentText}` : ''}

【本次章节清单】
${plan}
${requirement ? `\n【额外要求】\n${requirement}` : ''}

现在开始，直接输出 ${chapters.length} 章正文。`
}

/**
 * Split the model reply into chapters using the separator. Chapter numbers are
 * parsed from the marker so ordering stays explicit; bodies without a leading
 * `# 第N章` heading get one so splits stay readable.
 */
export function splitBatchOutput(text, expectedNumbers) {
  const source = String(text ?? '').replace(/\r\n?/gu, '\n')
  const marker = /^[ \t]*===第(\d{1,4})章===[ \t]*$/gmu
  const marks = [...source.matchAll(marker)]
  if (!marks.length) return []
  const out = []
  for (let i = 0; i < marks.length; i++) {
    const number = Number(marks[i][1])
    const start = marks[i].index + marks[i][0].length
    const end = i + 1 < marks.length ? marks[i + 1].index : source.length
    const body = source.slice(start, end).trim()
    if (!body) continue
    out.push({ number, body })
  }
  // Only keep chapters the caller asked for, so a stray recap cannot overwrite.
  const wanted = new Set(expectedNumbers)
  return out.filter(chapter => wanted.has(chapter.number))
}

/**
 * Write one chapter as 第N章_标题.md. Never clobbers an existing chapter: any
 * file already holding that number — whatever its title suffix — is refused, so
 * a re-run cannot silently replace prose the author already has.
 */
export function writeChapter(dir, number, body) {
  const target = path.join(dir, CHAPTER_DIR)
  fs.mkdirSync(target, { recursive: true })
  const clash = existingChapterFiles(target, number)
  if (clash.length > 0) throw new Error(`第${number}章已存在，拒绝覆盖：${clash[0]}`)
  const heading = body.match(/^#\s*第(\d{1,4})章\s*(.*)$/mu)
  const title = safeName(heading?.[2] ?? '', 30)
  const file = title ? `第${number}章_${title}.md` : `第${number}章.md`
  const normalized = heading ? body : `# 第${number}章\n\n${body}`
  fs.writeFileSync(path.join(target, file), `${normalized.trim()}\n`, 'utf8')
  return file
}

/** Files that already use a given chapter number, matched by a fresh regex. */
function existingChapterFiles(dir, number) {
  let names
  try { names = fs.readdirSync(dir) } catch { return [] }
  const pattern = new RegExp(`^第${number}章(?:[^0-9]|$)`, 'u')
  return names.filter(candidate => pattern.test(candidate) && CHAPTER_RE.test(candidate))
}

/** Add the freshly written chapters to a project's recorded progress. */
function recordProgress(cwd, name) {
  const state = readState(cwd, name) ?? {}
  const done = listChapters(cwd, name).length
  writeState(cwd, name, { ...state, done })
  return done
}

/**
 * Write N chapters in one billed request. Returns the written file names so
 * the receipt can report real progress instead of "submitted".
 */
export async function runBatchWrite(ctx, invocation, { name, count, requirement, config }) {
  const cwd = invocation.cwd ?? invocation.agent?.session?.header?.cwd ?? process.cwd()
  const route = routeOf(config)
  if (!route) throw new Error('批量写作需要明确的 provider/model 路由')

  const existing = listChapters(cwd, name)
  const start = (existing.at(-1)?.number ?? 0) + 1
  const chapters = Array.from({ length: count }, (_, index) => ({ number: start + index, chars: 2500 }))
  const prompt = buildBatchPrompt({ cwd, name, chapters, startChapter: start, requirement })
  const output = await callText(ctx, {
    ...route,
    limits: 'batch',
    system: '你是职业网文作者，只按用户给定的章节清单连续创作正文，不使用工具，不解释过程。',
    prompt,
    signal: invocation.signal,
    timeoutMs: BATCH_LIMITS.timeoutMs,
    maxTokens: BATCH_LIMITS.maxTokens,
    maxOutputChars: BATCH_LIMITS.outputChars,
  })

  const parsed = splitBatchOutput(output, chapters.map(chapter => chapter.number))
  if (!parsed.length) throw new Error('模型输出没有包含章节分隔标记，未写入任何文件')
  const dir = projectDir(cwd, name)

  // Validate the whole reply before touching disk: a duplicate marker or an
  // existing chapter must abort the batch, not leave it half written.
  const seen = new Set()
  for (const chapter of parsed) {
    if (seen.has(chapter.number)) throw new Error(`模型重复输出了第${chapter.number}章，未写入任何文件`)
    seen.add(chapter.number)
    const clash = existingChapterFiles(path.join(dir, CHAPTER_DIR), chapter.number)
    if (clash.length > 0) throw new Error(`第${chapter.number}章已存在，未写入任何文件：${clash[0]}`)
  }

  const written = []
  for (const chapter of parsed) written.push({ number: chapter.number, file: writeChapter(dir, chapter.number, chapter.body) })
  const done = recordProgress(cwd, name)
  return { written, done, project: projectRelativeDir(name), chars: parsed.reduce((sum, chapter) => sum + countChars(chapter.body), 0) }
}
