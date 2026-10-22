/**
 * 引导-写作分离：真正接上主链路的那一层。
 *
 * 分工：
 *   引导模型（强）读项目资料，产出本章的写作指令——场景序列、情绪走向、伏笔、禁区。
 *   写作模型（弱/便宜）只执行这份指令，把指令变成正文。
 *   写作模型写不出来时，引导模型的指令本身还能救场：退回单模型直接写。
 *
 * 旧的 guidance-integration.js 走 `invocation.agent.chat`，而这个 API 在宿主里
 * 根本不存在（batch-write.js 的注释里就写着 `agent.chat does not exist`），
 * 所以那条路一次都没跑通过。这里改用 model-intelligence 的 callText，
 * 和 /novel-batch 走同一个通道。
 */
import fs from 'node:fs'
import path from 'node:path'
import { callText, BATCH_LIMITS } from './model-intelligence.js'
import {
  CHAPTER_DIR, CHAPTER_RE, RULES_FILE, listChapters, projectDir,
  projectRelativeDir, readProjectFile, readState,
} from './project.js'
import { loadPersona, personaPromptSection } from './author-persona.js'
import { buildGuidanceSystem, readGuidanceConfig } from './guidance.js'

/** 引导模型看多少资料。够判断剧情，又不至于把整本书塞进一次请求。 */
const GUIDANCE_LIMITS = { inputChars: 60000, outputChars: 8000, maxTokens: 4000, timeoutMs: 180000 }

const REF_FILES = ['设定.md', '角色.md', '大纲.md', '世界状态.md', '伏笔.md', '剧情树.md']

function readCapped(cwd, name, file, cap) {
  const text = readProjectFile(cwd, name, file)
  if (!text) return ''
  const value = text.trim()
  return value.length > cap ? `${value.slice(0, cap)}\n\n…（已截断）` : value
}

/** 路由：命令行 > 插件设置 > 主模型。写作用另一组字段，允许不同模型。 */
function routeFrom(section) {
  const provider = String(section?.provider ?? '').trim()
  const model = String(section?.model ?? '').trim()
  if (!provider || !model) return undefined
  const effort = String(section?.reasoningEffort ?? '').trim()
  return { provider, model, ...(effort ? { reasoningEffort: effort } : {}) }
}

/**
 * 组装引导模型看到的项目状态。
 * 这里刻意只给「判断剧情需要什么」，不给写作规范——那是写作模型的事，
 * 塞给引导模型只会让它把规范复述一遍，挤掉真正的剧情判断。
 */
export function buildGuidanceContext(cwd, name, targetChapter, userRequest = '') {
  const state = readState(cwd, name) ?? {}
  const refs = REF_FILES
    .map(file => {
      const text = readCapped(cwd, name, file, 8000)
      return text ? `\n===== ${file} =====\n${text}` : ''
    })
    .join('\n')
  const recent = listChapters(cwd, name).slice(-2)
  const recentText = recent
    .map(chapter => `\n===== ${chapter.file} =====\n${readProjectFile(cwd, name, `${CHAPTER_DIR}/${chapter.file}`) ?? ''}`)
    .join('\n')

  return [
    `【任务】为《${state.title ?? name}》第 ${targetChapter} 章写一份给写作模型用的执行指令。`,
    '',
    '【项目资料】',
    refs || '（暂无设定资料，依据最近正文保持一致。）',
    recentText ? `\n【最近正文（必须承接结尾）】${recentText}` : '',
    userRequest ? `\n【本次要求】\n${userRequest}` : '',
  ].join('\n')
}

/** 引导模型的系统提示词：要可执行的指令，不要散文。 */
function guidanceSystem(style) {
  return [
    buildGuidanceSystem(style, 'chapter'),
    '',
    '【硬性要求】',
    '- 你的输出会原样交给写作模型执行，所以每一条都要能直接照着写。',
    '- 不要写正文片段、不要写形容词堆砌的评价，不要复述设定原文。',
    '- 场景按顺序编号，每个场景写清楚：地点、谁在场、发生什么、结束时状态变成什么样。',
    '- 明确写出本章禁止出现的东西（OOC、提前揭露、重复上一章的场景等）。',
    '- 如果资料不足以判断，就直接说缺什么，不要编。',
  ].join('\n')
}

/**
 * 让引导模型产出本章指令。
 * @returns {{text: string, route: object}}
 */
export async function generateGuidance(ctx, invocation, { cwd, name, targetChapter, requirement, config }) {
  const guidance = readGuidanceConfig(config)
  const route = routeFrom({
    provider: guidance.provider,
    model: guidance.model,
    reasoningEffort: guidance.reasoningEffort,
  })
  if (route === undefined) throw new Error('引导模型未配置：插件设置 → 批量写作 → 引导模型 Provider / 模型 ID')

  const text = await callText(ctx, {
    ...route,
    // default 档上限只有 120s / 8192 tokens，装不下一次完整规划。
    limits: 'batch',
    system: guidanceSystem(guidance.guidanceStyle),
    prompt: buildGuidanceContext(cwd, name, targetChapter, requirement),
    signal: invocation.signal,
    timeoutMs: GUIDANCE_LIMITS.timeoutMs,
    maxTokens: GUIDANCE_LIMITS.maxTokens,
    maxOutputChars: GUIDANCE_LIMITS.outputChars,
  })
  return { text, route }
}

/**
 * 写作模型的提示词：只执行指令，不做规划。
 *
 * 关键点是「不要自作主张」——弱模型最容易犯的错是觉得指令不够好就自己改，
 * 结果把引导模型做的剧情判断全丢了。
 */
export function buildWritingPrompt(cwd, name, targetChapter, guidanceText, requirement) {
  const state = readState(cwd, name) ?? {}
  const rules = readCapped(cwd, name, RULES_FILE, 8000)
  const persona = loadPersona(cwd, name)
  const personaBlock = persona === undefined ? '' : `\n${personaPromptSection(persona)}\n`
  const recent = listChapters(cwd, name).slice(-1)
  const recentText = recent
    .map(chapter => readProjectFile(cwd, name, `${CHAPTER_DIR}/${chapter.file}`) ?? '')
    .join('\n')

  return [
    `你现在写《${state.title ?? name}》第 ${targetChapter} 章的正文。`,
    '',
    '【最重要的约束】',
    '- 只输出正文。不要调用工具，不要读写文件，不要解释，不要写构思、不要打分。',
    '- 第一行写「# 第N章 标题」。',
    '- 严格按下面的【执行指令】写，场景顺序不能改，不能增删剧情。',
    '- 指令里没写的事不要自己加：不新增角色，不新增设定，不提前揭露伏笔。',
    '- 写不出来就写细，不要缩成梗概。目标 2500 字以上。',
    '',
    '【执行指令】（这是规划，必须照着写）',
    guidanceText,
    '',
    '【写作规范】',
    rules || '（无。按中文网文常规：节奏快、对话自然、细节具体。）',
    personaBlock,
    recentText ? `\n【上一章结尾（必须无缝承接）】\n${recentText.slice(-1200)}` : '',
    requirement ? `\n【额外要求】\n${requirement}` : '',
  ].join('\n')
}

/**
 * 跑一次完整的「引导 → 写作」。
 *
 * 失败语义：引导失败就直接报错，不悄悄降级——降级会让用户以为用上了双模型，
 * 实际只跑了一个弱模型，而这种误判比报错更贵。
 * 写作失败才退回「引导模型的指令 + 单模型」。
 */
export async function runGuidedChapter(ctx, invocation, { cwd, name, targetChapter, requirement, config }) {
  const guidance = readGuidanceConfig(config)
  const writingRoute = routeFrom({
    provider: guidance.writingProvider,
    model: guidance.writingModel,
    reasoningEffort: guidance.writingReasoningEffort,
  })

  // 1. 引导模型规划
  const plan = await generateGuidance(ctx, invocation, { cwd, name, targetChapter, requirement, config })

  // 2. 写作模型执行。没配写作模型就沿用引导模型——比报错实用，
  //    而且用户既然配了引导模型，说明他愿意为此付费。
  const route = writingRoute ?? plan.route
  const prompt = buildWritingPrompt(cwd, name, targetChapter, plan.text, requirement)

  const body = await callText(ctx, {
    ...route,
    limits: 'batch',
    system: '你是职业网文作者，只按给定的执行指令写正文，不自作主张改剧情，不使用工具。',
    prompt,
    signal: invocation.signal,
    timeoutMs: BATCH_LIMITS.timeoutMs,
    maxTokens: 16000,
    maxOutputChars: 20000,
  })

  return { guidance: plan.text, body, guidanceRoute: plan.route, writingRoute: route }
}

/** 把引导指令存档，方便回看这一章当时是按什么写的。 */
export function guidanceReceipt(name, targetChapter, plan, route, wrote) {
  const who = route => `${route.provider}/${route.model}`
  return [
    `《${name}》第 ${targetChapter} 章完成。`,
    `  引导：${who(plan.guidanceRoute)}`,
    `  写作：${who(plan.writingRoute)}`,
    wrote ? `  已写入 ${wrote}` : '',
  ].filter(Boolean).join('\n')
}

/** 把这一章的引导指令存档，方便回看当时是按什么写的。写不进去不影响正文。 */
export function saveGuidance(dir, targetChapter, text) {
  try {
    const folder = path.join(dir, '引导大纲')
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(path.join(folder, `第${targetChapter}章.md`), text, 'utf8')
  } catch {
    // 存档是附产品，丢了不该让这一章白写。
  }
}

export { projectDir, projectRelativeDir, CHAPTER_RE }
