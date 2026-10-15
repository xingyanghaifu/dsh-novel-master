/**
 * Import an existing novel (txt/md) into a project, split by chapter headings,
 * so /novel-continue can pick it up.
 */
import fs from 'node:fs'
import path from 'node:path'
import { CHAPTER_DIR, safeName } from './project.js'

const HEADING_RE = /^[ \t\u3000]*(第[0-9零〇一二两三四五六七八九十百千]+[章回节])[ \t\u3000:：]*(.*)$/gmu

/** Decode bytes as UTF-8, falling back to GB18030 for older Chinese txt files. */
export function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/u, '')
  } catch {
    return new TextDecoder('gb18030').decode(bytes)
  }
}

/**
 * Split novel text into chapters. Text without headings becomes one chapter.
 * @returns {{ title: string, body: string }[]}
 */
export function splitChapters(text) {
  const normalized = String(text).replace(/\r\n?/gu, '\n')
  const marks = [...normalized.matchAll(HEADING_RE)]
  if (marks.length === 0) return [{ title: '', body: normalized.trim() }]
  const chapters = []
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index + marks[i][0].length
    const end = i + 1 < marks.length ? marks[i + 1].index : normalized.length
    const body = normalized.slice(start, end).trim()
    if (body.length === 0) continue
    chapters.push({ title: marks[i][2].trim(), body })
  }
  return chapters.length > 0 ? chapters : [{ title: '', body: normalized.trim() }]
}

/**
 * Write chapters into `<projectDir>/正文/` as 第N章_标题.md, numbered from 1.
 * @returns {number} chapters written.
 */
export function writeImportedChapters(dir, chapters) {
  const target = path.join(dir, CHAPTER_DIR)
  fs.mkdirSync(target, { recursive: true })
  chapters.forEach((chapter, index) => {
    const n = index + 1
    const title = safeName(chapter.title, 30)
    const file = title ? `第${n}章_${title}.md` : `第${n}章.md`
    const heading = title ? `# 第${n}章 ${title}` : `# 第${n}章`
    fs.writeFileSync(path.join(target, file), `${heading}\n\n${chapter.body}\n`, 'utf8')
  })
  return chapters.length
}
