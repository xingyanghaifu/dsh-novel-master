/**
 * Argument parsing for the novel commands. Every command receives one raw
 * string after the command name; options are recognised anywhere in it.
 *
 * Parsing is deliberately tolerant. A command that silently ignores what the
 * user typed looks broken even when the code is correct, so the patterns here
 * accept the shapes people actually type: full-width digits, the "第N章" form,
 * "N章节", and flags glued to the preceding word without a space.
 */

export const DEFAULT_CHAPTERS = 40
export const MAX_CHAPTERS = 2000
/** Rough characters per chapter used to convert a 万字 target into chapters. */
export const CHARS_PER_CHAPTER = 2500

/** Fold full-width digits and the full-width space so one pattern covers both. */
function normalizeDigits(text) {
  return String(text ?? '')
    .replace(/[\uFF10-\uFF19]/gu, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/gu, ' ')
}

/**
 * Pull the shared options out of a raw input string.
 * Recognises: `60章` / `第60章` / `60章节` / `-c 60` / `--chapters 60`,
 * `20万字`, `--auto` / `自动分岔` / `-a`.
 *
 * Flags do not need surrounding spaces: `60章--auto` works, because requiring a
 * leading space made a trailing flag silently ignored.
 * @param {string} raw
 * @returns {{ rest: string, chapters?: number, words?: number, auto: boolean }}
 */
export function extractOptions(raw) {
  let rest = ` ${normalizeDigits(raw)} `
  const take = (pattern) => {
    const match = rest.match(pattern)
    if (match === null) return null
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`
    return match
  }
  const out = { auto: false }
  // "第60章" and "60章节" are consumed whole so no stray "第"/"节" leaks into
  // the project name. The lookahead keeps "60章的" from eating the next word.
  const flagged = take(/(?:^|\s)(?:-c|--chapters)\s*(\d{1,4})(?=\s|$)/u)
  const written = flagged ?? take(/(?:第\s*)?(\d{1,4})\s*章节?/u)
  if (written !== null) out.chapters = Number(written[1])
  const words = take(/(\d+(?:\.\d+)?)\s*万字/u)
  if (words !== null) out.words = Number(words[1])
  // A long flag may butt against the preceding word ("60章--auto"), so the only
  // requirement is that it is not glued to another word character.
  const autoFlag = take(/(?:^|[^\w-])(?:--auto|-a|自动分岔)(?=\s|$)/u)
  if (autoFlag !== null) out.auto = true
  else if (take(/自动分岔/u) !== null) out.auto = true
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
 *
 * Matching is exact on a known name first, then tolerant of surrounding
 * whitespace and a trailing "《》" or quote pair, which is how names arrive when
 * pasted from a document.
 * @param {string} rest - input with options already removed.
 * @param {readonly string[]} projectNames - existing project directory names.
 * @returns {{ project?: string, note: string }}
 */
export function splitProject(rest, projectNames) {
  const text = normalizeDigits(rest).trim()
  if (text.length === 0) return { note: '' }
  // Longest match first so "修仙" does not shadow "修仙2".
  const sorted = [...projectNames].sort((a, b) => b.length - a.length)
  for (const name of sorted) {
    if (text === name) return { project: name, note: '' }
    if (text.startsWith(`${name} `)) return { project: name, note: text.slice(name.length).trim() }
    // 《书名》 or "书名" or 「书名」 as the leading token.
    const quoted = [`《${name}》`, `"${name}"`, `“${name}”`, `「${name}」`, `'${name}'`]
      .find(shape => text === shape || text.startsWith(`${shape} `))
    if (quoted !== undefined) return { project: name, note: text.slice(quoted.length).trim() }
  }
  return { note: text }
}

/**
 * Parse a leading chapter number ("12", "第12章", "12章", "１２章").
 * @param {string} text
 * @returns {{ chapter?: number, note: string }}
 */
export function leadingChapter(text) {
  const source = normalizeDigits(text).trim()
  // Bare "12" is a chapter number too: chapter commands accept it.
  const match = source.match(/^(?:第\s*)?(\d{1,4})(?:\s*章节?)?(?=\s|$)/u)
  if (match === null) return { note: source }
  return { chapter: Number(match[1]), note: source.slice(match[0].length).trim() }
}
