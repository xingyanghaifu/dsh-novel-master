import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Discover all configured models in the current DSH environment.
 * Queries:
 * 1. ctx.get('llm') service (listProviders / resolveModelInfo)
 * 2. ctx.get('settings') service
 * 3. Desktop cordis.patch.yml & profile configurations
 */
export async function discoverHostModels(ctx) {
  const models = []
  const seen = new Set()

  const add = (provider, model, label, tag, efforts = []) => {
    if (!provider || !model) return
    const p = String(provider).trim()
    const m = String(model).trim()
    if (!p || !m) return
    if (['config', 'persona', 'tools', 'tool', 'compaction'].includes(p.toLowerCase())) return
    if (m.startsWith('tool-') || m.startsWith('preset-')) return
    const key = `${p}::${m}`
    if (seen.has(key)) return
    seen.add(key)
    models.push({
      provider: p,
      model: m,
      label: label || `${p} / ${m}`,
      tag: tag || '',
      efforts: Array.isArray(efforts) ? efforts : [],
    })
  }

  // 1. Check ctx.get('llm') runtime service if available
  try {
    const llm = ctx?.get?.('llm')
    if (llm && typeof llm.listProviders === 'function') {
      const providers = await Promise.resolve(llm.listProviders())
      if (Array.isArray(providers)) {
        for (const prov of providers) {
          if (prov?.id && prov?.models && Array.isArray(prov.models)) {
            for (const item of prov.models) {
              const id = typeof item === 'string' ? item : item?.id
              const name = typeof item === 'object' && item?.name ? item.name : id
              if (id) add(prov.id, id, `${prov.name || prov.id} / ${name}`)
            }
          }
        }
      }
    }
  } catch {}

  // 2. Check ctx.get('settings')
  try {
    const settings = ctx?.get?.('settings')
    if (settings && typeof settings.get === 'function') {
      const defModel = settings.get('agent-default-model')
      if (defModel?.provider && defModel?.model) {
        add(defModel.provider, defModel.model, `${defModel.provider} / ${defModel.model} (当前主模型)`, '主模型')
      }
      const subagent = settings.get('subagent-model-selection-settings')
      if (Array.isArray(subagent?.allowedModels)) {
        for (const entry of subagent.allowedModels) {
          if (entry?.provider && entry?.model) add(entry.provider, entry.model)
        }
      }
      const piAi = settings.get('llm-pi-ai')
      if (piAi?.providers && typeof piAi.providers === 'object') {
        for (const [provId, pCfg] of Object.entries(piAi.providers)) {
          if (Array.isArray(pCfg?.models)) {
            for (const item of pCfg.models) {
              const id = typeof item === 'string' ? item : item?.id
              const name = typeof item === 'object' && item?.name ? item.name : id
              if (id) add(provId, id, `${pCfg.displayName || provId} / ${name}`)
            }
          }
        }
      }
    }
  } catch {}

  // 3. Fallback: Parse cordis.patch.yml
  try {
    const patchPath = path.join(process.env.USERPROFILE || '', '.dsh', 'profiles', 'desktop', 'cordis.patch.yml')
    if (existsSync(patchPath)) {
      const text = readFileSync(patchPath, 'utf8')

      // Main session model
      const defMatch = text.match(/id:\s*agent-default-model[\s\S]*?provider:\s*([^\s#]+)[\s\S]*?model:\s*([^\s#]+)/)
      if (defMatch) {
        add(defMatch[1].trim(), defMatch[2].trim(), `${defMatch[1].trim()} / ${defMatch[2].trim()} (当前主模型)`, '主模型')
      }

      // Allowed subagent models
      const allowedMatch = text.match(/allowedModels:\s*([\s\S]*?)(?=\n\s*-\s*id:|\n\s*providers:)/)
      if (allowedMatch) {
        let curProv = '', curMod = ''
        for (const line of allowedMatch[1].split('\n')) {
          const p = line.match(/provider:\s*([^\s#]+)/)
          if (p) curProv = p[1].trim()
          const m = line.match(/model:\s*([^\s#]+)/)
          if (m) {
            curMod = m[1].trim()
            if (curProv && curMod) {
              add(curProv, curMod, `${curProv} / ${curMod}`)
              curProv = ''; curMod = ''
            }
          }
        }
      }

      // Configured pi-ai providers and custom providers
      const piAiMatch = text.match(/id:\s*llm-pi-ai[\s\S]*?providers:\s*([\s\S]*?)(?=\n-\s*id:|$)/)
      if (piAiMatch) {
        const provBlocks = piAiMatch[1].split(/\n\s{6}([a-zA-Z0-9_\-]+):\s*\n/)
        for (let i = 1; i < provBlocks.length; i += 2) {
          const provName = provBlocks[i].trim()
          const provBody = provBlocks[i + 1] || ''
          const dNameMatch = provBody.match(/displayName:\s*["']?([^"'\n]+)["']?/)
          const dName = dNameMatch ? dNameMatch[1].trim() : provName
          let curId = '', curName = ''
          for (const l of provBody.split('\n')) {
            const idMatch = l.match(/-\s*id:\s*["']?([^"'\s#]+)["']?/)
            if (idMatch) {
              if (curId) add(provName, curId, `${dName} / ${curName || curId}`)
              curId = idMatch[1].trim()
              curName = ''
            }
            const nameMatch = l.match(/name:\s*["']?([^"'\n]+)["']?/)
            if (nameMatch) curName = nameMatch[1].trim()
          }
          if (curId) add(provName, curId, `${dName} / ${curName || curId}`)
        }
      }
    }
  } catch {}

  // 4. Also scan catalog.json if our-free-model exists
  try {
    const freeCatalogPath = path.join(process.env.USERPROFILE || '', '.dsh', 'our-free-model', 'catalog.json')
    if (existsSync(freeCatalogPath)) {
      const data = JSON.parse(readFileSync(freeCatalogPath, 'utf8'))
      if (Array.isArray(data?.models)) {
        for (const item of data.models) {
          if (item?.id) add('our-free-model', item.id, `our-free-model / ${item.name || item.id} (免费)`, '免费')
        }
      }
    }
  } catch {}

  return { models }
}
