import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { agentCwd, fail, ok } from './context.js'
import { callText, IntelligenceError } from './model-intelligence.js'

const MAX_QUERY = 500
const MAX_RESULTS = 10
const MAX_SOURCE_CHARS = 24000
/**
 * Evidence budget for one synthesis call. `callText` refuses any
 * system + prompt longer than INTELLIGENCE_LIMITS.inputChars (48000), and the
 * system prompt plus the question framing already consume part of it, so the
 * evidence itself must stay well below the hard limit or every large research
 * request fails with `input-limit` instead of producing a report.
 */
const MAX_TOTAL_CHARS = 36000
const SAFE_NAME = /[^\p{L}\p{N}._-]+/gu

const read = (value, fallback) => {
  if (value && typeof value === 'object' && typeof value.get === 'function') return value.get() ?? fallback
  return value ?? fallback
}
const routeString = value => typeof value === 'string' && value.trim() && value.length <= 256 && value === value.trim()
const bounded = (value, max) => String(value ?? '').slice(0, max)

/**
 * 可信度评估器
 * 基于多维度评估素材可信度
 */
class CredibilityEvaluator {
  /**
   * 评估单个来源的可信度
   */
  static evaluateSource(source) {
    // All components use a 0–100 scale; this is a metadata heuristic, not fact verification.
    const scores = {
      sourceType: this.evaluateSourceType(source),
      timeliness: this.evaluateTimeliness(source.publishedAt),
      fetchSuccess: source.fetched === true ? 100 : 0,
    }
    const score = Math.max(0, Math.min(100, Math.round(scores.sourceType * 0.6 + scores.timeliness * 0.3 + scores.fetchSuccess * 0.1)))

    const level = this.getLevel(score)
    return {
      score,
      level,
      label: `启发式参考（${level}）`,
      badge: this.getBadge(score),
      method: 'metadata-heuristic',
      breakdown: scores
    }
  }

  /**
   * 评估来源类型可靠性
   */
  static evaluateSourceType(source) {
    let hostname
    try {
      const parsed = new URL(source.url)
      if (!['http:', 'https:'].includes(parsed.protocol)) return 50
      hostname = parsed.hostname.toLowerCase().replace(/\.$/u, '')
    } catch { return 50 }
    const matches = domain => hostname === domain || hostname.endsWith(`.${domain}`)
    // Known domain suffixes, never substrings in paths, queries, or unrelated hosts.
    if (['edu', 'gov', 'edu.cn', 'gov.cn', 'ac.uk', 'gov.uk', 'cnki.net', 'wanfangdata.com.cn'].some(matches)) return 95
    if (['wikipedia.org', 'britannica.com', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'xinhuanet.com', 'people.com.cn'].some(matches)) return 80
    if (hostname.split('.').some(label => label === 'forum' || label === 'community')) return 65
    return 50
  }

  /**
   * Metadata recency only: unknown, invalid, and future dates earn no bonus.
   */
  static evaluateTimeliness(publishedAt) {
    if (typeof publishedAt !== 'string' || !publishedAt.trim()) return 0
    const timestamp = Date.parse(publishedAt)
    const now = Date.now()
    if (!Number.isFinite(timestamp) || timestamp > now) return 0
    const ageInYears = (now - timestamp) / (1000 * 60 * 60 * 24 * 365)
    if (ageInYears < 0.5) return 100
    if (ageInYears < 1) return 95
    if (ageInYears < 2) return 85
    if (ageInYears < 3) return 75
    if (ageInYears < 5) return 60
    if (ageInYears < 10) return 45
    return 30
  }

  /**
   * 根据分数获取等级
   */
  static getLevel(score) {
    if (score >= 80) return '高'
    if (score >= 60) return '中'
    if (score >= 40) return '低'
    return '极低'
  }

  /**
   * 根据分数获取图标
   */
  static getBadge(score) {
    if (score >= 80) return '🟢'
    if (score >= 60) return '🟡'
    if (score >= 40) return '🟠'
    return '🔴'
  }

  /**
   * 批量评估来源
   */
  static evaluateSources(documents) {
    return documents.map(doc => ({
      ...doc,
      credibility: this.evaluateSource(doc)
    }))
  }
}

function sourceText(source, body) {
  const title = source.title || source.url
  const snippet = source.snippet ? `摘要：${source.snippet}\n` : ''
  const published = source.publishedAt ? `发布日期：${source.publishedAt}\n` : ''
  return `## ${title}\nURL：${source.url}\n${published}${snippet}${body ? `正文：\n${body}` : ''}`
}

export function researchStoragePath(cwd, storageDir = 'novel_research') {
  const raw = String(storageDir || 'novel_research').trim()
  if (!raw || raw.includes('\0')) throw new Error('资料存储目录不能为空')
  const root = path.resolve(cwd)
  const resolved = path.resolve(root, raw)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`) && !path.isAbsolute(raw)) throw new Error('资料存储目录必须位于工作目录内')
  return resolved
}

function ensureResearchStorageDirectory(cwd, storageDir) {
  const root = path.resolve(cwd)
  const raw = String(storageDir || 'novel_research').trim()
  const dir = researchStoragePath(root, raw)
  if (path.isAbsolute(raw)) {
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }
  const rootReal = fs.realpathSync(root)
  const relative = path.relative(root, dir)
  let current = root
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    try {
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('资料存储目录不能包含符号链接或非目录路径')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      fs.mkdirSync(current)
    }
    const real = fs.realpathSync(current)
    if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) throw new Error('资料存储目录必须位于工作目录内')
  }
  return dir
}

function parseJson(text) {
  try { return JSON.parse(text) } catch { throw new IntelligenceError('invalid-json', '检索模型没有返回有效 JSON') }
}

const SCRIPT_BLOCK = /<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu
const HTML_COMMENT = /<!--[\s\S]*?-->/gu
const HTML_TAG = /<[^>]*>/gu
// Control characters that carry no meaning in prose. \t and \n are kept so the
// model still sees paragraph breaks instead of one wall of text.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu

/**
 * Reduce fetched page content to plain prose before it reaches the model.
 *
 * Why this exists: the body of a fetched page is attacker-controlled. Dropped
 * into the evidence blob verbatim, a page can carry `<script>` payloads, CSS
 * hides, or tag-shaped text that reads as instructions to the model. Markup is
 * stripped and control characters removed so the evidence is text the model can
 * cite, not a second channel into its prompt. This is *not* a fact check and
 * cannot stop plain-text prompt injection — the system prompt plus URL-bound
 * citations remain the defence against that — but it removes the markup vector.
 *
 * @param {unknown} html - raw body from `web.fetch`.
 * @returns {string} plain text (possibly empty).
 */
export function sanitizeWebContent(html) {
  if (typeof html !== 'string') return ''
  return html
    .replace(SCRIPT_BLOCK, ' ')
    .replace(HTML_COMMENT, ' ')
    .replace(HTML_TAG, ' ')
    .replace(CONTROL, '')
    // Collapse runs of spaces/tabs but keep newlines as paragraph breaks.
    .replace(/[^\S\n]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

/**
 * 检索一个问句，抓正文，交给模型核验，返回结论。
 *
 * 为什么抽出来：世界参照和 /novel-research 要问的是同一件事 ——
 * 「现实里这是怎么解释的」。两条路径各写一份检索 + 抓取 + 防注入 +
 * 可信度评估，迟早有一份忘了 strip markup，或者忘了绑定 URL 校验，
 * 那才是最难查的那类漏洞。检索只有一个实现。
 *
 * 返回 { ok: true, result, documents } 或 { ok: false, reason }。
 * 不写文件、不落盘 —— 存哪儿由调用方决定，世界参照要存进项目，
 * 资料检索要存进 novel_research/。
 */
export async function runResearch(ctx, config, query, signal) {
  if (!query || query.length > MAX_QUERY) return { ok: false, reason: `检索问题必须为 1-${MAX_QUERY} 个字符。` }
  const provider = read(config?.provider, '')
  const model = read(config?.model, '')
  const reasoningEffort = read(config?.reasoningEffort, '') || undefined
  if (!routeString(provider) || !routeString(model)) return { ok: false, reason: '资料检索已启用，但尚未配置 Provider 和 Model。' }
  const web = ctx?.get?.('web')
  if (!web || typeof web.search !== 'function' || typeof web.fetch !== 'function') return { ok: false, reason: '宿主没有可用的联网检索服务。' }
  const maxResults = Math.min(MAX_RESULTS, Math.max(1, Number(read(config?.maxResults, 5)) || 5))
  const sourceLimit = Math.min(MAX_SOURCE_CHARS, Math.max(1000, Number(read(config?.maxSourceChars, 12000)) || 12000))
  const searched = await web.search({ query, maxResults }, signal)
  const sources = Array.isArray(searched?.sources) ? searched.sources.slice(0, maxResults) : []
  if (!sources.length) return { ok: false, reason: '没有检索到可用来源。' }
  let total = 0
  const documents = []
  // Share the budget across every source instead of first-come-first-served:
  // one huge page must not crowd the rest out, or the model is handed facts
  // whose URLs never appeared in its evidence and every citation fails.
  const perSource = Math.max(1000, Math.floor(MAX_TOTAL_CHARS / Math.max(1, sources.length)))
  for (const source of sources) {
    if (!source?.url || !/^https?:\/\//iu.test(source.url)) continue
    let body = ''
    try {
      const fetched = await web.fetch({ url: source.url }, signal)
      // Strip markup before the body becomes evidence; the raw bytes are
      // attacker-controlled and must not reach the model as instructions.
      if (fetched?.statusCode >= 200 && fetched.statusCode < 300) {
        const raw = typeof fetched.body === 'string' ? fetched.body : fetched.body?.content
        body = bounded(sanitizeWebContent(raw), sourceLimit)
      }
    } catch { /* 单个来源失败仍保留搜索摘要，并在报告中标记未抓取 */ }
    const heading = sourceText(source, '')
    const room = Math.min(perSource - heading.length, MAX_TOTAL_CHARS - total - heading.length)
    if (room <= 0) continue
    const text = sourceText(source, body.length > room ? bounded(body, room) : body)
    if (!text.trim()) continue
    total += text.length
    documents.push({ ...source, fetched: Boolean(body), text })
  }
  if (!documents.length) return { ok: false, reason: '检索结果无法读取。' }
  const evaluated = CredibilityEvaluator.evaluateSources(documents)
  const evidence = evaluated.map(item => item.text).join('\n\n')
  const system = '你是严谨的资料核验助手。只依据提供的检索来源回答，不使用未展示的记忆补全事实。区分来源明确陈述、跨来源一致结论和你的推断；每个关键数据必须绑定来源 URL。若来源不足、冲突、过时或无法核验，可信度必须降低并说明原因。不要编造 DOI、作者、数字、发布日期或引用。只返回 JSON：{"answer":"中文结论","facts":[{"claim":"可核验事实或数据","value":"具体值或说明","sourceUrls":["https://..."],"confidence":0,"confidenceLabel":"高|中|低","reason":"判断依据"}],"limitations":["限制"],"sources":[{"url":"https://...","title":"来源标题","publishedAt":"可选日期"}]}。confidence 是 0 到 1 的数值，不是客观真理概率。'
  const prompt = `检索问题：${query}\n\n以下是检索服务返回的来源和正文：\n${evidence}`
  const text = await callText(ctx, {
    provider, model, reasoningEffort,
    system, prompt, signal,
    timeoutMs: Number(read(config?.timeoutMs, 60000)) || 60000, maxTokens: 4096, maxOutputChars: 24000,
  })
  const parsed = parseJson(text)
  if (!parsed || typeof parsed.answer !== 'string' || !Array.isArray(parsed.facts) || !Array.isArray(parsed.sources)) {
    return { ok: false, reason: '检索模型返回的数据结构不完整。' }
  }
  // 引用校验与可信度校验必须与 /novel-research 完全一致：
  // 漏一条，世界参照这条路径就能被诱导编造来源。
  const knownUrls = new Set(evaluated.map(item => item.url))
  const validFact = fact => fact && typeof fact.claim === 'string' && typeof fact.value === 'string'
    && Array.isArray(fact.sourceUrls) && fact.sourceUrls.length > 0 && fact.sourceUrls.every(url => knownUrls.has(url))
    && typeof fact.confidence === 'number' && Number.isFinite(fact.confidence) && fact.confidence >= 0 && fact.confidence <= 1
    && ['高', '中', '低'].includes(fact.confidenceLabel) && typeof fact.reason === 'string'
  if (!Array.isArray(parsed.limitations) || parsed.limitations.some(item => typeof item !== 'string')
    || parsed.facts.length > 100 || !parsed.facts.every(validFact)) {
    return { ok: false, reason: '检索模型引用了未提供的来源或返回了无效可信度。' }
  }
  parsed.sources = evaluated.map(({ url, title, publishedAt }) => ({ url, title, ...(publishedAt ? { publishedAt } : {}) }))
  parsed.limitations = [...parsed.limitations]
  return { ok: true, result: parsed, documents: evaluated }
}

/**
 * 资料检索命令 - 增强版，包含可信度评估
 */
export function researchCommand(ctx, configuredResearch) {
  return {
    name: 'novel-research',
    description: '联网检索资料并由指定模型评估来源、可信度和分析质量',
    input: { hint: '<检索问题>' },
    handler: async invocation => {
      const config = configuredResearch ?? invocation.config?.research ?? {}
      if (read(config.enabled, false) !== true) return fail('资料检索未启用，请先在设置中打开"资料检索"。')
      const query = String(invocation.rawInput ?? '').trim()
      if (!query || query.length > MAX_QUERY) return fail(`检索问题必须为 1-${MAX_QUERY} 个字符。`)
      const provider = read(config.provider, '')
      const model = read(config.model, '')
      const reasoningEffort = read(config.reasoningEffort, '') || undefined
      // 检索、抓取、防注入、可信度、引用校验全在 runResearch 里，
      // 世界参照走的是同一份实现。这里只管落盘和出报告。
      const ran = await runResearch(ctx, config, query, invocation.signal)
      if (!ran.ok) return fail(ran.reason.endsWith('。') ? ran.reason : `${ran.reason}，未生成结论。`)
      const result = ran.result
      const evaluatedDocuments = ran.documents
      const searched = { content: '', truncated: false }
      const dir = ensureResearchStorageDirectory(agentCwd(invocation), read(config.storageDir, 'novel_research'))
      fs.mkdirSync(dir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
      const id = `${stamp}-${randomUUID().slice(0, 8)}`
      const record = { id, query, route: { provider, model, reasoningEffort }, createdAt: new Date().toISOString(), search: { content: searched.content ?? '', truncated: searched.truncated === true }, documents: evaluatedDocuments, result }
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(record, null, 2), { flag: 'wx' })
      
      // 【新增】生成包含可信度分析的报告
      const credibilitySection = `\n## 来源元数据评分（启发式参考）\n仅依据域名类别、发布日期与抓取状态估算，不验证内容真伪，不代表事实可信概率；所有来源和结论均需核验。权重：来源类别 60%、时效性 30%、正文抓取 10%，各项为 0–100 分。\n${evaluatedDocuments.map(item => {
        const cred = item.credibility
        return `- ${cred.badge} [${item.title || item.url}](${item.url}) - ${cred.score}分（${cred.label}）\n  ${item.fetched ? '✅ 已成功抓取正文' : '⚠️ 未抓取正文，仅使用摘要'}\n  来源类别估算：${cred.breakdown.sourceType}/100 | 时效性估算：${cred.breakdown.timeliness}/100`
      }).join('\n')}`
      
      const report = `# 资料检索报告

- 问题：${query}
- 模型：${provider}/${model}${reasoningEffort ? ` (推理强度: ${reasoningEffort})` : ''}
- 时间：${record.createdAt}
- 记录：${id}.json

## 结论
${result.answer}

## 事实与可信度
${result.facts.map(fact => `- ${fact.claim}：${fact.value}（${fact.confidenceLabel ?? '未标注'}，${fact.confidence ?? '未知'}）
  来源：${(fact.sourceUrls ?? []).join(', ') || '未提供'}
  依据：${fact.reason ?? '未说明'}`).join('\n')}

## 局限
${result.limitations.map(item => `- ${item}`).join('\n') || '- 模型未提供额外局限说明'}
${credibilitySection}

## 来源列表
${evaluatedDocuments.map(item => `- [${item.title || item.url}](${item.url})${item.fetched ? '' : '（未成功抓取正文，仅使用搜索摘要）'}`).join('\n')}`
      
      fs.writeFileSync(path.join(dir, `${id}.md`), report, { flag: 'wx' })
      
      // 【新增】生成简洁的控制台输出
      const avgCredibility = evaluatedDocuments.reduce((sum, doc) => sum + doc.credibility.score, 0) / evaluatedDocuments.length
      const highCredCount = evaluatedDocuments.filter(doc => doc.credibility.level === '高').length
      
      return ok(`📚 资料检索完成

✅ 结论已生成，保存于：${path.join(dir, `${id}.md`)}

📊 来源元数据评分（启发式参考）：
- 平均参考分：${Math.round(avgCredibility)}分
- 高参考分来源：${highCredCount}/${evaluatedDocuments.length}
- 成功抓取正文：${evaluatedDocuments.filter(d => d.fetched).length}/${evaluatedDocuments.length}

💡 提示：评分仅依据元数据，不验证事实真伪；所有来源和结论均需人工核验，详见报告中的逐条事实评级。`)
    },
  }
}

/**
 * 热点题材分析命令
 */
export function trendAnalysisCommand(ctx, configuredResearch) {
  return {
    name: 'novel-trends',
    description: '输出静态题材演示数据（非实时市场分析）',
    input: { hint: '[时间范围: 7d|30d|90d]' },
    handler: async invocation => {
      const config = configuredResearch ?? invocation.config?.research ?? {}
      if (read(config.enabled, false) !== true) return fail('资料检索未启用，热点分析需要先开启资料检索功能。')
      
      const timeRange = String(invocation.rawInput ?? '7d').trim() || '7d'
      if (!['7d', '30d', '90d'].includes(timeRange)) return fail('时间范围必须为 7d、30d 或 90d。')
      
      // 模拟热点数据（实际应该调用真实API或爬虫）
      const trends = {
        timeRange,
        analyzed: new Date().toISOString(),
        genres: [
          {
            name: '都市修仙',
            score: 95,
            trend: 'rising',
            growth: '+25%',
            description: '现代都市背景融合修仙元素，热度持续攀升',
            keywords: ['系统流', '灵气复苏', '都市异能']
          },
          {
            name: '星际争霸',
            score: 88,
            trend: 'rising',
            growth: '+18%',
            description: '太空歌剧题材，科幻迷热捧',
            keywords: ['星际战争', '太空探索', '外星文明']
          },
          {
            name: '游戏电竞',
            score: 79,
            trend: 'rising',
            growth: '+12%',
            description: '电竞、网游题材，年轻读者群体活跃',
            keywords: ['职业选手', '虚拟现实', '全息游戏']
          },
          {
            name: '赛博朋克',
            score: 82,
            trend: 'mature',
            growth: '+5%',
            description: '成熟题材，读者群体稳定',
            keywords: ['赛博义体', '黑客', 'AI']
          },
          {
            name: '历史架空',
            score: 72,
            trend: 'stable',
            growth: '0%',
            description: '稳定小众市场',
            keywords: ['穿越', '朝堂权谋', '科技发展']
          },
          {
            name: '玄幻种田',
            score: 68,
            trend: 'declining',
            growth: '-8%',
            description: '热度下降，需要创新突破',
            keywords: ['洞府', '炼丹', '门派经营']
          }
        ],
        opportunities: [
          {
            name: '都市修仙 + AI人工智能',
            potential: 'high',
            description: '将AI科技融入修仙体系，算法悟道、数据修仙'
          },
          {
            name: '星际探索 + 东方玄学',
            potential: 'very-high',
            description: '星际文明融入东方修仙、气运、天道概念'
          },
          {
            name: '赛博朋克 + 武侠江湖',
            potential: 'high',
            description: '赛博世界的高科技江湖，代码即武功'
          }
        ]
      }
      
      // Static examples demonstrate report formatting; no market observations are made.
      let report = `# 📈 热点题材静态演示报告\n\n`
      report += `> 静态演示：以下题材、分数、趋势与增长率均为预设虚构样例，不代表真实市场数据；未查询平台榜单或社交媒体。\n\n`
      report += `- 演示生成时间：${trends.analyzed}\n`
      report += `- 时间范围参数：${timeRange}（仅作界面演示；不同范围使用相同静态数据，未分析对应期间）\n\n`

      report += `## 静态题材样例（非真实排行）\n\n`
      trends.genres.forEach((genre, index) => {
        report += `### 演示 ${index + 1}. ${genre.name}（虚构分数：${genre.score}）\n`
        report += `- **虚构趋势标签**：${genre.trend}；**虚构增长率**：${genre.growth}\n`
        report += `- **题材元素示例**：${genre.keywords.join('、')}\n\n`
      })

      report += `## 静态创意组合示例（非市场机会预测）\n\n`
      trends.opportunities.forEach((opp, index) => {
        report += `### 演示 ${index + 1}. ${opp.name}\n`
        report += `${opp.description}\n\n`
      })
      report += `---\n\n`
      report += `数据来源：插件内置静态演示样例；不包含真实市场数据，不据此判断题材需求、增长或入场时机。`
      
      return ok(report)
    },
  }
}

/**
 * 导出评估器供其他模块使用
 */
export { CredibilityEvaluator }
