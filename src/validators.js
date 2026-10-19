/**
 * Input validators for command parameters.
 * Provides user-friendly error messages with emoji and examples.
 */

/**
 * Validate chapter number.
 * @param {string|number} input - Chapter number to validate
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
export function validateChapterNumber(input) {
  const num = parseInt(input)
  
  if (isNaN(num)) {
    return {
      valid: false,
      error: `❌ 章节号必须是数字

📝 正确示例：
  /novel-rewrite 15 增加冲突
  /novel-review 10`
    }
  }
  
  if (num < 1) {
    return {
      valid: false,
      error: '❌ 章节号必须大于 0'
    }
  }
  
  if (num > 10000) {
    return {
      valid: false,
      error: '❌ 章节号不能超过 10000'
    }
  }
  
  return { valid: true, value: num }
}

/**
 * Validate chapter range (e.g., "最近5章", "1-10").
 * @param {string} input - Range input
 * @returns {{ valid: boolean, type?: string, value?: number|object, error?: string }}
 */
export function validateChapterRange(input) {
  // 最近N章
  const recentMatch = input.match(/^最近(\d+)章$/u)
  if (recentMatch) {
    const count = parseInt(recentMatch[1])
    if (count < 1 || count > 100) {
      return {
        valid: false,
        error: '❌ 章节数量必须在 1-100 之间'
      }
    }
    return { valid: true, type: 'recent', value: count }
  }
  
  // 章节范围 1-10
  const rangeMatch = input.match(/^(\d+)-(\d+)$/u)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1])
    const end = parseInt(rangeMatch[2])
    
    if (start < 1 || end > 10000) {
      return {
        valid: false,
        error: '❌ 章节号必须在 1-10000 之间'
      }
    }
    
    if (start > end) {
      return {
        valid: false,
        error: '❌ 起始章节不能大于结束章节'
      }
    }
    
    return { valid: true, type: 'range', value: { start, end } }
  }
  
  // 单个章节号
  const single = validateChapterNumber(input)
  if (single.valid) {
    return { valid: true, type: 'single', value: single.value }
  }
  
  return {
    valid: false,
    error: `❌ 无法识别的章节范围格式

📝 支持的格式：
  单章：10
  范围：1-10
  最近：最近5章`
  }
}

/**
 * Validate project name.
 * @param {string} name - Project name
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function validateProjectName(name) {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: `❌ 项目名不能为空

💡 提示：项目名会用作文件夹名称`
    }
  }
  
  const trimmed = name.trim()
  
  if (trimmed.length > 50) {
    return {
      valid: false,
      error: `❌ 项目名太长（${trimmed.length} 字符）

📝 要求：最多 50 个字符
💡 当前：${trimmed.substring(0, 47)}...`
    }
  }
  
  // 检查非法字符（Windows 文件名限制）
  const illegalChars = /[<>:"/\\|?*\x00-\x1F]/g
  if (illegalChars.test(trimmed)) {
    return {
      valid: false,
      error: `❌ 项目名包含非法字符

🚫 不允许：< > : " / \\ | ? *
💡 提示：使用中文、英文、数字、下划线`
    }
  }
  
  return { valid: true, value: trimmed }
}

/**
 * Validate file path (for import).
 * @param {string} filepath - File path
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function validateFilePath(filepath) {
  if (!filepath || filepath.trim().length === 0) {
    return {
      valid: false,
      error: '❌ 文件路径不能为空'
    }
  }
  
  // 移除引号
  let cleaned = filepath.trim()
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1)
  }
  
  // 检查文件扩展名
  const validExtensions = ['.txt', '.md', '.markdown']
  const hasValidExt = validExtensions.some(ext => cleaned.toLowerCase().endsWith(ext))
  
  if (!hasValidExt) {
    return {
      valid: false,
      error: `❌ 不支持的文件格式

📝 支持的格式：
  .txt  - 纯文本
  .md   - Markdown
  
💡 当前：${cleaned}`
    }
  }
  
  return { valid: true, value: cleaned }
}

/**
 * Validate chapter target (e.g., "80章", "20万字").
 * @param {string} input - Target input
 * @returns {{ valid: boolean, type?: string, value?: number, error?: string }}
 */
export function validateChapterTarget(input) {
  // 所有校验函数的契约都是「返回 {valid:false,error}」而不是抛异常 ——
  // 调用方靠它给用户一句人话。这里原先直接 input.match，非字符串
  // （命令参数被解析成数字、或者上层传了 undefined）会抛 TypeError，
  // 用户看到的是堆栈而不是「请写成 80章 或 20万字」。
  if (typeof input !== 'string') {
    return { valid: false, error: '❌ 目标格式不正确，请写成「80章」或「20万字」' }
  }
  const text = input.trim()
  if (!text) {
    return { valid: false, error: '❌ 无法识别的目标格式，请写成「80章」或「20万字」' }
  }
  // 章节数：60章、80章
  const chapterMatch = text.match(/^(\d+)章$/u)
  if (chapterMatch) {
    const count = parseInt(chapterMatch[1])
    if (count < 1 || count > 10000) {
      return {
        valid: false,
        error: '❌ 章节数必须在 1-10000 之间'
      }
    }
    return { valid: true, type: 'chapters', value: count }
  }
  
  // 字数：20万字、50万字
  const wordMatch = text.match(/^(\d+)万字$/u)
  if (wordMatch) {
    const words = parseInt(wordMatch[1]) * 10000
    // 假设每章 3000 字
    const chapters = Math.ceil(words / 3000)
    if (chapters > 10000) {
      return {
        valid: false,
        error: '❌ 字数目标太大（超过 10000 章）'
      }
    }
    return { valid: true, type: 'words', value: chapters }
  }
  
  return {
    valid: false,
    error: `❌ 无法识别的目标格式

📝 支持的格式：
  章节：60章、80章
  字数：20万字、50万字
  
💡 示例：/novel 脑洞 80章`
  }
}

/**
 * Format error message with consistent style.
 * @param {string} message - Error message
 * @param {string[]} examples - Optional usage examples
 * @returns {string}
 */
export function formatError(message, examples = []) {
  let text = `❌ ${message}`
  
  if (examples.length > 0) {
    text += '\n\n📝 示例：\n'
    text += examples.map(ex => `  ${ex}`).join('\n')
  }
  
  return text
}

/**
 * Format success message with consistent style.
 * @param {string} message - Success message
 * @param {object} details - Optional details
 * @returns {string}
 */
export function formatSuccess(message, details = {}) {
  let text = `✅ ${message}`
  
  if (Object.keys(details).length > 0) {
    text += '\n\n'
    for (const [key, value] of Object.entries(details)) {
      text += `  ${key}：${value}\n`
    }
  }
  
  return text.trim()
}
