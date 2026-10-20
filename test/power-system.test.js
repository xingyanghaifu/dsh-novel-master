import { test } from 'node:test'
import assert from 'node:assert/strict'
import { powerCommand, systemMarkdown } from '../src/power-system.js'

/**
 * 力量体系的生成逻辑。
 *
 * 调模型那段没法在这里测（要宿主 llm 服务），但**写进项目的 Markdown**
 * 可以也应该测：那是作者唯一看得见的产物，格式坏了等于生成了废话。
 *
 * 命令本身的行为靠手工验证，见 README。
 */

const FULL = {
  name: '忆力',
  pitch: '忘记自己，才能借用别人的记忆',
  pillars: {
    source: '记忆本身。越私密的记忆越有用',
    gain: '必须亲口讲出一段自己的过去，讲得越真拿到的越多',
    cost: '忘掉讲出去的那段。讲三次关于母亲的，就会忘了母亲',
    limit: '只能借用，不能创造。借来的记忆三个月后开始褪色',
    law: ['讲过的话不能收回', '借来的记忆不能用来欺骗原主', '忘掉的东西永远回不来'],
    weakness: '对着一个没有过去的人无效',
  },
  conflicts: ['主角如果一直借，最后会忘记自己为什么要变强'],
  openings: ['第一次忘掉母亲的名字可以留到中段'],
}

test('生成的 Markdown 含全部六根支柱', () => {
  const md = systemMarkdown(FULL)
  for (const label of ['来源', '获得', '代价', '上限', '弱点']) {
    assert.match(md, new RegExp(`\\*\\*${label}\\*\\*`, 'u'), `少了「${label}」`)
  }
  assert.match(md, /铁律（全书不能破）/u)
})

test('铁律单列成有序列表，不混在正文里', () => {
  // 铁律是全书的硬约束，必须一眼能数清有几条
  const md = systemMarkdown(FULL)
  assert.match(md, /1\. 讲过的话不能收回/u)
  assert.match(md, /3\. 忘掉的东西永远回不来/u)
})

test('法则只有一条字符串时也照样列出来', () => {
  // 模型有时给字符串而不是数组，直接 .forEach 会炸
  const md = systemMarkdown({
    name: '测', pillars: { law: '只有一条铁律' },
  })
  assert.match(md, /1\. 只有一条铁律/u)
})

test('缺字段时不留空壳，也不抛', () => {
  // 模型少给东西是常态，不能因此让整条命令失败
  const md = systemMarkdown({ name: '只有名字' })
  assert.match(md, /## 力量体系：只有名字/u)
  assert.doesNotMatch(md, /\*\*来源\*\*：undefined/u)
  assert.doesNotMatch(md, /\*\*来源\*\*：$/mu)
})

test('完全没有名字时用占位名，不写 null', () => {
  const md = systemMarkdown({})
  assert.match(md, /未命名/u)
  assert.doesNotMatch(md, /null|undefined/u)
})

test('冲突与伏笔分开列，作者能分别处理', () => {
  const md = systemMarkdown(FULL)
  assert.match(md, /\*\*会和什么打架\*\*/u)
  assert.match(md, /\*\*可以埋的伏笔\*\*/u)
  // 两者内容不串
  const conflictBlock = md.split('**会和什么打架**')[1].split('**可以埋的伏笔**')[0]
  assert.doesNotMatch(conflictBlock, /母亲的名字/u)
})

test('输出以换行结尾，追加到设定.md 时不会粘在下一行', () => {
  assert.ok(systemMarkdown(FULL).endsWith('\n'))
})

test('同一份输入产生完全相同的 Markdown', () => {
  // 否则「已经写过就不重复写」那句判断会每次失效，越写越长
  assert.equal(systemMarkdown(FULL), systemMarkdown(FULL))
})

/* ---- 命令本身 ---- */

/**
 * 这几条不碰模型，只验证「什么时候会写文件」「参数怎么认」。
 * 最容易退化的就是前者：一句想法就把体系糊进 设定.md，
 * 作者可能只是想看看它会怎么答。
 */

test('命令注册名与描述', () => {
  const cmd = powerCommand({})
  assert.equal(cmd.name, 'novel-power')
  assert.match(cmd.description, /力量体系/u)
  assert.equal(typeof cmd.handler, 'function')
})

test('不给 --mode 时只显示现状，绝不写文件', async () => {
  const cmd = powerCommand({})
  let wrote = false
  // 没有可写目录时如果仍尝试写入会抛，这里只关心它根本没走到那一步
  const result = await cmd.handler({
    agent: { id: 'x' },
    rawInput: '力量来自记忆',
    // 故意不给 signal，模型调用本该失败；但只要不调模型就没事
    _touch: () => { wrote = true },
  })
  assert.equal(result.kind, 'success', '应正常显示现状')
  assert.match(result.text, /现状/u)
  assert.equal(wrote, false)
})

test('不认识的模式给出可用清单，不是静默成功', async () => {
  const cmd = powerCommand({})
  // 模式名走 \w 匹配，中文进不去，用 ASCII 才测得到这条分支
  const result = await cmd.handler({ agent: { id: 'x' }, rawInput: '想法 --mode bogus' })
  assert.equal(result.kind, 'error')
  assert.match(result.text, /ideas \/ build \/ challenge/u)
})
