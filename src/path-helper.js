/**
 * 项目目录路径验证和自动修正辅助工具
 * 提供防呆设计：自动修正、智能建议、路径规范化
 */
import path from 'node:path'

/**
 * 路径验证结果
 * @typedef {Object} PathValidationResult
 * @property {boolean} valid - 是否有效
 * @property {string} [normalized] - 规范化后的路径（如果有效）
 * @property {string} [error] - 错误信息
 * @property {string} [errorType] - 错误类型: 'absolute' | 'colon' | 'dots' | 'trailing' | 'illegal'
 * @property {string} [suggestion] - 修复建议（可自动应用的值）
 * @property {string} [message] - 用户友好的提示信息
 */

/**
 * 验证项目目录路径，并提供修复建议
 * @param {string} directory - 用户输入的目录路径
 * @param {string} [cwd] - 当前工作目录（用于从绝对路径提取相对路径）
 * @returns {PathValidationResult}
 */
export function validateProjectDirectory(directory, cwd) {
  // 基础检查
  if (typeof directory !== 'string' || !directory.trim()) {
    return {
      valid: false,
      error: '项目目录不能为空',
      errorType: 'empty',
      suggestion: 'novel_projects',
      message: '请输入项目目录，推荐使用 "novel_projects"'
    }
  }

  const value = directory.trim().replace(/\\/gu, '/')

  // 1. 检查绝对路径 - 尝试自动提取相对部分
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    let suggestion = null
    let message = '不能使用绝对路径'

    // 如果提供了工作目录，尝试提取相对路径
    if (cwd) {
      try {
        const normalized = path.normalize(directory.trim())
        const workDir = path.normalize(cwd)
        
        // 检查是否在工作目录内
        if (normalized.startsWith(workDir)) {
          const relative = path.relative(workDir, normalized).replace(/\\/g, '/')
          
          // 确保相对路径不含 .. 等
          if (relative && !relative.startsWith('..') && relative !== '.') {
            suggestion = relative
            message = `检测到绝对路径，建议使用相对路径 "${suggestion}"`
          }
        } else {
          // 不在工作目录内，提取最后几级目录作为建议
          const segments = normalized.split(path.sep).filter(Boolean)
          if (segments.length > 0) {
            // 如果是盘符后直接跟目录（如 E:\novels），取最后一级
            // 如果是多级路径（如 E:\work\novels），取最后一级或两级
            suggestion = segments[segments.length - 1]
            message = `路径不在工作目录内，建议使用 "${suggestion}"`
          }
        }
      } catch {
        // 路径解析失败，给出默认建议
      }
    }

    if (!suggestion) {
      // 尝试从路径中提取最后一级目录名
      const segments = value.split('/').filter(Boolean)
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1]
        // 移除盘符标识（如 "E:" -> ""）
        if (!lastSegment.includes(':')) {
          suggestion = lastSegment
        }
      }
      suggestion = suggestion || 'novel_projects'
      message = `不能使用绝对路径 "${value}"，建议改为 "${suggestion}"`
    }

    return {
      valid: false,
      error: '不能使用绝对路径',
      errorType: 'absolute',
      suggestion,
      message
    }
  }

  // 2. 检查冒号（Windows 盘符标识）
  if (value.includes(':')) {
    // 尝试提取冒号后的部分
    const afterColon = value.split(':')[1]
    const suggestion = afterColon?.replace(/^[/\\]+/, '') || 'novel_projects'
    
    return {
      valid: false,
      error: '路径不能包含冒号',
      errorType: 'colon',
      suggestion,
      message: `不能包含冒号 ":"，建议改为 "${suggestion}"`
    }
  }

  // 3. 检查空字符
  if (value.includes('\0')) {
    return {
      valid: false,
      error: '路径不能包含空字符',
      errorType: 'null',
      suggestion: 'novel_projects',
      message: '路径包含非法的空字符'
    }
  }

  // 4. 检查路径段
  const segments = value.split('/')
  const invalidSegment = segments.find((part) => 
    part === '..' || part === '.' || /[.\s]$/u.test(part) || /[<>"|?*\u0000-\u001f]/u.test(part)
  )

  if (invalidSegment !== undefined) {
    let suggestion = null
    let message = null

    // 4.1 处理 . 和 ..
    if (invalidSegment === '.' || invalidSegment === '..') {
      // 移除所有 . 和 .. 段
      const cleaned = segments.filter(s => s !== '.' && s !== '..' && s !== '').join('/')
      suggestion = cleaned || 'novel_projects'
      message = `不能包含 "." 或 ".." 路径段，建议改为 "${suggestion}"`
      
      return {
        valid: false,
        error: '不能包含 . 或 .. 路径段',
        errorType: 'dots',
        suggestion,
        message
      }
    }

    // 4.2 处理末尾空格或点
    if (/[.\s]$/u.test(invalidSegment)) {
      const cleaned = segments.map(s => s.replace(/[.\s]+$/g, '')).filter(Boolean).join('/')
      suggestion = cleaned || 'novel_projects'
      message = `路径段 "${invalidSegment}" 末尾不能有空格或点，建议改为 "${suggestion}"`
      
      return {
        valid: false,
        error: '路径段末尾不能有空格或点',
        errorType: 'trailing',
        suggestion,
        message
      }
    }

    // 4.3 处理非法字符
    if (/[<>"|?*\u0000-\u001f]/u.test(invalidSegment)) {
      // 移除非法字符
      const cleaned = segments.map(s => s.replace(/[<>"|?*\u0000-\u001f]/gu, '')).filter(Boolean).join('/')
      suggestion = cleaned || 'novel_projects'
      message = `路径段 "${invalidSegment}" 包含非法字符（< > " | ? *），建议改为 "${suggestion}"`
      
      return {
        valid: false,
        error: '路径段包含非法字符',
        errorType: 'illegal',
        suggestion,
        message
      }
    }
  }

  // 5. 规范化路径（移除空段、多余斜杠）
  const normalized = segments.filter(Boolean).join('/')
  
  if (!normalized) {
    return {
      valid: false,
      error: '路径为空',
      errorType: 'empty',
      suggestion: 'novel_projects',
      message: '规范化后路径为空，建议使用 "novel_projects"'
    }
  }

  // 6. 验证通过
  return {
    valid: true,
    normalized,
    message: normalized === value ? '路径有效' : `已规范化为 "${normalized}"`
  }
}

/**
 * 严格验证（用于运行时，拒绝无效路径）
 * @param {string} directory - 目录路径
 * @throws {TypeError} 路径无效时抛出详细错误
 */
export function strictValidateProjectDirectory(directory) {
  if (typeof directory !== 'string' || !directory.trim()) {
    throw new TypeError('项目目录必须是非空相对路径')
  }

  const value = directory.trim().replace(/\\/gu, '/')
  
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new TypeError(
      `项目目录不能使用绝对路径"${value}"，请使用相对路径如"novel_projects"或"books/novels"。详见 TROUBLESHOOTING_PROJECT_DIR.md`
    )
  }
  
  if (value.includes(':')) {
    throw new TypeError(
      `项目目录不能包含冒号":"（如"${value}"），请使用相对路径如"novel_projects"。详见 TROUBLESHOOTING_PROJECT_DIR.md`
    )
  }
  
  if (value.includes('\0')) {
    throw new TypeError('项目目录不能包含空字符')
  }
  
  const invalidPart = value.split('/').find((part) => 
    part === '..' || part === '.' || /[.\s]$/u.test(part) || /[<>"|?*\u0000-\u001f]/u.test(part)
  )
  
  if (invalidPart !== undefined) {
    if (invalidPart === '.' || invalidPart === '..') {
      throw new TypeError(
        `项目目录不能包含"."或".."路径段，请使用简单相对路径如"novel_projects"，而不是"${value}"。详见 TROUBLESHOOTING_PROJECT_DIR.md`
      )
    }
    if (/[.\s]$/u.test(invalidPart)) {
      throw new TypeError(
        `项目目录的路径段"${invalidPart}"末尾不能有点或空格，请修改后重试。详见 TROUBLESHOOTING_PROJECT_DIR.md`
      )
    }
    throw new TypeError(
      `项目目录的路径段"${invalidPart}"包含非法字符，不能使用 < > " | ? * 等字符。详见 TROUBLESHOOTING_PROJECT_DIR.md`
    )
  }

  const normalized = value.split('/').filter(Boolean).join('/')
  if (!normalized) {
    throw new TypeError('项目目录必须是非空相对路径')
  }

  return normalized
}

/**
 * 宽松验证并自动修正（用于配置界面）
 * @param {string} directory - 用户输入
 * @param {string} [cwd] - 当前工作目录
 * @returns {{ value: string, warnings: string[] }} 修正后的值和警告信息
 */
export function normalizeProjectDirectory(directory, cwd) {
  const result = validateProjectDirectory(directory, cwd)
  
  if (result.valid) {
    return {
      value: result.normalized,
      warnings: result.normalized !== directory.trim().replace(/\\/gu, '/') 
        ? [`已自动规范化为 "${result.normalized}"`]
        : []
    }
  }
  
  // 无效但有建议，返回建议值
  if (result.suggestion) {
    return {
      value: result.suggestion,
      warnings: [result.message, '已自动修正，请检查是否符合预期']
    }
  }
  
  // 无法修正，返回默认值
  return {
    value: 'novel_projects',
    warnings: [result.message, '已重置为默认值 "novel_projects"']
  }
}
