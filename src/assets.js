/**
 * 资产台账：记录「图片文件 ↔ 角色名/地名」的绑定关系。
 *
 * 存放在项目目录的 插图/资产.json，随项目一起移动，不依赖插件配置。
 * 写入采用临时文件 + rename，避免中断留下半个 JSON。
 */
import fs from 'node:fs'
import path from 'node:path'

const IMAGE_DIR = '插图'
const LEDGER = '资产.json'
const VERSION = 1

/** 资产类型：与前端下拉框保持一致。 */
export const ASSET_KINDS = ['character', 'region', 'item', 'map']

function ledgerPath(projectDir) {
  return path.join(projectDir, IMAGE_DIR, LEDGER)
}

/** 读取台账；缺失或损坏都返回空结构，不让面板崩掉。 */
export function readLedger(projectDir) {
  const file = ledgerPath(projectDir)
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const assets = Array.isArray(raw?.assets) ? raw.assets.filter((item) => item && item.file) : []
    return { version: VERSION, assets }
  } catch {
    return { version: VERSION, assets: [] }
  }
}

/** 原子写入台账。 */
export function writeLedger(projectDir, ledger) {
  const file = ledgerPath(projectDir)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temp, JSON.stringify({ version: VERSION, assets: ledger.assets ?? [] }, null, 2), 'utf8')
  fs.renameSync(temp, file)
}

/** 同一类型 + 同一名称视为同一资产，重复绑定会替换旧记录。 */
function sameTarget(asset, kind, name) {
  return asset.kind === kind && String(asset.name ?? '') === String(name ?? '')
}

/**
 * 绑定图片到资产。
 * @param {{projectDir: string, kind: string, name: string, file: string, prompt?: string, model?: string}} input
 */
export function bindAsset({ projectDir, kind, name, file, prompt = '', model = '' }) {
  if (!ASSET_KINDS.includes(kind)) throw new Error(`未知资产类型：${kind}`)
  const target = String(name ?? '').trim()
  if (!target) throw new Error('请填写要绑定的角色名或地名')
  const clean = String(file ?? '').replace(/\\/gu, '/')
  if (!clean || clean.includes('..')) throw new Error('图片路径不合法')
  if (!fs.existsSync(path.join(projectDir, clean))) throw new Error('图片文件不存在，请先生成')

  const ledger = readLedger(projectDir)
  const record = {
    id: `${kind}-${target}-${Date.now().toString(36)}`,
    kind,
    name: target,
    file: clean,
    prompt: String(prompt ?? '').slice(0, 2000),
    model: String(model ?? ''),
    createdAt: new Date().toISOString(),
  }
  // 同目标替换，保持「一个资产一张当前主图」
  const assets = ledger.assets.filter((item) => !sameTarget(item, kind, target))
  assets.unshift(record)
  writeLedger(projectDir, { assets })
  return { asset: record, total: assets.length }
}

/** 列出已绑定资产；可按类型过滤。 */
export function listAssets({ projectDir, kind }) {
  const ledger = readLedger(projectDir)
  const assets = kind ? ledger.assets.filter((item) => item.kind === kind) : ledger.assets
  return { assets, total: assets.length }
}

/** 查询某个资产当前绑定的图片。 */
export function assetOf({ projectDir, kind, name }) {
  const ledger = readLedger(projectDir)
  return ledger.assets.find((item) => sameTarget(item, kind, name)) ?? null
}

/** 解除绑定（不删图片文件）。 */
export function unbindAsset({ projectDir, kind, name }) {
  const ledger = readLedger(projectDir)
  const before = ledger.assets.length
  const assets = ledger.assets.filter((item) => !sameTarget(item, kind, name))
  writeLedger(projectDir, { assets })
  return { removed: before - assets.length }
}
