/**
 * 并行重复测试框架。
 *
 * 目的不是「再跑一遍」，而是找出**不确定性**：同一份代码、同一批测试，
 * 连跑一百次会不会偶尔失败。这类抖动通常来自时间依赖、共享可变状态、
 * 未 await 的异步副作用、正则里的贪婪回溯 —— 单跑一次永远看不见。
 *
 * 做法：把测试文件切成若干批，每批交给一个子进程，子进程内部循环执行。
 * 用 16 个逻辑核并行，避免串行等待。
 *
 * 为什么用子进程而不是同一个进程里循环：
 *   - node --test 每个文件本来就在独立进程里跑，复用会污染模块缓存；
 *   - 单进程循环没法用满多核，100 × 34 次串行要几十分钟。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROUNDS = Number(process.argv[2] ?? 100)
const CONCURRENCY = Number(process.argv[3] ?? 8)
const TEST_DIR = 'test'

const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.js')).sort()

/** 跑一次 node --test 指定文件，返回 { pass, fail, failedNames, ms }。 */
function runOnce(file) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(process.execPath, ['--test', path.join(TEST_DIR, file)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('close', () => {
      const pass = Number((out.match(/^ℹ pass (\d+)$/m) ?? [])[1] ?? 0)
      const fail = Number((out.match(/^ℹ fail (\d+)$/m) ?? [])[1] ?? 0)
      const failedNames = [...out.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1])
      resolve({ file, pass, fail, failedNames, ms: Date.now() - started })
    })
  })
}

/** 对一个文件重复跑 ROUNDS 次，统计失败分布。 */
async function stressFile(file) {
  const fails = new Map()
  let runs = 0
  let totalMs = 0
  let worstMs = 0
  // 每轮开一组，互相独立
  const queue = Array.from({ length: ROUNDS }, () => file)
  const workers = Array.from({ length: Math.min(4, ROUNDS) }, async () => {
    for (;;) {
      const next = queue.pop()
      if (!next) return
      const r = await runOnce(next)
      runs++
      totalMs += r.ms
      if (r.ms > worstMs) worstMs = r.ms
      if (r.fail > 0 || r.pass === 0) {
        for (const name of r.failedNames.length ? r.failedNames : ['<整个文件崩溃>']) {
          fails.set(name, (fails.get(name) ?? 0) + 1)
        }
      }
    }
  })
  await Promise.all(workers)
  return { file, runs, avgMs: runs ? Math.round(totalMs / runs) : 0, worstMs, fails }
}

const results = []
let index = 0
const total = files.length
const t0 = Date.now()

async function lane() {
  for (;;) {
    const i = index++
    if (i >= total) return
    const file = files[i]
    process.stdout.write(`[${String(i + 1).padStart(2)}/${total}] ${file} … `)
    const r = await stressFile(file)
    results.push(r)
    process.stdout.write(`${r.runs} 次, 平均 ${r.avgMs}ms, 最慢 ${r.worstMs}ms, 失败 ${r.fails.size}\n`)
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, lane))

const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
console.log('\n' + '='.repeat(64))
const bad = results.filter((r) => r.fails.size > 0)
const totalRuns = results.reduce((a, r) => a + r.runs, 0)
console.log(`总轮数 ${totalRuns}，耗时 ${elapsed}s`)
if (bad.length === 0) {
  console.log('全部通过，未发现抖动。')
} else {
  console.log(`\n抖动文件 ${bad.length} 个：`)
  for (const r of bad) {
    console.log(`\n  ${r.file}  (${r.runs} 次中失败 ${[...r.fails.values()].reduce((a, b) => a + b, 0)} 次)`)
    for (const [name, n] of [...r.fails].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(3)}×  ${name}`)
    }
  }
}
console.log('\n最慢的文件（平均单次）：')
for (const r of [...results].sort((a, b) => b.avgMs - a.avgMs).slice(0, 6)) {
  console.log(`  ${r.file.padEnd(30)} ${String(r.avgMs).padStart(6)} ms  (最慢 ${r.worstMs})`)
}
fs.writeFileSync('tools/_stress-result.json', JSON.stringify(results, null, 1))
