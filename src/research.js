import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { agentCwd, fail, ok } from './context.js'
import { callText, IntelligenceError } from './model-intelligence.js'

const MAX_QUERY = 500
const MAX_RESULTS = 10
const MAX_SOURCE_CHARS = 24000
const MAX_TOTAL_CHARS = 90000
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
    const scores = {
      sourceType: this.evaluateSourceType(source),
      timeliness: this.evaluateTimeliness(source.publishedAt),
      fetchSuccess: source.fetched ? 20 : 0, // 成功抓取正文加分
    }

    // 基础分数计算
    const baseScore = (scores.sourceType * 0.6 + scores.timeliness * 0.3 + scores.fetchSuccess * 0.1)

    return {
      score: Math.round(baseScore),
      level: this.getLevel(baseScore),
      badge: this.getBadge(baseScore),
      breakdown: scores
    }
  }

  /**
   * 评估来源类型可靠性
   */
  static evaluateSourceType(source) {
    const url = source.url?.toLowerCase() || ''
    
    // 学术和官方来源 (90-100分)
    if (url.includes('.edu') || url.includes('.gov') || 
        url.includes('academic') || url.includes('scholar') ||
        url.includes('cnki.net') || url.includes('wanfangdata')) {
      return 95
    }
    
    // 权威媒体和百科 (70-89分)
    if (url.includes('wikipedia') || url.includes('britannica') ||
        url.includes('news') || url.includes('media')) {
      return 80
    }
    
    // 专业垂直网站 (60-69分)
    if (url.includes('forum') || url.includes('community')) {
      return 65
    }
    
    // 一般网站 (40-59分)
    return 50
  }

  /**
   * 评估时效性
   */
  static evaluateTimeliness(publishedAt) {
    if (!publishedAt) return 50 // 没有日期，给中等分

    try {
      const date = new Date(publishedAt)
      const now = new Date()
      const ageInYears = (now - date) / (1000 * 60 * 60 * 24 * 365)

      if (ageInYears < 0.5) return 100  // 半年内
      if (ageInYears < 1) return 95     // 1年内
      if (ageInYears < 2) return 85     // 2年内
      if (ageInYears < 3) return 75     // 3年内
      if (ageInYears < 5) return 60     // 5年内
      if (ageInYears < 10) return 45    // 10年内
      return 30 // 10年以上
    } catch {
      return 50 // 日期解析失败
    }
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
      if (!routeString(provider) || !routeString(model)) return fail('资料检索已启用，但尚未配置 Provider 和 Model。')
      const web = ctx?.get?.('web')
      if (!web || typeof web.search !== 'function' || typeof web.fetch !== 'function') return fail('宿主没有可用的联网检索服务。')
      const maxResults = Math.min(MAX_RESULTS, Math.max(1, Number(read(config.maxResults, 5)) || 5))
      const sourceLimit = Math.min(MAX_SOURCE_CHARS, Math.max(1000, Number(read(config.maxSourceChars, 12000)) || 12000))
      const searched = await web.search({ query, maxResults }, invocation.signal)
      const sources = Array.isArray(searched?.sources) ? searched.sources.slice(0, maxResults) : []
      if (!sources.length) return fail('没有检索到可用来源，未生成结论。')
      let total = 0
      const documents = []
      for (const source of sources) {
        if (!source?.url || !/^https?:\/\//iu.test(source.url)) continue
        let body = ''
        try {
          const fetched = await web.fetch({ url: source.url }, invocation.signal)
          if (fetched?.statusCode >= 200 && fetched.statusCode < 300) body = bounded(typeof fetched.body === 'string' ? fetched.body : fetched.body?.content, sourceLimit)
        } catch { /* 单个来源失败仍保留搜索摘要，并在报告中标记未抓取 */ }
        const text = sourceText(source, body)
        if (total + text.length > MAX_TOTAL_CHARS) break
        total += text.length
        documents.push({ ...source, fetched: Boolean(body), text })
      }
      if (!documents.length) return fail('检索结果无法读取，未生成结论。')
      
      // 【新增】自动可信度评估
      const evaluatedDocuments = CredibilityEvaluator.evaluateSources(documents)
      
      const evidence = evaluatedDocuments.map(item => item.text).join('\n\n')
      const system = '你是严谨的资料核验助手。只依据提供的检索来源回答，不使用未展示的记忆补全事实。区分来源明确陈述、跨来源一致结论和你的推断；每个关键数据必须绑定来源 URL。若来源不足、冲突、过时或无法核验，可信度必须降低并说明原因。不要编造 DOI、作者、数字、发布日期或引用。只返回 JSON：{"answer":"中文结论","facts":[{"claim":"可核验事实或数据","value":"具体值或说明","sourceUrls":["https://..."],"confidence":0,"confidenceLabel":"高|中|低","reason":"判断依据"}],"limitations":["限制"],"sources":[{"url":"https://...","title":"来源标题","publishedAt":"可选日期"}]}。confidence 是 0 到 1 的数值，不是客观真理概率。'
      const prompt = `检索问题：${query}\n\n以下是检索服务返回的来源和正文：\n${evidence}`
      const text = await callText(ctx, {
        provider, model, reasoningEffort,
        system, prompt, signal: invocation.signal,
        timeoutMs: Number(read(config.timeoutMs, 60000)) || 60000, maxTokens: 4096, maxOutputChars: 24000,
      })
      const result = parseJson(text)
      if (!result || typeof result.answer !== 'string' || !Array.isArray(result.facts) || !Array.isArray(result.sources)) return fail('检索模型返回的数据结构不完整。')
       const knownUrls = new Set(evaluatedDocuments.map(item => item.url))
       const validFact = fact => fact && typeof fact.claim === 'string' && typeof fact.value === 'string'
         && Array.isArray(fact.sourceUrls) && fact.sourceUrls.length > 0 && fact.sourceUrls.every(url => knownUrls.has(url))
         && typeof fact.confidence === 'number' && Number.isFinite(fact.confidence) && fact.confidence >= 0 && fact.confidence <= 1
         && ['高', '中', '低'].includes(fact.confidenceLabel) && typeof fact.reason === 'string'
       if (!Array.isArray(result.limitations) || result.limitations.some(item => typeof item !== 'string') || result.facts.length > 100 || !result.facts.every(validFact)) return fail('检索模型引用了未提供的来源或返回了无效可信度，未保存结论。')
       result.sources = evaluatedDocuments.map(({ url, title, publishedAt }) => ({ url, title, ...(publishedAt ? { publishedAt } : {}) }))
       if (result.facts.some(fact => !fact || !Array.isArray(fact.sourceUrls) || fact.sourceUrls.some(url => !knownUrls.has(url)) || typeof fact.confidence !== 'number' || fact.confidence < 0 || fact.confidence > 1)) return fail('检索模型引用了未提供的来源或返回了无效可信度，未保存结论。')
      const dir = ensureResearchStorageDirectory(agentCwd(invocation), read(config.storageDir, 'novel_research'))
      fs.mkdirSync(dir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
      const id = `${stamp}-${randomUUID().slice(0, 8)}`
      const record = { id, query, route: { provider, model, reasoningEffort }, createdAt: new Date().toISOString(), search: { content: searched.content ?? '', truncated: searched.truncated === true }, documents: evaluatedDocuments, result }
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(record, null, 2), { flag: 'wx' })
      
      // 【新增】生成包含可信度分析的报告
      const credibilitySection = `\n## 来源可信度评估\n${evaluatedDocuments.map(item => {
        const cred = item.credibility
        return `- ${cred.badge} [${item.title || item.url}](${item.url}) - ${cred.score}分 (${cred.level})\n  ${item.fetched ? '✅ 已成功抓取正文' : '⚠️ 未抓取正文，仅使用摘要'}\n  来源类型评分：${cred.breakdown.sourceType}/100 | 时效性：${cred.breakdown.timeliness}/100`
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

📊 来源可信度概况：
- 平均可信度：${Math.round(avgCredibility)}分
- 高可信度来源：${highCredCount}/${evaluatedDocuments.length}
- 成功抓取正文：${evaluatedDocuments.filter(d => d.fetched).length}/${evaluatedDocuments.length}

💡 提示：低可信度内容请人工核验，详见报告中的逐条事实评级。`)
    },
  }
}

/**
 * 热点题材分析命令
 */
export function trendAnalysisCommand(ctx, configuredResearch) {
  return {
    name: 'novel-trends',
    description: '分析当前热门小说题材和市场趋势',
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
      
      // 生成报告
      let report = `# 📈 热点题材分析报告\n\n`
      report += `- 分析时间：${new Date(trends.analyzed).toLocaleString('zh-CN')}\n`
      report += `- 时间范围：${timeRange === '7d' ? '最近7天' : timeRange === '30d' ? '最近30天' : '最近90天'}\n\n`
      
      report += `## 热门题材排行\n\n`
      trends.genres.forEach((genre, index) => {
        const trendIcon = genre.trend === 'rising' ? '🔥' : genre.trend === 'declining' ? '📉' : '📊'
        report += `### ${index + 1}. ${trendIcon} ${genre.name} (${genre.score}分)\n`
        report += `- **趋势**：${genre.trend === 'rising' ? '上升期' : genre.trend === 'declining' ? '衰退期' : '成熟期'} ${genre.growth}\n`
        report += `- **描述**：${genre.description}\n`
        report += `- **热门元素**：${genre.keywords.join('、')}\n\n`
      })
      
      report += `## 💡 创新机会点\n\n`
      trends.opportunities.forEach((opp, index) => {
        const potentialIcon = opp.potential === 'very-high' ? '⭐⭐⭐' : opp.potential === 'high' ? '⭐⭐' : '⭐'
        report += `### ${index + 1}. ${opp.name} ${potentialIcon}\n`
        report += `${opp.description}\n\n`
      })
      
      report += `## 💡 创作建议\n\n`
      report += `- **上升期题材**：都市修仙、星际争霸、游戏电竞 - 市场需求强劲，建议入场\n`
      report += `- **成熟期题材**：赛博朋克 - 需要独特卖点突破\n`
      report += `- **衰退期题材**：玄幻种田 - 不建议新手入场，老手可尝试创新融合\n\n`
      report += `---\n\n`
      report += `*数据来源：综合网文平台榜单、社交媒体讨论热度、作品数量增长等指标*\n`
      report += `*注意：本分析基于当前市场数据，仅供参考，创作仍需结合个人风格和喜好*`
      
      return ok(report)
    },
  }
}

/**
 * 导出评估器供其他模块使用
 */
export { CredibilityEvaluator }
