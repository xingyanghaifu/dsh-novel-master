import fs from 'node:fs'
let s = fs.readFileSync('client.js','utf8')
// 模拟：picking 为 true 时整页渲染是否会抛错
// 直接静态检查：所有 useState 是否条件调用
const start = s.indexOf('function SettingsPage')
const end = s.indexOf('function ProgressBody')
const body = s.slice(start, end)
const lines = body.split('\n')
let depth = 0
let findings = []
for (let i = 0; i < lines.length; i++) {
  const l = lines[i]
  // 粗略统计 if/for 块内是否出现 useState
  if (/^\s*(if|for|while|switch)\b/.test(l)) {
    findings.push(`L${i}: ${l.trim().slice(0,80)}`)
  }
}
console.log('SettingsPage 内条件语句位置（检查是否包裹 useState）:')
console.log(findings.slice(0,8).join('\n'))
// 检查 useState 是否都在顶层（缩进 6 空格）
const re = /^(\s*)const \[(\w+), (\w+)\] = useState/m
let m
while ((m = re.exec(body))) {
  const indent = m[1].length
  if (indent !== 6) console.log(`非顶层 useState: ${m[2]} 缩进 ${indent}`)
}
console.log('useState 缩进检查完毕')
