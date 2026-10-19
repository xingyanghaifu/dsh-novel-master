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
  PERSONA_DIMENSIONS,
  PERSONA_FILE,
  builtinPersona,
  extractPersona,
  loadPersona,
  personaReport,
  savePersona,
  takePersonaOption,
  writePersonaToRules,
} from './author-persona.js'

/**
 * 从自然语言里认出用户要什么。
 *
 * 命令参数要求 `--只取 对话 --to 某书`，但人说话不是这么说的：「这本小说
 * 对话写得好，帮我拼到《网管修仙》上」才是常态。这里只做「认出明显意图」，
 * 不做猜测：认不出来就返回空，让后续流程按原样把输入当文件路径处理，
 * 并在缺少必要信息时报错给出正确写法。
 *
 * @param {string} raw - 原始输入。
 * @returns {{only?: string, to?: string, consumed: boolean}}
 */
export function parseNaturalIntent(raw) {
  const text = String(raw ?? '')
  const result = { consumed: false }

  // 项目名：《书名》、「书名」、"书名"、直接说「拼到网管修仙上」都认。
  const quoted = text.match(/[《「"“]([^》」"”]{1,60})[》」"”]/u)
  if (quoted !== null) {
    result.to = quoted[1].trim()
    result.consumed = true
  } else {
    // 没有引号时只认「拼到 / 拼给 / 接到 / 合到 X」这种明确句式，
    // 后面必须是已有项目名；否则一句普通描述也会被当成项目名。
    const bare = text.match(/(?:拼到|拼给|拼进|接到|合到|应用到|套到)\s*([^\s，,。；;]{1,40})/u)
    if (bare !== null) {
      result.to = bare[1].replace(/(?:上|里|中|去|吧|了)$/u, '').trim()
      result.consumed = true
    }
  }

  // 维度：只认到明确的维度词为止，避免把整句话当成维度。
  // 「对话写得好」「对白很棒」「只学对话」都指向 dialogueStyle。
  const dimensionWords = []
  const patterns = [
    /(叙事节奏|节奏|故事节奏)/gu,
    /(对话风格|对话|对白|台词)/gu,
    /(描写密度|描写|细节|画面感)/gu,
    /(情感基调|情感|情绪|基调)/gu,
    /(冲突烈度|冲突|张力|矛盾)/gu,
    /(人物刻画|人物|角色|人设)/gu,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (!dimensionWords.includes(match[1])) dimensionWords.push(match[1])
    }
  }
  if (dimensionWords.length > 0) {
    result.only = dimensionWords.join(',')
    result.consumed = true
  }
  return result
}

/**
 * 用模型理解整句话的意图，作为规则识别的兜底。
 *
 * 规则（parseNaturalIntent）只认固定说法，遇到「把那份对白的味道挪过去」
 * 这种表述就认不出。这里让模型在**已给出的选项范围内**挑：项目必须是真实
 * 存在的，维度必须是六个之一。返回 null 表示模型也没听懂，调用方继续按
 * 原逻辑报错，不假装成功。
 *
 * @param {object} ctx - 宿主上下文。
 * @param {object} route - { provider, model, reasoningEffort? }。
 * @param {string} text - 用户原话。
 * @param {string[]} projects - 真实存在的项目名。
 * @param {object} signal - 取消信号。
 * @returns {Promise<{only?: string, to?: string} | null>}
 */
export async function modelIntent(ctx, route, text, projects, signal) {
  const { callText } = await import('./model-intelligence.js')
  const dimensions = PERSONA_DIMENSIONS.map(item => `${item.key}=${item.label}`).join('、')
  const system = [
    '你是命令行参数解析器。用户下了一条拆书命令，但用自然语言说了需求，你要把它翻译成参数。',
    `可用的维度（只能选这些，写 key）：${dimensions}`,
    `实际存在的项目（只能选这些，一字不差）：${projects.join('、') || '（无）'}`,
    '只返回一个 JSON 对象，字段：only（字符串数组，元素必须是上面维度的 key；没说就是空数组）、to（字符串，必须是上面项目之一；没说是 null）、reason（简短依据）。',
    '不要输出 Markdown 或额外字段。认不出就返回 {"only":[],"to":null,"reason":"..."}，不要编造。',
  ].join('\n')
  let raw
  try {
    raw = await callText(ctx, {
      ...route,
      signal,
      system,
      prompt: `用户原话：${text}`,
      maxTokens: 400,
      maxOutputChars: 2000,
      timeoutMs: 30000,
      // limits 只认配置名（default/batch/probe），传对象会被拒成
      // 「未知的调用上限配置」。意图解析很短，用默认档就够。
    })
  } catch {
    // 兜底失败不该盖掉主流程的错误提示：模型听不懂时，调用方会退回
    // 规则结果或给出明确的可用参数说明。
    return null
  }
  let parsed
  try {
    const match = String(raw).match(/\{[\s\S]*\}/u)
    parsed = JSON.parse(match === null ? String(raw) : match[0])
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const keys = Array.isArray(parsed.only)
    ? parsed.only.filter(key => PERSONA_DIMENSIONS.some(item => item.key === key))
    : []
  const to = typeof parsed.to === 'string' && projects.includes(parsed.to.trim()) ? parsed.to.trim() : undefined
  if (keys.length === 0 && to === undefined) return null
  return {
    ...(keys.length === 0 ? {} : { only: keys.join(',') }),
    ...(to === undefined ? {} : { to }),
  }
}

/** 从原始输入里剥掉模型路由参数，剩下的才是项目名/文件路径。 */
function takeRouteOptions(raw) {
  const text = ` ${String(raw ?? '')} `
  const grab = (pattern, current) => {
    const match = current.rest.match(pattern)
    if (match === null) return undefined
    current.rest = `${current.rest.slice(0, match.index)} ${current.rest.slice(match.index + match[0].length)}`
    return match[1]
  }
  const current = { rest: text }
  const provider = grab(/(?:^|\s)--provider\s+([^\s]+)(?=\s|$)/iu, current)
  const model = grab(/(?:^|\s)--model\s+([^\s]+)(?=\s|$)/iu, current)
  const reasoningEffort = grab(/(?:^|\s)--effort\s+([^\s]+)(?=\s|$)/iu, current)
  const listModels = grab(/(?:^|\s)--(?:list-models|模型列表)(?=\s|$)/iu, current) !== undefined
  // 只取某几个维度并拼到已有风格上。值里允许中文与逗号：`--只取 对话`、
  // `--只取 对话,冲突烈度`。用「直到下一个 -- 参数」的贪婪匹配，否则
  // `--只取 对话 --to 某书` 会把 `--to` 当成维度单词的一部分。
  let only
  const onlyMatch = current.rest.match(/(?:^|\s)--(?:只取|只学|only)\s+([^-][\s\S]*?)(?=\s--|$)/iu)
  if (onlyMatch !== null) {
    only = onlyMatch[1].trim()
    current.rest = `${current.rest.slice(0, onlyMatch.index)} ${current.rest.slice(onlyMatch.index + onlyMatch[0].length)}`
  }
  let to
  const toMatch = current.rest.match(/(?:^|\s)--to\s+([^\s]+)(?=\s|$)/iu)
  if (toMatch !== null) {
    to = toMatch[1]
    current.rest = `${current.rest.slice(0, toMatch.index)} ${current.rest.slice(toMatch.index + toMatch[0].length)}`
  }
  return {
    provider,
    model,
    reasoningEffort,
    listModels,
    only,
    to,
    explicit: { provider: provider !== undefined, model: model !== undefined, only: only !== undefined, to: to !== undefined },
    rest: current.rest.replace(/\s+/gu, ' ').trim(),
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
      hint: '<参考文件.txt|md> [--to 项目名] [--只取 维度] [--provider X --model Y --effort Z]',
      attachments: true,
    },
    handler: async (invocation) => {
      const cwd = agentCwd(invocation)
      const options = takeRouteOptions(invocation.rawInput)

      // 先看清有哪些模型可用再选，比让用户猜 provider/model 拼写靠谱得多。
      if (options.listModels) {
        const { discoverHostModels } = await import('./models-discovery.js')
        const failures = []
        const { models } = await discoverHostModels(ctx, failures)
        if (models.length === 0) {
          return fail(formatError('宿主没有可发现的模型', [
            ...failures.map(item => `${item.source}：${item.message}`),
            '直接在命令里指定：--provider X --model Y',
            '或在插件设置 → 作者人格提取 里填写',
          ]))
        }
        const lines = models.map(item => `  ${item.provider}  ${item.model}${item.tag ? `  [${item.tag}]` : ''}`)
        return ok(formatSuccess('可用于拆书的模型', {
          '🤖 可用列表': `\n${lines.join('\n')}`,
          '💡 临时指定': `/novel-persona-study 参考.txt --provider <上面第一个> --model <第二个>`,
          '⚙️ 长期配置': '插件设置 → 作者人格提取（拆书）/ 自然语言意图解析（只用来听懂人话）',
        }))
      }

      // 自然语言兜底：显式参数优先，缺的部分才从整句话里认。
      // 「这本小说对话写得好，帮我拼到《网管修仙》上」不该要求用户改写。
      const intent = parseNaturalIntent(options.rest)
      let only = options.only ?? intent.only
      let to = options.to ?? intent.to

      // 规则没认全时问模型。规则免费且确定，所以永远先跑规则；只在「确实
      // 像自然语言」时才花一次请求。
      // 判断不能只看「含中文」：`我的书.txt` 也是中文，但那是一个纯参数
      // 调用，不该因此多花一次请求，更不该被误判成听不懂。
      const stripped = options.rest.replace(/[^\s"'《》「」\\/:]+\.(?:txt|md|markdown)/giu, ' ').trim()
      const looksLikeProse = intent.consumed || /[\u4e00-\u9fa5]{2,}/u.test(stripped)
      const incomplete = looksLikeProse && (only === undefined || to === undefined)
      if (incomplete && options.listModels !== true) {
        const early = await resolveIntentRoute(ctx, invocation, config, options)
        if (early.route !== undefined) {
          const guessed = await modelIntent(ctx, early.route, options.rest, listProjects(cwd), invocation.signal)
          if (guessed !== null) {
            // 规则常常只认出一个维度（「人说话和冲突」里只匹配到「冲突」），
            // 而模型能看出两个。此时采用模型更全的那份 —— 但仅限「规则结果
            // 是模型的子集」：反过来就不行，那等于让模型覆盖明确的规则命中。
            // 比较前必须都换成 key：规则给的是口语词（冲突），模型给的是
            // conflictIntensity，直接比永远不相等。
            if (only === undefined) only = guessed.only
            else if (guessed.only !== undefined) {
              const { parseFocusDimensions } = await import('./author-persona.js')
              const ruleKeys = parseFocusDimensions(only).keys
              const modelKeys = parseFocusDimensions(guessed.only).keys
              const subset = ruleKeys.every(key => modelKeys.includes(key))
              if (subset && modelKeys.length > ruleKeys.length) only = guessed.only
            }
            to = to ?? guessed.to
          }
          if (options.only === undefined && options.to === undefined && guessed === null) {
            // 规则和模型都没听懂：说明白，别让用户对着「读不到文件」猜。
            return fail(formatError('没听懂这条命令要做什么', [
              '可以直接用参数：/novel-persona-study 参考.txt --只取 对话 --to 项目名',
              `可用维度：${PERSONA_DIMENSIONS.map(item => item.label).join('、')}`,
              `现有项目：${listProjects(cwd).join('、') || '（无）'}`,
            ]))
          }
        }
      }
      // 自然语言认出的部分要从剩余输入里去掉，否则「《书名》」会被当成
      // 参考文件路径去找。但只删「认出来的那些词」，其余原样保留 ——
      // 文件路径常常和自然语言混在同一句里（`这本书.txt 对话写得好…`），
      // 整句清掉就找不到参考作品了。
      let input = options.rest
      if (options.to === undefined && intent.to !== undefined) {
        input = input.replace(/[《「"“][^》」"”]{1,60}[》」"”]/u, ' ')
        if (intent.to !== undefined) input = input.replace(intent.to, ' ')
      }
      if (options.only === undefined && intent.only !== undefined) {
        for (const word of intent.only.split(',')) input = input.replace(word, ' ')
      }
      // 去掉「拼到 / 写得很好 / 帮我」这类已经用过的口语残渣，留下路径。
      input = input
        .replace(/拼到|拼给|拼进|接到|合到|应用到|套到|挪到|移到|搬过去|挪过去|移植|帮我|帮忙|我想|我要|把|的话|写得好|写得不错|很好|很棒|不错/gu, ' ')
        .replace(/[，,。；;、]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
      // 自然语言和路径混在一句里时，上面的清洗必然留下碎片（「这本书 上」）。
      // 与其把碎片拼成不存在的路径，不如在目录里认含扩展名的真实文件：
      // 句子中出现的路径优先，其次是整句里唯一带扩展名的词。
      // 只要句子被自然语言解析过（规则或模型），就可能夹着非路径的词。
      // 此时必须在 input 里挑出真正的文件，否则会把整句当成路径读不到。
      if (intent.consumed || only !== undefined || to !== undefined) {
        const candidates = input.split(/\s+/u).filter(token => /\.(?:txt|md|markdown)$/iu.test(token))
        if (candidates.length > 0) {
          // 取最长的那个：「这本书.txt」优于可能残留的「书.txt」。
          input = candidates.sort((a, b) => b.length - a.length)[0]
        } else {
          const anywhere = options.rest.match(/[^\s"'《》「」]+\.(?:txt|md|markdown)/iu)
          if (anywhere !== null) input = anywhere[0]
        }
      }

      if (to !== undefined) {
        const projects = listProjects(cwd)
        if (!projects.includes(to)) {
          return fail(formatError(`没有叫「${to}」的项目`, [`现有项目：${projects.join('、') || '（无）'}`]))
        }
      }

      const reference = readReference(invocation, cwd, input)
      if (reference.error !== undefined) {
        // 说了「拼到某本书」但没给参考文件：这是能理解的最常见漏项，
        // 直接说要给什么，而不是丢一句「读不到文件」。
        if (to !== undefined && only !== undefined) {
          return fail(formatError('还没有参考作品可以拆', [
            '请把参考文件附上，或在命令后写文件路径',
            `/novel-persona-study 参考.txt ${only === undefined ? '' : `--只取 ${only} `}--to ${to}`,
          ]))
        }
        return fail(reference.error)
      }

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

      // --只取 的前置检查必须放在调用模型之前：没有基础风格时先把错误说清楚，
      // 不要让用户白付一次请求才发现拼不了。
      let mergeBase
      if (only !== undefined) {
        const { mergePersonaDimensions, parseFocusDimensions, PERSONA_DIMENSIONS: dims } = await import('./author-persona.js')
        const parsed = parseFocusDimensions(only)
        if (parsed.unknown.length > 0) {
          return fail(formatError(`不认识的维度：${parsed.unknown.join('、')}`, [
            `可用维度：${dims.map(item => `${item.key}（${item.label}）`).join('、')}`,
            '也可以只说中文：--只取 对话',
          ]))
        }
        if (to === undefined) {
          return fail(formatError('还不知道要拼给哪个项目', [
            '拼接需要一个已有的风格作底子，请说明是哪本书',
            `/novel-persona-study 参考.txt --只取 ${parsed.keys.map(key => dims.find(item => item.key === key)?.label ?? key).join(',')} --to 我的书`,
            '或者用书名号写：《我的书》',
          ]))
        }
        const base = loadPersona(cwd, to)
        if (base === undefined) {
          return fail(formatError(`《${to}》还没有风格可以拼接`, [
            `先建一个基础风格：/novel-persona ${to} wangyu-classic`,
            `或直接不加 --只取 做一次完整分析：/novel-persona-study ${reference.label}.txt --to ${to}`,
          ]))
        }
        mergeBase = { base, keys: parsed.keys, merge: mergePersonaDimensions }
      }

      let persona
      try {
        persona = await extractPersona(ctx, {
          text: reference.text,
          route: resolved.route,
          name: reference.label,
          signal: invocation.signal,
          // 值已在上面的 --只取 处理里校验过；这里传原始数组形式，
          // 让 extractPersona 只评这几个维度。
          ...(only === undefined ? {} : { only: [only] }),
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
        if (/不认识的维度|unknown-dimension/u.test(message)) return fail(formatError(message))
        return fail(`提取作者人格失败：${message}`)
      }

      // 长篇只按百分比采样，回执里说清楚分析范围，避免用户以为读了全书。
      const sampleLine = persona.truncated
        ? `${Math.round(persona.evidence.chars / 1000)}K 字（均匀采样约 ${Math.round((persona.covered ?? 0) * 100)}%）`
        : `${Math.round(persona.evidence.chars / 1000)}K 字（全文）`

      // --只取：把参考作品的部分维度拼到已有风格上，其余维度保持原样。
      // 前置检查已在调用模型前做完，这里只做合并。
      let merged
      if (mergeBase !== undefined) {
        merged = mergeBase.merge(mergeBase.base, persona, mergeBase.keys)
        merged.name = mergeBase.base.name
      }

      if (to === undefined) {
        // 没指定项目：只在回复里给结论，不落盘。用户可能只是想看看。
        return ok(formatSuccess(`作者人格分析：${reference.label}`, {
          '🎨 风格特征': `\n${personaReport(persona)}`,
          '🤖 使用模型': `${persona.model}（来源：${routeSourceLabel(resolved.source)}）`,
          '📏 分析样本': sampleLine,
          '💾 未保存': `加 --to 项目名 可写入项目的 ${PERSONA_FILE}`,
        }))
      }

      const final = merged ?? persona
      const file = savePersona(cwd, to, { ...final, source: `study:${reference.label}` })
      // 拆完要立刻能用：只在 作者人格.json 里还不够，写作命令每轮读的是
      // 写作规范.md，不写进去就要等下一次 /novel-* 才生效。
      writePersonaToRules(cwd, to, final)
      const pickedKeys = merged === undefined ? [] : Object.keys(merged.mergedFrom ?? {})
      const pickedLine = pickedKeys.length === 0
        ? undefined
        : pickedKeys.map(key => PERSONA_DIMENSIONS.find(item => item.key === key)?.label ?? key).join('、')
      return ok(formatSuccess(`作者人格已保存到《${to}》`, {
        '🎨 风格特征': `\n${personaReport(final)}`,
        ...(pickedLine === undefined
          ? {}
          : { '🧩 拼接维度': `${pickedLine}　取自《${reference.label}》，其余维度保持原样` }),
        '🤖 使用模型': `${persona.model}（来源：${routeSourceLabel(resolved.source)}）`,
        '📏 分析样本': sampleLine,
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

/**
 * 意图解析专用的路由：`personaIntent` > 拆书设置 > 会话实际路由。
 *
 * 单独配一档是为了让你能给「听懂人话」这件事换个模型：便宜模型够用时
 * 省钱，话风绕的时候换成强模型。没配就沿用拆书模型，行为与之前一致。
 * 命令行 `--provider/--model` 仍然最高优先——用户当场指定就该听他的。
 */
async function resolveIntentRoute(ctx, invocation, config, options) {
  const { resolvePersonaRoute } = await import('./author-persona.js')
  const read = value => (value && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value)
  const section = read(config?.personaIntent) ?? {}
  const unwrapped = {}
  for (const key of ['provider', 'model', 'reasoningEffort']) {
    unwrapped[key] = read(section?.[key])
  }
  const dedicated = await resolvePersonaRoute(ctx, invocation, unwrapped, options)
  if (dedicated.route !== undefined) {
    return { ...dedicated, source: dedicated.source === 'settings' ? 'intent-settings' : dedicated.source }
  }
  // 意图档没配全（比如只填了 provider）：退回拆书那套，别因为半套配置就
  // 直接判成「没有可用模型」。
  return resolveRoute(ctx, invocation, config, options)
}
