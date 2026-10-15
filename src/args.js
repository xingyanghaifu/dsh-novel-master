/**
 * Argument parsing for the novel commands. Every command receives one raw
 * string after the command name; options are recognised anywhere in it.
 */

export const DEFAULT_CHAPTERS = 40
export const MAX_CHAPTERS = 2000
/** Rough characters per chapter used to convert a 万字 target into chapters. */
export const CHARS_PER_CHAPTER = 2500

/**
 * Pull the shared options out of a raw input string.
 * Recognises: `60章` / `-c 60` / `--chapters 60`, `20万字`, `--auto` / `自动分岔`.
 * @param {string} raw
 * @returns {{ rest: string, chapters?: number, words?: number, auto: boolean }}
 */
export function extractOptions(raw) {
  let rest = ` ${String(raw ?? '')} `
  const take = (pattern) => {
    const match = rest.match(pattern)
    if (match === null) return null
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`
    return match
  }
  const out = { auto: false }
  const flagged = take(/\s(?:-c|--chapters)\s+(\d{1,4})(?=\s)/u)
  const written = flagged ?? take(/(\d{1,4})\s*章/u)
  if (written !== null) out.chapters = Number(written[1])
  const words = take(/(\d+(?:\.\d+)?)\s*万字/u)
  if (words !== null) out.words = Number(words[1])
  if (take(/\s(?:--auto|自动分岔)(?=\s)/u) !== null) out.auto = true
  out.rest = rest.replace(/\s+/gu, ' ').trim()
  return out
}

/**
 * Resolve a chapter count from explicit chapters, a 万字 target, or the fallback.
 * @param {{ chapters?: number, words?: number }} options
 * @param {number} [fallback]
 * @returns {number}
 */
export function chapterTarget(options, fallback = DEFAULT_CHAPTERS) {
  let chapters = options.chapters
  if (chapters === undefined && options.words !== undefined) {
    chapters = Math.round((options.words * 10000) / CHARS_PER_CHAPTER)
  }
  if (chapters === undefined || !Number.isFinite(chapters)) chapters = fallback
  return Math.min(MAX_CHAPTERS, Math.max(1, Math.trunc(chapters)))
}

/**
 * Split off a leading project name when it names an existing project.
 * @param {string} rest - input with options already removed.
 * @param {readonly string[]} projectNames - existing project directory names.
 * @returns {{ project?: string, note: string }}
 */
export function splitProject(rest, projectNames) {
  const text = rest.trim()
  if (text.length === 0) return { note: '' }
  // Longest match first so "修仙" does not shadow "修仙2".
  const sorted = [...projectNames].sort((a, b) => b.length - a.length)
  for (const name of sorted) {
    if (text === name) return { project: name, note: '' }
    if (text.startsWith(`${name} `)) return { project: name, note: text.slice(name.length).trim() }
  }
  return { note: text }
}

/**
 * Parse a leading chapter number ("12", "第12章", "12章").
 * @param {string} text
 * @returns {{ chapter?: number, note: string }}
 */
export function leadingChapter(text) {
  const match = String(text ?? '').trim().match(/^(?:第\s*)?(\d{1,4})\s*章?(?=\s|$)/u)
  if (match === null) return { note: String(text ?? '').trim() }
  return { chapter: Number(match[1]), note: String(text).trim().slice(match[0].length).trim() }
}
