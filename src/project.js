/**
 * On-disk project layout and deterministic reads. Everything durable lives in
 * files under `<cwd>/novel_projects/<name>/`, so state survives compaction,
 * restarts and new sessions, and the user can edit it by hand.
 */
import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'
import { strictValidateProjectDirectory } from './path-helper.js'

const projectsDirectory = new AsyncLocalStorage()

/**
 * Validate once per command; never mutate a process-wide directory setting.
 *
 * Absolute directories are accepted here because the settings surface offers a
 * browse-for-custom-path control for `projectsDir`. Without this the UI promised
 * something the command then refused.
 */
export function withProjectsDirectory(directory, operation) {
  // Keep the type guard: coercion would turn 42 into a valid-looking path.
  const raw = typeof directory === 'string' ? directory.trim().replace(/\\/gu, '/') : directory
  const absolute = typeof raw === 'string'
    && (path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw))
  const normalized = strictValidateProjectDirectory(raw, { allowAbsolute: absolute })
  return projectsDirectory.run(normalized, operation)
}


/** Immutable directory snapshot for the current command and its async work. */
export function configuredProjectsDirectory() {
  return projectsDirectory.getStore() ?? PROJECTS_DIR
}

/** Portable path for receipts, prompts and persisted workflows. */
export function projectRelativeDir(name) {
  const configured = configuredProjectsDirectory()
  // An absolute root is reported as-is: inventing a relative path would point
  // somewhere the file is not, and receipts must name a real location.
  if (path.win32.isAbsolute(String(configured)) || path.posix.isAbsolute(String(configured).replace(/\\/gu, '/'))) {
    return `${String(configured).replace(/\\/gu, '/').replace(/\/+$/u, '')}/${name}`
  }
  return `${configured}/${name}`
}

export const PROJECTS_DIR = 'novel_projects'
export const STATE_FILE = '项目.json'
export const RULES_FILE = '写作规范.md'
export const CHAPTER_DIR = '正文'
export const CHAPTER_RE = /^第(\d{1,4})章(?:[_\s-]*(.*?))?\.(?:md|txt)$/u

/** Directory that holds every project for this working directory. */
export function projectsRoot(cwd) {
  const configured = configuredProjectsDirectory()
  // An absolute projects directory is used as-is: it is the user's explicit
  // choice and is not required to live under the working directory.
  if (path.posix.isAbsolute(String(configured).replace(/\\/gu, '/')) || path.win32.isAbsolute(String(configured))) {
    return path.resolve(configured)
  }
  const root = path.resolve(cwd, configured)
  const relative = path.relative(path.resolve(cwd), root)
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new TypeError('项目目录必须位于工作目录内')
  }
  return root
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

/**
 * 往项目目录里写一个文本文件，原子替换。
 *
 * 和 writeState 一样先写临时文件再 rename —— 中途失败不会留下半个文件，
 * 读者永远看到完整的旧版本或完整的新版本。
 *
 * 文件名必须落在项目目录内。这个函数会被「把地形导出为地图资产」这类
 * 上层调用，文件名一旦能被外部影响，`../` 就能写到项目外面去。这里用
 * 解析后的绝对路径做前缀比对，而不是正则拦 `..` —— 后者挡不住符号链接，
 * 也挡不住 Windows 上的短名与大小写差异。
 *
 * @returns {boolean} 是否写入成功
 */
export function writeProjectFile(cwd, name, file, content) {
  const root = path.resolve(projectDir(cwd, name))
  const target = path.resolve(root, file)
  // 等于 root 说明 file 解析成了目录本身；不在 root 下说明穿越了
  if (target === root || !target.startsWith(root + path.sep)) return false
  const temp = `${target}.${process.pid}.tmp`
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(temp, content, 'utf8')
    fs.renameSync(temp, target)
    return true
  } catch {
    // 失败时清掉临时文件，别在项目里留垃圾
    try { fs.rmSync(temp, { force: true }) } catch { /* 清理失败就算了 */ }
    return false
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
