/**
 * 作者人格相关命令：/novel-persona（选择与查看）、/novel-persona-study（拆书提取）。
 *
 * 与 /novel-study 的分工：那个命令产出给人读的 Markdown 风格档案，交给模型
 * 在会话里慢慢读；这里的命令产出结构化的 作者人格.json，写作命令能直接套用。
 * 两者都要，因为「拆完能照着写」和「拆完能看懂」是两件事。
 */
import fs from 'node:fs'
import path from 'node:path'

import { agentCwd, fail, ok } from './context.js'
import { decodeText } from './importer.js'
import { formatError, formatSuccess } from './validators.js'
import { listProjects, projectDir, projectRelativeDir } from './project.js'
import { actualModelOf } from './model-intelligence.js'
import {
  BUILTIN_PERSONA_IDS,
  BUILTIN_PERSONAS,
  PERSONA_FILE,
  builtinPersona,
  extractPersona,
  loadPersona,
  personaReport,
  savePersona,
  takePersonaOption,
  writePersonaToRules,
} from './author-persona.js'

/** 从原始输入里剥掉模型路由参数，剩下的才是项目名/文件路径。 */
function takeRouteOptions(raw) {
  const text = ` ${String(raw ?? '')} `
  const take = pattern => {
    const match = text.match(pattern)
    if (match === null) return undefined
    text.replace(match[0], ' ')
    return match[1]
  }
  let rest = text
  const grab = (pattern) => {
    const match = rest.match(pattern)
    if (match === null) return undefined
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`
    return match[1]
  }
  return {
    provider: grab(/(?:^|\s)--provider\s+([^\s]+)(?=\s|$)/iu),
    model: grab(/(?:^|\s)--model\s+([^\s]+)(?=\s|$)/iu),
    reasoningEffort: grab(/(?:^|\s)--effort\s+([^\s]+)(?=\s|$)/iu),
    rest: rest.replace(/\s+/gu, ' ').trim(),
  }
}

/** 解析项目名：显式给了就校验存在，否则用最近的。 */
function targetProject(cwd, name) {
  const projects = listProjects(cwd)
  const wanted = String(name ?? '').trim()
  if (!wanted) {
    if (projects.length === 0) return { error: formatError('还没有小说项目') }
    // 没有显式指定时不做猜测：人格是要落到某本书上的，选错书比报错更难发现。
    return {
      error: formatError('请指定项目名', [
        `现有项目：${projects.join('、')}`,
        '/novel-persona 项目名',
      ]),
    }
  }
  if (!projects.includes(wanted)) {
    return {
      error: formatError(`没有叫「${wanted}」的项目`, [`现有项目：${projects.join('、') || '（无）'}`]),
    }
  }
  return { project: wanted }
}

/** 读参考正文：优先附件，其次同目录下的文件路径。 */
function readReference(invocation, cwd, input) {
  const attachments = invocation.attachments ?? []
  if (attachments.length > 0) {
    const file = attachments[0]
    const name = String(file?.name ?? '附件')
    if (!/\.(?:txt|md|markdown)$/iu.test(name)) {
      return { error: formatError('参考文件只支持 .txt / .md', [`当前：${name}`]) }
    }
    // 附件内容可能是 base64 包装过的文本，decodeText 两种都认。
    const raw = file?.content ?? file?.data ?? file?.text
    if (typeof raw !== 'string' || raw.length === 0) {
      return { error: formatError(`附件「${name}」没有可读内容`) }
    }
    return { text: decodeText(Buffer.from(raw, /^[\w+/=\s]+$/u.test(raw) ? 'base64' : 'utf8')), label: name, source: '附件' }
  }
  if (!input) {
    return {
      error: formatError('请提供参考作品', [
        '/novel-persona-study 凡人修仙传.txt --to 我的书',
        '/novel-persona-study ./参考/某作者.txt',
        '或直接把 .txt 文件拖进来',
      ]),
    }
  }
  const file = path.resolve(cwd, input.replace(/^["']|["']$/gu, ''))
  let bytes
  try {
    bytes = fs.readFileSync(file)
  } catch {
    return { error: formatError(`读不到文件：${file}`) }
  }
  return { text: decodeText(bytes), label: path.basename(file, path.extname(file)), source: file }
}

/**
 * `/novel-persona [项目名] [风格id]` — 查看/设置当前项目的作者人格。
 *
 * 不带风格 id 时只显示现状和可选清单；带 id 时写入 作者人格.json，
 * 之后 /novel-continue 会自动套用，不必每次重复。
 */
export function personaCommand() {
  return {
    name: 'novel-persona',
    description: '查看或设置项目的作者风格（内置 5 种，也可以用拆书结果）',
    input: { hint: '[项目名] [风格id，留空查看]' },
    handler: (invocation) => {
      const cwd = agentCwd(invocation)
      const raw = (invocation.rawInput ?? '').trim()
      // Accept both shapes: `/novel-persona 项目 风格id` (positional, what the
      // hint advertises) and `/novel-persona 项目 --persona 风格id`. Parsing only
      // the flag silently ignored the positional form and just re-showed status.
      const option = takePersonaOption(raw)
      if (option.error !== undefined) {
        return fail(formatError(option.error, [`可用风格：${BUILTIN_PERSONA_IDS.join('、')}`]))
      }
      const parts = option.rest.split(/\s+/u).filter(Boolean)
      let personaId = option.personaId
      // A second bare word is the positional form advertised by the hint. If it
      // is not a built-in id, say so instead of ignoring it: silently dropping
      // "测试书 忘语" and just printing status looks like the command did nothing.
      if (personaId === undefined && parts.length >= 2) {
        if (BUILTIN_PERSONAS[parts[1]] === undefined) {
          return fail(formatError(`没有内置风格「${parts[1]}」`, [
            `可用风格：${BUILTIN_PERSONA_IDS.join('、')}`,
            `/novel-persona ${parts[0]} wangyu-classic`,
          ]))
        }
        personaId = parts[1]
        parts.length = 1
      }
      const target = targetProject(cwd, parts[0])
      if (target.error !== undefined) return fail(target.error)
      const name = target.project
      const current = loadPersona(cwd, name)

      if (personaId === undefined) {
        const list = BUILTIN_PERSONA_IDS
          .map(id => `  ${id}  ${BUILTIN_PERSONAS[id].name}`)
          .join('\n')
        const currentText = current === undefined
          ? '  当前没有设置风格，写作时只用 写作规范.md 的通用口径。'
          : `  当前风格：${current.name}\n${personaReport(current)}`
        return ok(formatSuccess(`《${name}》的作者风格`, {
          '📌 现状': `\n${currentText}`,
          '📚 内置风格': `\n${list}`,
          '💡 换风格': `/novel-persona ${name} wangyu-classic`,
          '💡 从作品提取': `/novel-persona-study 参考作品.txt --to ${name}`,
        }))
      }

      const persona = builtinPersona(personaId)
      const file = savePersona(cwd, name, { ...persona, source: `builtin:${personaId}` })
      writePersonaToRules(cwd, name, persona)
      return ok(formatSuccess(`《${name}》已套用风格：${persona.name}`, {
        '🎨 风格特征': `\n${personaReport(persona)}`,
        '📁 人格文件': file.replace(/\\/gu, '/'),
        '💡 下一步': `/novel-continue ${name} 10章 —— 写的时候会自动带上这个风格`,
      }))
    },
  }
}

/**
 * `/novel-persona-study <文件> [--to 项目名] [--provider X --model Y]` — 拆书提取人格。
 *
 * 模型是三段回退：命令行 > 插件设置 > 本会话实际路由。都不成立就报错并列出
 * 三条解决办法，绝不猜一个模型把整本参考作品发过去计费。
 */
export function personaStudyCommand(ctx, config) {
  return {
    name: 'novel-persona-study',
    description: '拆书提取作者人格：分析参考作品的写法，生成可套用的风格（可指定模型）',
    input: {
      hint: '<参考文件.txt|md> [--to 项目名] [--provider X --model Y --effort Z]',
      attachments: true,
    },
    handler: async (invocation) => {
      const cwd = agentCwd(invocation)
      const options = takeRouteOptions(invocation.rawInput)
      const toMatch = options.rest.match(/(?:^|\s)--to\s+(\S+)(?=\s|$)/u)
      const to = toMatch === null ? undefined : toMatch[1]
      const input = toMatch === null
        ? options.rest
        : `${options.rest.slice(0, toMatch.index)} ${options.rest.slice(toMatch.index + toMatch[0].length)}`.trim()

      if (to !== undefined) {
        const projects = listProjects(cwd)
        if (!projects.includes(to)) {
          return fail(formatError(`没有叫「${to}」的项目`, [`现有项目：${projects.join('、') || '（无）'}`]))
        }
      }

      const reference = readReference(invocation, cwd, input)
      if (reference.error !== undefined) return fail(reference.error)

      // 路由解析放在读文件之后：文件都读不到时不必去问会话模型是谁。
      const resolved = await resolveRoute(ctx, invocation, config, options)
      if (resolved.route === undefined) {
        return fail(formatError('不知道该用哪个模型分析', [
          '方法 1：命令行指定 —— /novel-persona-study 参考.txt --provider deepseek --model deepseek-chat',
          '方法 2：插件设置 → 作者人格提取 → 填 Provider 和 Model',
          '方法 3：先在会话里正常发一条消息，让插件读到实际路由',
          '本命令不会猜测模型，避免把整本参考作品发到别的模型上计费',
        ]))
      }

      let persona
      try {
        persona = await extractPersona(ctx, {
          text: reference.text,
          route: resolved.route,
          name: reference.label,
          signal: invocation.signal,
        })
      } catch (error) {
        // "指定 provider 未注册" surfaces from callText and reads like a plugin
        // bug. It means the host has no such provider, which is a config mistake,
        // so say where to look.
        const message = error?.message ?? String(error)
        if (/provider 未注册|unknown-provider|没有可验证路由的 llm 服务|llm-unavailable/u.test(message)) {
          return fail(formatError(`宿主没有可用模型「${resolved.route.provider}/${resolved.route.model}」`, [
            `原始错误：${message}`,
            '检查 Provider / Model 拼写是否与宿主的模型配置一致',
            '插件设置 → 作者人格提取，或命令行 --provider / --model',
          ]))
        }
        return fail(`提取作者人格失败：${message}`)
      }

      if (to === undefined) {
        // 没指定项目：只在回复里给结论，不落盘。用户可能只是想看看。
        return ok(formatSuccess(`作者人格分析：${reference.label}`, {
          '🎨 风格特征': `\n${personaReport(persona)}`,
          '🤖 使用模型': `${persona.model}（来源：${routeSourceLabel(resolved.source)}）`,
          '📏 分析样本': `${Math.round(persona.evidence.chars / 1000)}K 字${persona.truncated ? '（已截断）' : ''}`,
          '💾 未保存': `加 --to 项目名 可写入项目的 ${PERSONA_FILE}`,
        }))
      }

      const file = savePersona(cwd, to, { ...persona, source: `study:${reference.label}` })
      // 拆完要立刻能用：只在 作者人格.json 里还不够，写作命令每轮读的是
      // 写作规范.md，不写进去就要等下一次 /novel-* 才生效。
      writePersonaToRules(cwd, to, persona)
      return ok(formatSuccess(`作者人格已保存到《${to}》`, {
        '🎨 风格特征': `\n${personaReport(persona)}`,
        '🤖 使用模型': `${persona.model}（来源：${routeSourceLabel(resolved.source)}）`,
        '📏 分析样本': `${Math.round(persona.evidence.chars / 1000)}K 字${persona.truncated ? '（已截断）' : ''}`,
        '📁 人格文件': `${projectRelativeDir(to)}/${PERSONA_FILE}`,
        '💡 下一步': `/novel-continue ${to} 10章 —— 写的时候会自动带上这个风格`,
      }))
    },
  }
}

/** 路由来源的中文说明，回执里让用户知道用的是哪个模型、为什么是它。 */
function routeSourceLabel(source) {
  return {
    command: '命令行指定',
    settings: '插件设置',
    session: '本会话实际路由',
  }[source] ?? source
}

/**
 * 三段回退：命令行 > 插件设置 > 会话实际路由。
 * 与 author-persona.resolvePersonaRoute 同序，这里只负责把设置段取出来。
 */
async function resolveRoute(ctx, invocation, config, options) {
  const { resolvePersonaRoute } = await import('./author-persona.js')
  const read = value => (value && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value)
  // Key must match the Config schema in index.js (`persona`). Reading a
  // differently-named key silently disabled the configured route.
  const section = read(config?.persona) ?? {}
  // 配置段可能是 volatile 包装的整块对象，逐字段 unwrap 一次。
  const unwrapped = {}
  for (const key of ['provider', 'model', 'reasoningEffort']) {
    unwrapped[key] = read(section?.[key])
  }
  return resolvePersonaRoute(ctx, invocation, unwrapped, options)
}
