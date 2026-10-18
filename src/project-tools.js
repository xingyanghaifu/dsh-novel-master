/**
 * 把项目事实暴露成模型可调用的只读工具。
 *
 * 为什么需要：34 个斜杠命令只有在聊天框里手动输入才生效，别的插件和模型
 * 无法编排它们。这里把「读文件、能立刻给出结论」的那批能力暴露成工具，
 * 让模型可以自己串联：先 novel_projects 找项目，再 novel_read 取设定。
 *
 * 刻意只做只读。会写正文的命令（novel / novel-continue / novel-batch）
 * 不在这里，因为工具调用应当可预期，不该悄悄改动项目文件。
 */
import fs from 'node:fs'

import { NO_PROJECT, agentCwd, fail, projectExists } from './context.js'
import {
  CHAPTER_DIR, countChars, listChapters, projectDir, readProjectFile,
} from './project.js'

/**
 * 定位目标项目。工具没有 rawInput，项目名只能从参数取。
 *
 * 项目名会被拼进路径，所以必须先拒绝穿越写法。`projectExists` 只判断
 * 「拼出来的路径存在」，`..` 和 `书/../../` 都能指向真实目录，单靠它不够。
 */
function locate(exec, args) {
  const cwd = agentCwd(exec)
  const name = String(args?.project ?? '').trim()
  if (!name) {
    return { error: fail('请提供 project 参数：目标小说项目名。可先用 novel_projects 列出所有项目。') }
  }
  // 只允许单层目录名：不含分隔符、不是 . / ..、没有控制字符
  const unsafe = name.includes('/') || name.includes('\\') || name === '.' || name === '..'
    || /[\u0000-\u001f]/u.test(name)
  if (unsafe) {
    return { error: fail(`项目名不合法：${name}。只能用 novel_projects 列出的项目名。`) }
  }
  if (!projectExists(cwd, name)) return { error: fail(NO_PROJECT) }
  return { cwd, project: name }
}

/** 把结果包成工具输出块。 */
const text = (value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]

const PROJECT_PARAM = {
  type: 'string',
  description: '小说项目名，必须是已存在的项目目录名。',
}

/** 列项目：模型调用其它工具前先确认项目名。 */
export function listProjectsTool() {
  return {
    name: 'novel_projects',
    description: '列出当前工作区里的所有小说项目、章节数与总字数。调用其它 novel_* 工具前先用它确认项目名。',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    output: {
      schema: {
        type: 'object',
        properties: {
          projects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                chapters: { type: 'integer' },
                chars: { type: 'integer' },
              },
              required: ['name', 'chapters', 'chars'],
            },
          },
          total: { type: 'integer' },
        },
        required: ['projects', 'total'],
      },
      render: (_args, value) => text(value),
    },
    execute: async (args, exec) => {
      const cwd = agentCwd(exec)
      const root = projectDir(cwd, '')
      if (!fs.existsSync(root)) return { projects: [], total: 0 }
      const projects = []
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        try {
          const chapters = listChapters(cwd, entry.name)
          const chars = chapters.reduce((sum, chapter) => sum + chapter.chars, 0)
          projects.push({ name: entry.name, chapters: chapters.length, chars })
        } catch {
          // 单个项目读失败不影响整体列表
        }
      }
      return { projects, total: projects.length }
    },
  }
}

/** 项目进度：章节数、字数、缺失的设定文件。 */
export function projectStatusTool() {
  return {
    name: 'novel_status',
    description: '查看某个小说项目的进度：章节数、总字数、平均章长、缺失的设定文件。',
    parameters: {
      type: 'object',
      properties: { project: PROJECT_PARAM },
      required: ['project'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          chapters: { type: 'integer' },
          chars: { type: 'integer' },
          averageChars: { type: 'integer' },
          missing: { type: 'array', items: { type: 'string' } },
        },
        required: ['project', 'chapters', 'chars', 'averageChars', 'missing'],
      },
      render: (_args, value) => text(value),
    },
    execute: async (args, exec) => {
      const located = locate(exec, args)
      if (located.error) throw new Error(located.error.text)
      const { cwd, project } = located
      const chapters = listChapters(cwd, project)
      const chars = chapters.reduce((sum, chapter) => sum + chapter.chars, 0)
      // 关键设定文件，缺哪个一眼能看出来
      const wanted = ['设定.md', '角色.md', '大纲.md', '世界状态.md', '伏笔.md', '剧情树.md', '写作规范.md']
      const missing = wanted.filter((file) => readProjectFile(cwd, project, file) === undefined)
      return {
        project,
        chapters: chapters.length,
        chars,
        averageChars: chapters.length ? Math.round(chars / chapters.length) : 0,
        missing,
      }
    },
  }
}

/** 读设定文件：让模型按需取用，而不是把整本书塞进上下文。 */
export function readSettingTool() {
  return {
    name: 'novel_read',
    description: '读取某个小说项目的设定文件（设定/角色/大纲/世界状态/伏笔/剧情树/写作规范/地区/事件/脑洞/项目.json）。只读。',
    parameters: {
      type: 'object',
      properties: {
        project: PROJECT_PARAM,
        file: {
          type: 'string',
          description: '要读的文件名，如 设定.md、角色.md、大纲.md、世界状态.md、伏笔.md、剧情树.md、写作规范.md、地区.md、事件.md、脑洞.md、项目.json。',
        },
      },
      required: ['project', 'file'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          file: { type: 'string' },
          exists: { type: 'boolean' },
          chars: { type: 'integer' },
          content: { type: 'string' },
        },
        required: ['project', 'file', 'exists', 'chars', 'content'],
      },
      render: (_args, value) => text(value),
    },
    execute: async (args, exec) => {
      const located = locate(exec, args)
      if (located.error) throw new Error(located.error.text)
      const { cwd, project } = located
      const file = String(args?.file ?? '').trim()
      // 白名单：工具参数进路径拼接前必须过这一步，否则能把项目外文件读出来
      const allowed = ['设定.md', '角色.md', '大纲.md', '世界状态.md', '伏笔.md', '剧情树.md', '写作规范.md', '地区.md', '事件.md', '脑洞.md', '项目.json']
      if (!allowed.includes(file)) {
        throw new Error(`不支持读取 ${file}；可读：${allowed.join('、')}`)
      }
      const found = readProjectFile(cwd, project, file)
      const content = found ?? ''
      return { project, file, exists: found !== undefined, chars: countChars(content), content }
    },
  }
}

/** 读章节：先列清单，再按需取单章，超长自动截断。 */
export function readChapterTool() {
  return {
    name: 'novel_chapter_read',
    description: '读取某章的正文，或只列出全部章节文件名。只读。',
    parameters: {
      type: 'object',
      properties: {
        project: PROJECT_PARAM,
        chapter: {
          type: 'string',
          description: '章节文件名（如 第12章.md）。留空则只列出全部章节，不返回正文。',
        },
        maxChars: {
          type: 'integer',
          description: '正文字符上限，默认 8000，避免一次塞太满。',
        },
      },
      required: ['project'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          chapters: { type: 'array', items: { type: 'string' } },
          total: { type: 'integer' },
          chapter: { type: 'string' },
          chars: { type: 'integer' },
          truncated: { type: 'boolean' },
          content: { type: 'string' },
        },
        required: ['project', 'chapters', 'total'],
      },
      render: (_args, value) => text(value),
    },
    execute: async (args, exec) => {
      const located = locate(exec, args)
      if (located.error) throw new Error(located.error.text)
      const { cwd, project } = located
      const chapters = listChapters(cwd, project)
      const names = chapters.map((item) => item.file)
      const wanted = String(args?.chapter ?? '').trim()
      if (!wanted) return { project, chapters: names, total: names.length }
      if (!names.includes(wanted)) {
        throw new Error(`没有章节 ${wanted}；现有：${names.join('、')}`)
      }
      const limit = Math.max(500, Math.min(40000, Number(args?.maxChars) || 8000))
      const full = readProjectFile(cwd, project, `${CHAPTER_DIR}/${wanted}`) ?? ''
      const truncated = full.length > limit
      return {
        project,
        chapters: names,
        total: names.length,
        chapter: wanted,
        chars: countChars(full),
        truncated,
        content: truncated ? `${full.slice(0, limit)}\n…（已截断，共 ${countChars(full)} 字）` : full,
      }
    },
  }
}

/** 全部只读工具，交给 apply() 统一注册。 */
export function readonlyTools() {
  return [
    listProjectsTool(),
    projectStatusTool(),
    readSettingTool(),
    readChapterTool(),
  ]
}
