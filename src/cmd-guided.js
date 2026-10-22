/**
 * `/novel-guided` — 引导模型规划，写作模型执行。
 *
 * 和 /novel-continue 的区别：
 *   /novel-continue  把任务交回会话模型（用当前对话的模型写，上下文靠对话）
 *   /novel-guided    两个模型各干各的，引导模型读项目产出指令，写作模型照着写
 *
 * 和 /novel-batch 的区别：
 *   /novel-batch     一次请求写 N 章，没有规划环节，省请求但全靠模型自觉
 *   /novel-guided    每章先规划再写，多花一次请求，换来剧情不跑偏
 */
import { agentCwd, fail, ok, resolveProject } from './context.js'
import { listChapters, listProjects, projectDir } from './project.js'
import { formatError, formatSuccess } from './validators.js'
import { runGuidedChapter, saveGuidance } from './guided-write.js'
import { readGuidanceConfig } from './guidance.js'
import { writeChapter } from './batch-write.js'

const NO_PROJECT = formatError('还没有小说项目', ['/novel-guided 项目名 2章'])

/** `/novel-guided [项目名] [N章] [要求]` */
export function guidedCommand(ctx, config) {
  return {
    name: 'novel-guided',
    description: '引导写作：强模型规划本章，写作模型照着写（双模型协作）',
    input: {
      hint: '[项目名] [N章] [要求]',
      attachments: true,
    },
    handler: async (invocation) => {
      try {
        const guidance = readGuidanceConfig(config)
        if (guidance.enabled !== true) {
          return fail(formatError('引导-写作分离没有开启', [
            '插件设置 → 批量写作 → 勾选「启用引导模型」',
            '并填引导模型 Provider / 模型 ID（建议用强的那个）',
            '写作模型可留空，留空就用引导模型写',
          ]))
        }

        const cwd = invocation.cwd ?? agentCwd(invocation)
        const raw = String(invocation.rawInput ?? '').trim()
        // 章数参数：取结尾的「N章」。项目名可能带空格，所以从后往前认。
        const countMatch = raw.match(/(?:^|\s)(\d+)\s*章\s*$/u)
        const count = countMatch === null ? 1 : Number(countMatch[1])
        if (!Number.isSafeInteger(count) || count < 1 || count > 20) {
          return fail(formatError('章数必须是 1-20 的整数', ['/novel-guided 我的书 3章']))
        }
        const rest = countMatch === null ? raw : raw.slice(0, countMatch.index).trim()
        const resolved = resolveProject(cwd, rest)
        const name = resolved.project
        if (!listProjects(cwd).includes(name)) return fail(NO_PROJECT)

        const existing = listChapters(cwd, name)
        const start = (existing.at(-1)?.number ?? 0) + 1
        const dir = projectDir(cwd, name)
        const written = []
        const plans = []

        for (let index = 0; index < count; index++) {
          const number = start + index
          // 每章重新规划：引导模型要读到刚写完的上一章，否则它会重复场景。
          const result = await runGuidedChapter(ctx, invocation, {
            cwd, name, targetChapter: number, requirement: resolved.note ?? '', config,
          })
          const file = writeChapter(dir, number, result.body)
          saveGuidance(dir, number, result.guidance)
          written.push(file)
          plans.push(result)
          if (invocation.signal?.aborted) break
        }

        return ok(formatSuccess(`《${name}》引导写作完成`, {
          '✍️ 已写': `${written.length} 章（第 ${start}-${start + written.length - 1} 章）`,
          '📁 文件': written.join('、'),
          '🧠 引导模型': `${plans[0].guidanceRoute.provider}/${plans[0].guidanceRoute.model}`,
          '🖋 写作模型': `${plans[0].writingRoute.provider}/${plans[0].writingRoute.model}`,
          '📊 总进度': `${listChapters(cwd, name).length} 章`,
        }))
      } catch (error) {
        return fail(`引导写作失败：${error?.message ?? String(error)}`)
      }
    },
  }
}
