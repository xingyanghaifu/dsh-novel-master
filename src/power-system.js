/**
 * 力量体系：从一句想法长成一套能用的规则。
 *
 * 为什么单独一个模块而不是塞进 world-model.js：
 * 那边做的是**推演**（气候、水系、一致性审计），全是纯函数、不碰模型；
 * 这边是**创作**，要调 LLM、要写文件、要问用户。混在一起会让那个文件
 * 从 700 行涨到 1200 行，而且测试要开始 mock 模型。
 *
 * 三种模式，一个命令：
 *   ideas      给 3-5 个方向，每个一句，不展开
 *   build      把选定的方向展开成完整体系，写进 设定.md
 *   challenge  拿着已有的体系追问漏洞，只提问，不改写
 *
 * 为什么要有 challenge：生成体系最难的不是写得像样，是**不加多余的**。
 * 每多一条规则，前面的伏笔就少一个出口。所以生成完之后必须有一道
 * 「你这样写会跟什么打架」的关卡，而且它只许提问，不许顺手补规则。
 */
import { agentCwd, fail, ok } from './context.js'
import { readProjectFile, writeProjectFile, listProjects, PROJECTS_DIR } from './project.js'
import { formatError, formatSuccess } from './validators.js'

/** 体系必须写清的六件事。少一样这套规则就撑不住剧情。 */
const PILLARS = [
  ['source', '来源', '力量从哪来。不能是「天地间本来就有」这种万能答案，得说清它依赖什么'],
  ['gain', '获得', '一个人怎么拿到它。有没有门槛，谁拿不到'],
  ['cost', '代价', '用了要付什么。代价必须是读者能看见的具体损失，不是「消耗精神力」'],
  ['limit', '上限', '最强能做到什么，明确做不到什么。上限比能力更能定义体系'],
  ['law', '铁律', '全书不能破的 2-3 条。破一条这本书就散了'],
  ['weakness', '弱点', '怎么被破解。没有弱点的力量写不出紧张感'],
]

/** 输出结构。让模型照抄，避免每次格式都不一样。 */
const SKELETON = `{
  "name": "体系名（2-6 字）",
  "pitch": "一句话说清它是什么（30 字内）",
  "pillars": {
    "source": "来源",
    "gain": "获得途径",
    "cost": "代价",
    "limit": "上限与明确做不到的事",
    "law": ["铁律一", "铁律二"],
    "weakness": "弱点"
  },
  "conflicts": ["这套规则会和什么打架（写 2-3 条，越具体越好）"],
  "openings": ["可以埋的伏笔（2-3 条）"]
}`

const IDEAS_SYSTEM = [
  '你是网文作者，擅长设计力量体系。',
  '作者会给你一句想法或一个关键词。给 4 个**互相不同**的方向。',
  '每个方向必须有明确的代价，不能是免费变强。',
  '不要堆名词，不要写「元素之力」「天地灵气」这种万能模板。',
  '只输出 JSON 数组，不要解释，不要 Markdown 代码块：',
  '[{"name":"体系名","pitch":"一句话","cost":"代价是什么"}]',
].join(' ')

const BUILD_SYSTEM = [
  '你是网文作者，擅长设计力量体系。',
  '作者给你一个方向，你要把它展开成一套**能撑住长篇**的规则。',
  '',
  '硬性要求：',
  '1. 代价必须具体到读者能看见（掉寿命要写掉多少，失忆要写失掉哪一段）。',
  '2. 上限必须写明「做不到什么」。只写「能做到什么」的体系没有紧张感。',
  '3. 铁律 2-3 条，每条都要能在后文被违反——不会有人违反的规则不算规则。',
  '4. 弱点必须真的能被对手利用，不能是「心境不稳」这类空话。',
  '5. 不要发明这个方向里没有的元素。作者给什么，就在什么范围内展开。',
  '6. 中文写作，不要用「能量」「法则」「维度」这类抽象词堆砌。',
  '',
  '只输出 JSON，不要 Markdown 代码块，不要解释：',
  SKELETON,
].join('\n')

const CHALLENGE_SYSTEM = [
  '你是一个挑剔的读者兼编辑。作者写了一力量体系，你要找出它的问题。',
  '',
  '只提问，不给方案。不要顺手帮他补规则——你的任务是让漏洞显形，',
  '不是替他做决定。每个问题都要具体到能回答「是」或「不是」。',
  '',
  '重点找这几类问题：',
  '1. 这套规则自己打自己：两条铁律互相矛盾，或代价与上限对不上。',
  '2. 能钻的空子：读者会问「那为什么不直接 X」。',
  '3. 剧情后果：如果代价真是这样，主角为什么不干脆放弃力量。',
  '4. 力量膨胀：写到 200 章时，这套体系会不会把所有冲突都解决掉。',
  '',
  '输出 5-8 条问题，每条一行，以「- 」开头。不要写总结，不要写建议。',
].join('\n')

/** 从模型返回里抠 JSON。允许被 ```json 包着，也允许前后有废话。 */
function parseJson(text, { array = false } = {}) {
  const raw = String(text ?? '').trim()
  const body = raw.replace(/^```[a-z]*\s*/iu, '').replace(/```$/u, '').trim()
  const open = array ? '[' : '{'
  const close = array ? ']' : '}'
  const start = body.indexOf(open)
  const end = body.lastIndexOf(close)
  if (start < 0 || end <= start) {
    throw new Error(`模型没有返回 ${array ? 'JSON 数组' : 'JSON 对象'}：${body.slice(0, 120)}`)
  }
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch (error) {
    throw new Error(`模型返回的 JSON 解析失败：${error.message}`)
  }
}

/** 把体系转成写进 设定.md 的 Markdown。 */
export function systemMarkdown(system) {
  const p = system?.pillars ?? {}
  const laws = Array.isArray(p.law) ? p.law : (p.law ? [String(p.law)] : [])
  const lines = [
    `## 力量体系：${String(system?.name ?? '未命名')}`,
    '',
  ]
  if (system?.pitch) lines.push(`> ${system.pitch}`, '')
  for (const [key, label] of PILLARS) {
    if (key === 'law') continue
    if (p[key]) lines.push(`- **${label}**：${p[key]}`)
  }
  if (laws.length) {
    lines.push('', `**铁律（全书不能破）**：`)
    laws.forEach((law, i) => lines.push(`${i + 1}. ${law}`))
  }
  if (Array.isArray(system?.conflicts) && system.conflicts.length) {
    lines.push('', '**会和什么打架**：')
    system.conflicts.forEach((item) => lines.push(`- ${item}`))
  }
  if (Array.isArray(system?.openings) && system.openings.length) {
    lines.push('', '**可以埋的伏笔**：')
    system.openings.forEach((item) => lines.push(`- ${item}`))
  }
  return `${lines.join('\n')}\n`
}

/** 找项目目录：先按名字，再退回最近的一个。 */
function targetProject(cwd, name) {
  const names = listProjects(cwd)
  if (!names.length) {
    return { error: `没有找到任何项目。请先在 ${PROJECTS_DIR}/ 下新建一个项目，或先跑 /novel-new。` }
  }
  if (!name) return { project: names[0] }
  if (names.includes(name)) return { project: name }
  return { error: `没有找到项目「${name}」。当前有：${names.join('、')}` }
}

/**
 * 解析 `--mode` / `--name` 这类选项。
 *
 * 手写而不是引 yargs：一共两个选项，加个依赖不划算，
 * 而且项目里其它命令也是手写的，保持一致。
 */
function takeOptions(raw) {
  let rest = ` ${String(raw ?? '')} `
  const take = (pattern) => {
    const m = rest.match(pattern)
    if (!m) return undefined
    rest = `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`
    return m[1]
  }
  const mode = take(/(?:^|\s)--mode\s+(\w+)/u)
  const name = take(/(?:^|\s)--name\s+(\S+)/u)
  return {
    mode: mode?.toLowerCase(),
    name,
    rest: rest.replace(/\s+/gu, ' ').trim(),
  }
}

/**
 * 解析模型路由：先找插件设置里的 `power` 段，再退回会话实际路由。
 *
 * 不直接用 actualModelOf 的返回值展开：它给的是
 * `{known, provider, model, ...}`，直接展开会多塞一个 known 字段进去，
 * callText 的 routeOf 校验会因此判成无效路由。
 */
async function resolveRoute(ctx, invocation) {
  const { actualModelOf } = await import('./model-intelligence.js')
  // known 为 false 时没有 provider/model，不能当路由用
  const observed = await actualModelOf(invocation?.agent, ctx, {
    signal: invocation?.signal,
  })
  if (observed?.known && observed.provider && observed.model) {
    return {
      provider: observed.provider,
      model: observed.model,
      ...(observed.reasoningEffort ? { reasoningEffort: observed.reasoningEffort } : {}),
    }
  }
  throw new Error('没有可用的模型路由：当前会话还没用过模型，插件设置里也没配')
}

/** 调模型。用宿主 llm 服务，与会话同一条路由。 */
async function askModel(ctx, invocation, { system, prompt }) {
  const { callText } = await import('./model-intelligence.js')
  const route = await resolveRoute(ctx, invocation)
  return callText(ctx, {
    ...route,
    system,
    prompt,
    signal: invocation?.signal,
    maxTokens: 2048,
    maxOutputChars: 8192,
    timeoutMs: 120000,
  })
}

/**
 * `/novel-power [项目名] [想法] [--mode ideas|build|challenge]`
 *
 * 不给 `--mode` 时只显示现状，不花 token —— 光给想法不会自动写进项目。
 */
export function powerCommand(config = {}) {
  return {
    name: 'novel-power',
    description: '设计力量体系：给方向、展开成规则、或追问漏洞（开新书时用）',
    input: { hint: '[项目名] [一句想法] [--mode ideas|build|challenge]' },
    handler: async (invocation) => {
      const cwd = agentCwd(invocation)
      const raw = String(invocation.rawInput ?? '')
      const opts = takeOptions(raw)
      const parts = opts.rest.split(/\s+/u).filter(Boolean)

      // 第一个词如果正好是项目名就当项目名，否则整体当想法。
      const names = listProjects(cwd)
      let project = null
      let idea = opts.rest
      if (parts.length && names.includes(parts[0])) {
        project = parts[0]
        idea = parts.slice(1).join(' ')
      }
      if (!project) {
        const target = targetProject(cwd, opts.name)
        if (target.error) return fail(formatError(target.error, [`当前项目：${names.join('、') || '无'}`]))
        project = target.project
      }

      const settingFile = readProjectFile(cwd, project, '设定.md') ?? ''
      // 不带 --mode 时一律只显示现状。早先按「有想法就展开」判断，
      // 结果 `/novel-power 力量来自记忆` 这种最自然的写法会直接把体系写进项目，
      // 而作者可能只是想看看它会怎么答。展开必须显式要求。
      const mode = opts.mode ?? 'show'

      // ---- 只看现状，不花 token ----
      if (mode === 'show') {
        const has = /##\s*力量体系/u.test(settingFile)
        return ok(formatSuccess(`《${project}》的力量体系`, {
          '📌 现状': has ? '  设定.md 里已有「力量体系」一节。' : '  还没有力量体系。',
          '💡 给方向': `/novel-power ${project} 力量来自记忆 --mode ideas`,
          '💡 直接展开': `/novel-power ${project} 力量来自记忆 --mode build`,
          '💡 找漏洞': `/novel-power ${project} --mode challenge`,
        }))
      }

      try {
        // ---- 给方向 ----
        if (mode === 'ideas') {
          const text = await askModel(ctx, invocation, {
            system: IDEAS_SYSTEM,
            prompt: `想法：${idea}\n\n给 4 个不同的方向。`,
          })
          const list = parseJson(text, { array: true })
          const rows = list.slice(0, 6).map((item, i) => ({
            [`${i + 1}. ${item.name ?? '未命名'}`]: `  ${item.pitch ?? ''}\n  代价：${item.cost ?? '未写'}`,
          }))
          return ok(formatSuccess(`《${project}》4 个可选方向`, {
            ...Object.assign({}, ...rows),
            // 不用 --pick：那要重新问一次模型拿「第 N 条」，而模型不保证
            // 给回同一条。宁可让作者把看中的那句贴回来，也不要换成一个陌生的方向。
            '💡 选一个展开': `把看中的那句贴回来：/novel-power ${project} 那句想法 --mode build`,
          }))
        }

        // ---- 展开成体系 ----
        if (mode === 'build') {
          if (!idea) {
            return fail(formatError('需要一句方向', [`例如：/novel-power ${project} 力量来自遗忘 --mode build`]))
          }
          const text = await askModel(ctx, invocation, {
            system: BUILD_SYSTEM,
            prompt: `方向：${idea}`,
          })
          const system = parseJson(text)
          const block = systemMarkdown(system)
          const next = settingFile.includes(block.trim())
            ? settingFile
            : `${settingFile.trimEnd()}\n\n${block}`
          const wrote = writeProjectFile(cwd, project, '设定.md', next)
          if (!wrote) throw new Error('写入 设定.md 失败，请检查项目目录权限')

          const pillarLines = PILLARS.filter(([key]) => key !== 'law')
            .filter(([key]) => system?.pillars?.[key])
            .map(([key, label]) => `  ${label}：${system.pillars[key]}`)
            .join('\n')
          return ok(formatSuccess(`《${project}》力量体系已写入`, {
            [`📜 ${system.name ?? '体系'}`]: `  ${system.pitch ?? ''}\n${pillarLines}`,
            '⚖️ 铁律': `\n${(system.pillars?.law ?? []).map((l, i) => `  ${i + 1}. ${l}`).join('\n')}`,
            '⚠️ 会和什么打架': `\n${(system.conflicts ?? []).map((c) => `  - ${c}`).join('\n')}`,
            '💡 下一步': `/novel-power ${project} --mode challenge —— 让它自己找漏洞`,
          }))
        }

        // ---- 追问漏洞 ----
        if (mode === 'challenge') {
          const body = /##\s*力量体系[\s\S]*?(?=\n##\s|$)/u.exec(settingFile)?.[0]
          if (!body) {
            return fail(formatError('设定.md 里还没有「力量体系」一节', [
              `先跑：/novel-power ${project} 你的想法`,
            ]))
          }
          const text = await askModel(ctx, invocation, {
            system: CHALLENGE_SYSTEM,
            prompt: `以下是作者写的力量体系：\n\n${body.trim()}\n\n找出问题。`,
          })
          const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('-'))
          return ok(formatSuccess(`《${project}》力量体系的漏洞`, {
            '❓ 需要你回答的问题': `\n${(lines.length ? lines : text.split('\n').filter(Boolean)).join('\n')}`,
            '💡 说明': '  这些是问题不是建议。能答上来就说明体系站得住；答不上来的那几条才是要改的。',
          }))
        }

        return fail(formatError(`不认识的模式：${mode}`, ['可用：ideas / build / challenge']))
      } catch (error) {
        return fail(formatError(`力量体系生成失败：${error?.message ?? error}`, [
          '检查插件设置里是否配了模型（设置 → 小说创作大师 → 辅助模型）',
        ]))
      }
    },
  }
}
