import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export const LEARNING_SCHEMA_VERSION = 1
export const LEARNING_LIMITS = Object.freeze({ summary: 8000, evidence: 8000, reference: 2048, identity: 512, source: 512, recordBytes: 32768, maxRecords: 10000 })
const digest = value => createHash('sha256').update(value).digest('hex')
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
const must = (condition, message) => { if (!condition) throw new Error(message) }
function keys(value, allowed, label) {
  must(plain(value), `${label} must be a plain object`)
  must(Object.keys(value).every(key => allowed.includes(key)), `${label} contains unsupported fields`)
}
function text(value, limit, label, required = true) {
  must(typeof value === 'string' && (!required || value.trim().length > 0) && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value), `${label} must be bounded text (max ${limit})`)
  return value
}
function identity(value, label) { return text(value, LEARNING_LIMITS.identity, label) }
function slug(value) { return value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]/gu, '-').replace(/-+/gu, '-').slice(0, 36) || 'model' }
function safeSegments(input) {
  must(typeof input === 'string' && input.trim().length && input.length <= 4096 && !/[\u0000-\u001f]/u.test(input), 'directory must be a nonempty bounded path')
  must(!/^[A-Za-z]:(?![\\/])/u.test(input), 'directory must not be drive-relative')
  const root = path.parse(input).root
  const tail = input.slice(root.length)
  for (const segment of tail.split(/[\\/]/u).filter(Boolean)) {
    must(segment !== '.' && segment !== '..' && !/[ .]$/u.test(segment) && !/[<>:"|?*]/u.test(segment) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment), 'directory contains an unsafe path segment')
  }
  if (process.platform !== 'win32') must(!path.win32.isAbsolute(input) && !/^[A-Za-z]:/u.test(input) && !input.includes('\\'), 'directory uses a foreign absolute or separator format')
}
/** Reject symlinks/junctions at every existing component, including dangling links. */
function inspect(file, kind, missing = false) {
  const absolute = path.resolve(file)
  const root = path.parse(absolute).root
  let current = root
  for (const segment of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    let stat
    try { stat = fs.lstatSync(current) } catch (error) {
      if (error.code === 'ENOENT' && missing) continue
      throw error
    }
    must(!stat.isSymbolicLink(), `Unsafe symbolic link: ${current}`)
    if (current !== absolute || kind === 'directory') must(stat.isDirectory(), `Not a directory: ${current}`)
    else must(stat.isFile() && stat.nlink === 1, `Unsafe record file: ${current}`)
  }
  return absolute
}
export function resolveLearningDirectory({ cwd, directory = 'novel_learning' }) {
  must(typeof cwd === 'string' && path.isAbsolute(cwd), 'cwd must be an explicit absolute workspace path')
  safeSegments(cwd)
  safeSegments(directory)
  const workspace = inspect(path.resolve(cwd), 'directory')
  const root = path.resolve(workspace, directory)
  inspect(root, 'directory', true)
  return { cwd: workspace, root }
}
function validatePayload(value) {
  keys(value, ['type', 'source', 'summary', 'evidence', 'reference', 'generator', 'decision'], 'record')
  must(['learning', 'decision'].includes(value.type), 'Invalid learning record type')
  text(value.summary, LEARNING_LIMITS.summary, 'summary')
  if (value.source !== undefined) {
    keys(value.source, ['sessionId', 'project', 'eventId'], 'source')
    for (const [key, field] of Object.entries(value.source)) text(field, LEARNING_LIMITS.source, `source.${key}`)
  }
  for (const key of ['evidence', 'reference']) if (value[key] !== undefined) text(value[key], LEARNING_LIMITS[key], key)
  if (value.generator !== undefined) {
    keys(value.generator, ['provider', 'model'], 'generator')
    identity(value.generator.provider, 'generator.provider'); identity(value.generator.model, 'generator.model')
  }
  if (value.type === 'decision') {
    keys(value.decision, ['action', 'reason', 'confidence', 'alternatives'], 'decision')
    text(value.decision.action, 2000, 'decision.action')
    if (value.decision.reason !== undefined) text(value.decision.reason, 4000, 'decision.reason')
    if (value.decision.confidence !== undefined) must(Number.isFinite(value.decision.confidence) && value.decision.confidence >= 0 && value.decision.confidence <= 1, 'decision.confidence must be between 0 and 1')
    if (value.decision.alternatives !== undefined) {
      must(Array.isArray(value.decision.alternatives) && value.decision.alternatives.length <= 12, 'decision.alternatives must have at most 12 entries')
      for (const alternative of value.decision.alternatives) text(alternative, 1000, 'decision.alternative')
    }
  } else must(value.decision === undefined, 'learning records cannot contain decision data')
}
const ID = /^\d{13}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u
/**
 * One immutable file per record; no session logs or raw prompts are read.
 * maxRecords is a hard append cap and bounded read cap. No automatic deletion.
 * Append uses an exclusive directory lock; a crash-stale lock requires explicit
 * owner inspection/removal. Local filesystem integrity checks are not signatures.
 */
export function createLearningStore({ cwd, directory = 'novel_learning', provider, model, maxRecords = 500 }) {
  identity(provider, 'provider'); identity(model, 'model')
  must(Number.isSafeInteger(maxRecords) && maxRecords >= 1 && maxRecords <= LEARNING_LIMITS.maxRecords, 'maxRecords must be an integer between 1 and 10000')
  const resolved = resolveLearningDirectory({ cwd, directory })
  const workspaceKey = process.platform === 'win32' ? resolved.cwd.toLowerCase() : resolved.cwd
  const location = path.join(resolved.root, `workspace-${digest(workspaceKey)}`, `${slug(provider)}-${slug(model)}-${digest(JSON.stringify([provider, model]))}`)
  inspect(location, 'directory', true)
  const lock = path.join(location, '.append-lock')
  const ensure = () => { inspect(location, 'directory', true); fs.mkdirSync(location, { recursive: true }); inspect(location, 'directory') }
  const inventory = () => {
    inspect(location, 'directory', true)
    if (!fs.existsSync(location)) return []
    const names = []
    // Stream entries to enforce a read bound without allocating an unbounded list.
    const dir = fs.opendirSync(location)
    try {
      let entry
      while ((entry = dir.readSync())) {
        if (entry.name === '.append-lock' || entry.name.endsWith('.tmp')) continue
        must(entry.name.endsWith('.json') && ID.test(entry.name.slice(0, -5)), `Unexpected record entry: ${entry.name}`)
        must(entry.isFile(), `Unsafe record entry: ${entry.name}`)
        names.push(entry.name)
        must(names.length <= maxRecords, `Learning namespace exceeds maxRecords (${maxRecords}); no files were deleted`)
      }
    } finally { dir.closeSync() }
    return names.sort()
  }
  function read(name) {
    const file = inspect(path.join(location, name), 'file')
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0))
    try {
      const stat = fs.fstatSync(fd)
      must(stat.isFile() && stat.nlink === 1 && stat.size <= LEARNING_LIMITS.recordBytes, 'Record exceeds size bound or has unsafe links')
      const record = JSON.parse(fs.readFileSync(fd, 'utf8'))
      keys(record, ['schemaVersion', 'id', 'type', 'createdAt', 'provider', 'model', 'source', 'summary', 'evidence', 'reference', 'generator', 'decision'], 'stored record')
      must(record.schemaVersion === LEARNING_SCHEMA_VERSION && record.id === name.slice(0, -5), 'Record schema or id mismatch')
      must(record.provider === provider && record.model === model, 'Record provider/model namespace mismatch')
      must(typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt)) && new Date(record.createdAt).toISOString() === record.createdAt, 'Invalid record date')
      const { schemaVersion, id, createdAt, provider: _provider, model: _model, ...payload } = record
      validatePayload(payload)
      return record
    } finally { fs.closeSync(fd) }
  }
  function list({ limit = maxRecords, type, project } = {}) {
    must(Number.isSafeInteger(limit) && limit >= 0 && limit <= maxRecords, 'Invalid list limit')
    must(type === undefined || ['learning', 'decision'].includes(type), 'Invalid list type')
    must(project === undefined || (typeof project === 'string' && project.length <= 512), 'Invalid project filter')
    // Validate the bounded inventory, retaining only the requested result window.
    const records = []
    for (const name of inventory()) {
      const record = read(name)
      if ((!type || record.type === type) && (project === undefined || record.source?.project === project) && limit > 0) {
        records.push(record)
        if (records.length > limit) records.shift()
      }
    }
    return records
  }
  function append(input) {
    validatePayload(input)
    const copy = JSON.parse(JSON.stringify(input))
    ensure()
    inspect(lock, 'directory', true)
    try { fs.mkdirSync(lock) } catch (error) { if (error.code === 'EEXIST') throw new Error(`Learning namespace busy; inspect lock before retrying: ${lock}`); throw error }
    let temp
    try {
      const existing = inventory()
      must(existing.length < maxRecords, `Learning namespace reached maxRecords (${maxRecords}); no files were deleted`)
      // Existing namespace corruption is never silently propagated.
      for (const name of existing) read(name)
      const id = `${Date.now()}-${randomUUID()}`
      const record = { schemaVersion: LEARNING_SCHEMA_VERSION, id, createdAt: new Date().toISOString(), provider, model, source: {}, ...copy }
      const data = `${JSON.stringify(record)}\n`
      must(Buffer.byteLength(data) <= LEARNING_LIMITS.recordBytes, 'Record exceeds serialized size bound')
      temp = path.join(location, `.${id}.tmp`)
      const destination = path.join(location, `${id}.json`)
      inspect(destination, 'file', true)
      const fd = fs.openSync(temp, 'wx', 0o600)
      try { fs.writeFileSync(fd, data); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      inspect(location, 'directory')
      // Atomic no-overwrite publication: unlike rename, link refuses an existing target.
      fs.linkSync(temp, destination)
      fs.unlinkSync(temp); temp = undefined
      return { ...record, location: destination }
    } finally {
      if (temp) { try { fs.unlinkSync(temp) } catch { /* preserve original write error */ } }
      fs.rmdirSync(lock)
    }
  }
  return Object.freeze({ cwd: resolved.cwd, root: resolved.root, location, provider, model, maxRecords, append, list, recent: (limit = Math.min(20, maxRecords)) => list({ limit }).reverse() })
}
