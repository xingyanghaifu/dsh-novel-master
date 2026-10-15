/**
 * On-disk project layout and deterministic reads. Everything durable lives in
 * files under `<cwd>/novel_projects/<name>/`, so state survives compaction,
 * restarts and new sessions, and the user can edit it by hand.
 */
import fs from 'node:fs'
import path from 'node:path'

export const PROJECTS_DIR = 'novel_projects'
export const STATE_FILE = '项目.json'
export const RULES_FILE = '写作规范.md'
export const CHAPTER_DIR = '正文'
export const CHAPTER_RE = /^第(\d{1,4})章(?:[_\s-]*(.*?))?\.(?:md|txt)$/u

/** Directory that holds every project for this working directory. */
export function projectsRoot(cwd) {
  return path.join(cwd, PROJECTS_DIR)
}

/** Strip characters that are unsafe in Windows/macOS/Linux file names. */
export function safeName(text, max = 24) {
  const cleaned = String(text ?? '')
    .replace(/[\\/:*?"<>|\r\n\t]/gu, ' ')
    .replace(/[《》【】]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/^\.+/u, '')
  return [...cleaned].slice(0, max).join('').trim()
}

/** Names of existing project directories (skipping `_` helper dirs). */
export function listProjects(cwd) {
  const root = projectsRoot(cwd)
  let entries
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map((e) => e.name)
}

/** Most recently touched project, judged by its state file or directory mtime. */
export function latestProject(cwd) {
  const root = projectsRoot(cwd)
  let best
  let bestTime = -Infinity
  for (const name of listProjects(cwd)) {
    const dir = path.join(root, name)
    let time
    try {
      time = fs.statSync(path.join(dir, STATE_FILE)).mtimeMs
    } catch {
      time = fs.statSync(dir).mtimeMs
    }
    if (time > bestTime) {
      bestTime = time
      best = name
    }
  }
  return best
}

export function projectDir(cwd, name) {
  return path.join(projectsRoot(cwd), name)
}

/** Read `项目.json`; a missing or broken file yields `undefined`. */
export function readState(cwd, name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectDir(cwd, name), STATE_FILE), 'utf8'))
  } catch {
    return undefined
  }
}

/** Write `项目.json` atomically (temp file + rename). */
export function writeState(cwd, name, state) {
  const file = path.join(projectDir(cwd, name), STATE_FILE)
  const temp = `${file}.${process.pid}.tmp`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(temp, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
  fs.renameSync(temp, file)
}

/** Read a UTF-8 file under the project, or `undefined`. */
export function readProjectFile(cwd, name, file) {
  try {
    return fs.readFileSync(path.join(projectDir(cwd, name), file), 'utf8')
  } catch {
    return undefined
  }
}

/** Chapters sorted by number: `{ number, title, file, chars }`. */
export function listChapters(cwd, name) {
  const dir = path.join(projectDir(cwd, name), CHAPTER_DIR)
  let files
  try {
    files = fs.readdirSync(dir)
  } catch {
    return []
  }
  const chapters = []
  for (const file of files) {
    const match = file.match(CHAPTER_RE)
    if (match === null) continue
    const text = fs.readFileSync(path.join(dir, file), 'utf8')
    chapters.push({ number: Number(match[1]), title: (match[2] ?? '').trim(), file, chars: countChars(text) })
  }
  return chapters.sort((a, b) => a.number - b.number || a.file.localeCompare(b.file))
}

/** Count prose characters: everything except whitespace and Markdown markers. */
export function countChars(text) {
  return String(text).replace(/^#+\s.*$/gmu, '').replace(/[\s#*>`_-]/gu, '').length
}
