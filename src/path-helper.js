import path from 'node:path'

const INVALID_SEGMENT_CHARACTERS = /[<>"|?*\u0000-\u001f]/u
const TRAILING_DOT_OR_SPACE = /[.\s]$/u

function safeSuggestion(value) {
  try {
    return strictValidateProjectDirectory(value)
  } catch {
    return undefined
  }
}

function relativeWithinWorkingDirectory(cwd, target, flavor) {
  if (typeof cwd !== 'string' || !cwd.trim()) return undefined
  const paths = flavor === 'win32' ? path.win32 : path.posix
  const workingDirectory = cwd.trim().replace(/\\/gu, '/')
  if (!paths.isAbsolute(workingDirectory)) return undefined

  const relative = paths.relative(paths.resolve(workingDirectory), paths.resolve(target))
  if (!relative || relative === '.' || relative === '..'
    || relative.startsWith(`..${paths.sep}`) || paths.isAbsolute(relative)) return undefined
  return safeSuggestion(relative.replace(/\\/gu, '/'))
}

/**
 * Validate a configured project path and, only when it preserves the same
 * location, offer a safe relative-path suggestion. Suggestions are advisory;
 * callers must not silently apply them.
 *
 * @param {string} directory User-provided path.
 * @param {string} [cwd] Session working directory for absolute-path conversion.
 * @returns {{valid: boolean, normalized?: string, error?: string, errorType?: string, suggestion?: string, message: string}}
 */
export function validateProjectDirectory(directory, cwd) {
  if (typeof directory !== 'string' || !directory.trim()) {
    return {
      valid: false,
      error: '项目目录不能为空',
      errorType: 'empty',
      message: '请输入相对于工作目录的项目目录。',
    }
  }

  const value = directory.trim().replace(/\\/gu, '/')
  const absoluteFlavor = /^[a-z]:\//iu.test(value) || value.startsWith('//') ? 'win32'
    : path.posix.isAbsolute(value) ? 'posix' : undefined

  if (absoluteFlavor) {
    const suggestion = relativeWithinWorkingDirectory(cwd, value, absoluteFlavor)
    return {
      valid: false,
      error: '不能使用绝对路径',
      errorType: 'absolute',
      ...(suggestion ? { suggestion } : {}),
      message: suggestion
        ? `绝对路径位于当前工作目录内；等价的相对路径是 "${suggestion}"。请确认后再保存。`
        : '项目目录必须是工作目录内的相对路径。此绝对路径无法安全转换；为避免改用另一个目录，不提供自动修复建议。',
    }
  }

  if (value.includes('\0')) {
    return { valid: false, error: '路径不能包含空字符', errorType: 'null', message: '路径包含非法的空字符，未提供自动修复建议。' }
  }

  if (value.includes(':')) {
    return { valid: false, error: '路径不能包含冒号', errorType: 'colon', message: '相对路径不能包含冒号；为避免改变目录含义，请手动填写有效路径。' }
  }

  const segments = value.split('/')
  const illegalSegment = segments.find(segment => INVALID_SEGMENT_CHARACTERS.test(segment))
  if (illegalSegment !== undefined) {
    return {
      valid: false,
      error: '路径段包含非法字符',
      errorType: 'illegal',
      message: `路径段 "${illegalSegment}" 包含文件系统不支持的字符；未自动移除字符，以免改用不同目录。`,
    }
  }

  const trailingSegment = segments.find(segment => segment !== '.' && segment !== '..' && TRAILING_DOT_OR_SPACE.test(segment))
  if (trailingSegment !== undefined) {
    return {
      valid: false,
      error: '路径段末尾不能有点或空格',
      errorType: 'trailing',
      message: `路径段 "${trailingSegment}" 末尾不能有点或空格；未自动修改目录名。`,
    }
  }

  const hasDotSegment = segments.some(segment => segment === '.' || segment === '..')
  const normalized = path.posix.normalize(value)
  const escapesWorkingDirectory = normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)
  const pointsToWorkingDirectory = normalized === '.'

  if (hasDotSegment) {
    const suggestion = !escapesWorkingDirectory && !pointsToWorkingDirectory
      ? safeSuggestion(normalized)
      : undefined
    return {
      valid: false,
      error: '不能包含 . 或 .. 路径段',
      errorType: 'dots',
      ...(suggestion ? { suggestion } : {}),
      message: suggestion
        ? `路径含有 . 或 .. 路径段；不改变目标位置的规范相对路径是 "${suggestion}"。请确认后再保存。`
        : '路径含有 . 或 .. 路径段，且目标位于工作目录之外或指向工作目录本身；拒绝自动修复。请手动选择工作目录内的子目录。',
    }
  }

  if (escapesWorkingDirectory || pointsToWorkingDirectory) {
    return {
      valid: false,
      error: '项目目录必须是非空相对路径且位于工作目录内',
      errorType: 'outside-root',
      message: '项目目录必须是工作目录内的非空子目录。',
    }
  }

  try {
    const strict = strictValidateProjectDirectory(value)
    return {
      valid: true,
      normalized: strict,
      message: strict === value ? '路径有效。' : `路径可规范化为 "${strict}"。`,
    }
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      errorType: 'invalid',
      message: error.message,
    }
  }
}

/**
 * Strict validation for command execution. By default the project root stays
 * below the working directory and rejects traversal, absolute paths, and unsafe
 * names.
 *
 * `allowAbsolute` is opt-in for the configured projects directory, where the
 * settings surface explicitly offers a "browse for a custom absolute path"
 * control. Accepting it here keeps the setting and the command consistent: it
 * used to be offered in the UI and then rejected at run time.
 */
export function strictValidateProjectDirectory(directory, { allowAbsolute = false } = {}) {
  if (typeof directory !== 'string' || !directory.trim()) {
    throw new TypeError('项目目录必须是非空相对路径')
  }

  const value = directory.trim().replace(/\\/gu, '/')
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    if (!allowAbsolute) throw new TypeError(`项目目录不能使用绝对路径"${value}"，请使用工作目录内的相对路径。`)
    return validateAbsoluteDirectory(value)
  }
  if (value.includes(':')) throw new TypeError('项目目录不能包含冒号。')
  if (value.includes('\0')) throw new TypeError('项目目录不能包含空字符。')

  const invalidPart = value.split('/').find(part => part === '..' || part === '.'
    || TRAILING_DOT_OR_SPACE.test(part) || INVALID_SEGMENT_CHARACTERS.test(part))
  if (invalidPart !== undefined) {
    if (invalidPart === '.' || invalidPart === '..') {
      throw new TypeError(`项目目录不能包含"."或".."路径段："${value}"。`)
    }
    if (TRAILING_DOT_OR_SPACE.test(invalidPart)) {
      throw new TypeError(`项目目录路径段"${invalidPart}"末尾不能有点或空格。`)
    }
    throw new TypeError(`项目目录路径段"${invalidPart}"包含非法字符。`)
  }

  const normalized = value.split('/').filter(Boolean).join('/')
  if (!normalized) throw new TypeError('项目目录必须是非空相对路径')
  return normalized
}

/**
 * Normalize an absolute projects directory. Traversal segments, a NUL byte and
 * the filesystem root are refused so a stray "C:/" cannot become the project
 * root and scatter files across a drive.
 */
function validateAbsoluteDirectory(value) {
  if (value.includes('\0')) throw new TypeError('项目目录不能包含空字符。')
  if (value.split('/').some(part => part === '..')) throw new TypeError(`项目目录不能包含".."路径段："${value}"。`)
  const resolved = path.win32.isAbsolute(value) ? path.win32.normalize(value) : path.posix.normalize(value)
  const trimmed = resolved.replace(/[\\/]+$/u, '')
  if (!trimmed || /^[A-Za-z]:$/u.test(trimmed)) throw new TypeError('项目目录不能是磁盘根目录。')
  if (trimmed === '/' || trimmed === '') throw new TypeError('项目目录不能是文件系统根目录。')
  return trimmed
}

/**
 * Return a strict normalized value when safe. For invalid inputs, preserve the
 * original value unless validation produced a semantically equivalent,
 * independently strict-validated suggestion. Never silently fall back to a
 * different project directory.
 *
 * @param {string} directory User-provided path.
 * @param {string} [cwd] Session working directory for absolute-path conversion.
 * @returns {{value: string, warnings: string[]}}
 */
export function normalizeProjectDirectory(directory, cwd) {
  const original = typeof directory === 'string' ? directory : ''
  const result = validateProjectDirectory(original, cwd)
  if (result.valid) {
    const normalizedInput = original.trim().replace(/\\/gu, '/')
    return {
      value: result.normalized,
      warnings: result.normalized !== normalizedInput ? [`已规范化为 "${result.normalized}"。`] : [],
    }
  }

  const suggestion = result.suggestion && safeSuggestion(result.suggestion)
  if (suggestion) {
    return {
      value: suggestion,
      warnings: [result.message, `建议值为 "${suggestion}"；应用前请确认目录位置未改变。`],
    }
  }

  return {
    value: original,
    warnings: [result.message, '未自动修改配置，请手动选择正确的项目目录。'],
  }
}
