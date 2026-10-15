/**
 * /novel-study (拆书): read a reference text and write a reusable style profile.
 * Deterministic stats are computed here so the model gets real numbers to
 * ground its plain-language reading, not invented ones.
 */
import fs from 'node:fs'
import path from 'node:path'
import { agentCwd, fail, queueTask } from './context.js'
import { decodeText, splitChapters } from './importer.js'
import { RULES_FILE, listProjects, projectDir, projectsRoot } from './project.js'

/** Lightweight, explainable text statistics used as evidence for the profile. */
export function textStats(text) {
  const body = String(text).replace(/\r\n?/gu, '\n')
  const paragraphs = body.split(/\n\s*\n|\n/u).map((p) => p.trim()).filter(Boolean)
  const sentences = body.split(/[。！？!?…]+|\n/u).map((s) => s.trim()).filter(Boolean)
  const chars = body.replace(/\s/gu, '').length
  const dialogue = (body.match(/[“「"][^”」"]*[”」"]/gu) ?? []).join('').length
  const lengths = sentences.map((s) => [...s].length)
  const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0
  const short = lengths.filter((n) => n <= 8).length
  const long = lengths.filter((n) => n >= 40).length
  const oneLine = paragraphs.filter((p) => [...p].length <= 15).length
  return {
    chars,
    paragraphs: paragraphs.length,
    sentences: sentences.length,
    avgSentence: Math.round(avg * 10) / 10,
    shortRatio: lengths.length ? Math.round((short / lengths.length) * 100) : 0,
    longRatio: lengths.length ? Math.round((long / lengths.length) * 100) : 0,
    dialogueRatio: chars ? Math.round((dialogue / chars) * 100) : 0,
    oneLineParagraphRatio: paragraphs.length ? Math.round((oneLine / paragraphs.length) * 100) : 0,
  }
}

/** `/novel-study <文件> [--to 项目名]` */
export function studyCommand() {
  return {
    name: 'novel-study',
    description: '拆书：分析参考作品的写作习惯，生成风格档案并可套用到项目',
    input: { hint: '<参考文件.txt|md> [--to 项目名]（也可直接附上文件）', attachments: true },
    handler: (invocation) => {
      const cwd = agentCwd(invocation)
      let raw = invocation.rawInput.trim()
      let to
      const toMatch = raw.match(/\s--to\s+(\S+)\s*$/u)
      if (toMatch !== null) {
        to = toMatch[1]
        raw = raw.slice(0, toMatch.index).trim()
      }
      const attachments = invocation.attachments ?? []
      if (raw.length === 0 && attachments.length === 0) {
        return fail('用法：/novel-study <参考文件> [--to 项目名]\n例：/novel-study ./参考/某作者.txt --to 网管修仙')
      }
      if (to !== undefined && !listProjects(cwd).includes(to)) return fail(`没有叫「${to}」的项目。`)

      let evidence = ''
      let sourceLabel = '附件'
      if (raw.length > 0) {
        const file = path.resolve(cwd, raw.replace(/^["']|["']$/gu, ''))
        let bytes
        try {
          bytes = fs.readFileSync(file)
        } catch {
          return fail(`读不到文件：${file}`)
        }
        const text = decodeText(bytes)
        const stats = textStats(text)
        const chapters = splitChapters(text).length
        sourceLabel = file
        evidence = `\n客观数据（插件统计，供你判断用，不要照抄成报告）：
- 正文约 ${stats.chars} 字，${chapters} 章，${stats.paragraphs} 段
- 平均句长 ${stats.avgSentence} 字；8 字以内短句占 ${stats.shortRatio}%，40 字以上长句占 ${stats.longRatio}%
- 对话约占 ${stats.dialogueRatio}%；15 字以内的独立短段占 ${stats.oneLineParagraphRatio}%\n`
      }
      const profileDir = path.join(projectsRoot(cwd), '_风格档案')
      fs.mkdirSync(profileDir, { recursive: true })
      const label = path.basename(sourceLabel, path.extname(sourceLabel)) || '参考'
      const profileFile = path.join(profileDir, `${label}.md`)
      const apply = to === undefined ? '' : `\n最后把档案里「写法要点」和「仿写示范」追加到 ${path.join(projectDir(cwd, to), RULES_FILE)} 末尾，标题用「## 风格档案：${label}」。`

      const prompt = `【拆书】参考：${sourceLabel}
${evidence}
像一个作者研究同行那样拆这本书，别写成论文。
1. 文件长就分段读：开头 3 章、中间抽 2 章、最近 3 章都要真读，别只看开头。
2. 用大白话写一份风格档案，保存到 ${profileFile}，包含：
   - 一句话说清这人什么味道
   - 叙事：视角、节奏、一章怎么起承转合、章尾怎么收
   - 句子：长短习惯、标点习惯（省略号/破折号/感叹号用多少）、爱用的词和从不用的词
   - 对话：怎么标注说话人、人物口气怎么区分、对话和动作怎么穿插
   - 描写：写多写少、偏重什么（动作/心理/环境/吐槽）
   - 情绪和爽点怎么铺、怎么爆
   - 原文摘 3-5 段最能代表风格的短句（每段不超过 60 字）
   - 「写法要点」：8-12 条可以照着执行的规则
   - 「仿写示范」：用这个风格写一段 200 字左右的新场景（不要照搬原文情节）
3. 回复里只用三四句话说说这人的味道，并告诉我档案路径。${apply}`
      return queueTask({ ...invocation, novelProject: to ?? null }, prompt, `开始拆书：${sourceLabel}\n档案会写到 ${profileFile}${to ? `，并套用到《${to}》` : ''}。`)
    },
  }
}
