import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { renderWorldMap, saveWorldMap } from '../src/world-map.js'
import { writeProjectFile, readProjectFile } from '../src/project.js'

/** 造一个临时工作目录，里面有一个可识别的项目。 */
function tempProject() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-map-'))
  const root = path.join(cwd, 'novel_projects', '测试小说')
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(path.join(root, '设定.md'), '# 设定\n\n## 地理\n', 'utf8')
  return { cwd, root, cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) }
}

const SITES = [
  { name: '艾尔登维尔大陆', desc: '主舞台', terrain: '原野', terrainKind: 'plain', x: 0.45, y: 0.3 },
  { name: '白塔', desc: '圣教总部', terrain: '城邦', terrainKind: 'city', x: 0.7, y: 0.55 },
]

test('地图 SVG 带地名、地形块与站点标记', () => {
  const { svg } = renderWorldMap({ project: '测试小说', sites: SITES, size: 84 })
  assert.match(svg, /<svg[^>]+viewBox="0 0 84 84"/, '必须有正确的 viewBox')
  assert.ok(svg.includes('艾尔登维尔大陆'), '地名要出现在图里')
  assert.ok(svg.includes('白塔'))
  assert.equal((svg.match(/class="site"/g) ?? []).length, 2, '每个地点一个标记')
  assert.ok(svg.includes('<g class="cells">'), '应有地形块')
  assert.ok((svg.match(/class="cell/g) ?? []).length >= 2, '每个地区至少一块')
})

test('地图里不含程序生成的地形', () => {
  // 等高线是用噪声编的，和作者设定无关。存进项目等于把伪造的地形固化下来。
  const { svg, doc } = renderWorldMap({ project: '测试小说', sites: SITES, size: 84 })
  assert.ok(!svg.includes('class="contours"'), '不该有等高线')
  assert.ok(!svg.includes('class="line"'), '不该有等高线路径')
  assert.doesNotMatch(doc, /等高线/u, '文档不该再提高等高线')
})

test('地图文档列出地点、方位、地形与说明', () => {
  const { doc } = renderWorldMap({ project: '测试小说', sites: SITES, size: 84 })
  assert.match(doc, /## 地点（2 处）/)
  assert.match(doc, /艾尔登维尔大陆/)
  assert.match(doc, /主舞台/)
  assert.match(doc, /地形：原野/)
  // 方位用九宫格中文，而不是裸坐标
  assert.match(doc, /方位：偏北/)
  assert.doesNotMatch(doc, /方位：0\./, '不该把裸露的坐标写给作者看')
})

test('没有地点时给出可执行的下一步，而不是留空', () => {
  const { doc } = renderWorldMap({ project: '空项目', sites: [], size: 84 })
  assert.match(doc, /还没有可识别的地点/)
  assert.match(doc, /地区\.md/, '要告诉作者去哪儿补')
})

test('地名里的尖括号被转义，不能注入', () => {
  const { svg } = renderWorldMap({
    project: 'x', size: 40,
    sites: [{ name: '<script>alert(1)</script>', x: 0.5, y: 0.5 }],
  })
  assert.ok(!svg.includes('<script>'), '地名不能原样成为标签')
  assert.ok(svg.includes('&lt;script&gt;'), '应当转义而不是丢弃')
})

test('坐标越界会被夹回画布内', () => {
  const { svg } = renderWorldMap({
    project: 'x', size: 80,
    sites: [
      { name: '左上', x: -5, y: -5 },
      { name: '右下', x: 99, y: 99 },
    ],
  })
  for (const m of svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)) {
    const [, cx, cy] = m
    assert.ok(Number(cx) >= 0 && Number(cx) <= 80, `cx ${cx} 越界`)
    assert.ok(Number(cy) >= 0 && Number(cy) <= 80, `cy ${cy} 越界`)
  }
})

test('同一份输入导出的图完全相同', () => {
  // 换种子会让每次保存画出不同的形状，作者按图认路就会失效
  const a = renderWorldMap({ project: '测试小说', sites: SITES }).svg
  const b = renderWorldMap({ project: '测试小说', sites: SITES }).svg
  assert.equal(a, b)
})

test('保存会在项目里生成 地图.svg 与 地图.md', () => {
  const { cwd, root, cleanup } = tempProject()
  try {
    const result = saveWorldMap(cwd, '测试小说', { sites: SITES, size: 84 })
    assert.equal(result.ok, true)
    assert.deepEqual(result.files.sort(), ['地图.svg', '地图.md'].sort())
    assert.ok(fs.existsSync(path.join(root, '地图.svg')))
    assert.ok(fs.existsSync(path.join(root, '地图.md')))
    // 内容要真的是地图，不是空文件
    const svg = fs.readFileSync(path.join(root, '地图.svg'), 'utf8')
    assert.match(svg, /<svg/)
    assert.ok(svg.includes('白塔'))
  } finally { cleanup() }
})

test('重复保存覆盖旧文件而不是追加', () => {
  const { cwd, root, cleanup } = tempProject()
  try {
    saveWorldMap(cwd, '测试小说', { sites: SITES, size: 84 })
    const first = fs.readFileSync(path.join(root, '地图.svg'), 'utf8')
    saveWorldMap(cwd, '测试小说', { sites: [SITES[0]], size: 84 })
    const second = fs.readFileSync(path.join(root, '地图.svg'), 'utf8')
    assert.notEqual(first, second, '第二次保存要覆盖')
    assert.ok(!second.includes('白塔'), '被移除的地点不该还留在图里')
    assert.equal((second.match(/class="site"/g) ?? []).length, 1)
  } finally { cleanup() }
})

test('存到不存在的项目会被拒绝，不能凭空建目录', () => {
  const { cwd, cleanup } = tempProject()
  try {
    assert.throws(() => saveWorldMap(cwd, '不存在的项目', { sites: SITES }), /找不到项目/)
    assert.throws(() => saveWorldMap(cwd, '', { sites: SITES }), /缺少项目名/)
    assert.ok(!fs.existsSync(path.join(cwd, 'novel_projects', '不存在的项目')))
  } finally { cleanup() }
})

test('项目名里的路径穿越被拒绝', () => {
  const { cwd, cleanup } = tempProject()
  try {
    for (const bad of ['../evil', '..', 'a/../../b']) {
      assert.throws(() => saveWorldMap(cwd, bad, { sites: SITES }), /找不到项目/)
    }
  } finally { cleanup() }
})

test('writeProjectFile 挡住目录穿越', () => {
  const { cwd, root, cleanup } = tempProject()
  try {
    assert.equal(writeProjectFile(cwd, '测试小说', '../../逃逸.txt', 'x'), false, '穿越必须失败')
    assert.equal(writeProjectFile(cwd, '测试小说', '..', 'x'), false, '指到上级目录必须失败')
    // 正常路径可写
    assert.equal(writeProjectFile(cwd, '测试小说', '子目录/内.txt', '内容'), true)
    assert.equal(readProjectFile(cwd, '测试小说', '子目录/内.txt'), '内容')
    // 失败时不留临时文件
    const leftovers = fs.readdirSync(root).filter((name) => name.endsWith('.tmp'))
    assert.deepEqual(leftovers, [], '不该残留 .tmp')
  } finally { cleanup() }
})

test('地图内容不依赖客户端提交的 SVG', () => {
  // 客户端塞什么额外字段都不该生效，服务端只认 sites/size/seed
  const { svg } = renderWorldMap({
    project: 'x', size: 40,
    sites: [{ name: '甲', x: 0.5, y: 0.5 }],
    svg: '<svg onload="alert(1)"/>',
    doc: '# 被劫持',
  })
  assert.ok(!svg.includes('onload'), '客户端给的 svg 字段必须被忽略')
  assert.ok(!svg.includes('被劫持'), '客户端给的 doc 字段必须被忽略')
})
