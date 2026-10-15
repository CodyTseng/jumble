/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
import { z } from 'zod'

const permissions = ['read', 'write', 'create', 'delete', 'list', 'watch']
const MAX_CHUNK = 256 * 1024,
  MAX_TOTAL = 10 * 1024 * 1024
const pathSchema = z
  .string()
  .max(512)
  .refine((path) => path === path.normalize('NFC'), 'invalid-path')
  .refine(
    (path) =>
      path === '/files' ||
      (path.startsWith('/files/') &&
        path
          .split('/')
          .slice(2)
          .every(
            (part) =>
              part &&
              part !== '.' &&
              part !== '..' &&
              !/[\\\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(part)
          )),
    'invalid-path'
  )
const optionsSchema = z
  .object({
    mode: z.enum(['replace', 'append', 'patch']).default('replace'),
    offset: z.number().int().nonnegative().max(MAX_TOTAL).optional(),
    ifRevision: z.string().optional(),
    ifAbsent: z.boolean().optional()
  })
  .strict()
type Entry = {
  path: string
  kind: 'file' | 'directory'
  data: Uint8Array
  revision: string
  modifiedAt: number
}
export type ExportFile = { name: string; blob: Blob }
export const pickOptionsSchema = z
  .object({
    permissions: z
      .array(z.enum(['read', 'write', 'create', 'delete', 'list', 'watch']))
      .max(6)
      .optional(),
    accept: z
      .array(
        z
          .object({
            mime: z.string().max(128).optional(),
            extension: z.string().max(32).optional()
          })
          .strict()
      )
      .max(16)
      .optional(),
    suggestedName: z.string().max(120).optional(),
    description: z.string().max(300).optional()
  })
  .strict()
export type FilePick = {
  directory: boolean
  multiple: boolean
  accept: string
  description?: string
}
export function filePick(type: string, options: z.infer<typeof pickOptionsSchema>): FilePick {
  return {
    directory: type === 'fs.pickDirectory',
    multiple: type !== 'fs.pickFile',
    description: options.description,
    accept: (options.accept ?? [])
      .flatMap((rule) => [rule.mime, rule.extension])
      .filter(
        (value): value is string =>
          !!value && /^(?:[a-zA-Z0-9.+-]+\/(?:[a-zA-Z0-9.+-]+|\*)|\.[a-zA-Z0-9]+)$/.test(value)
      )
      .join(',')
  }
}

/** A frame-owned virtual filesystem. Pickers never grant host paths or OS access. */
export class NappletFiles {
  private entries = new Map<string, Entry>()
  private watches = new Map<string, { path: string; recursive: boolean }>()
  constructor(
    private emit: (message: Record<string, unknown>) => void,
    private changed: (files: ExportFile[]) => void
  ) {
    this.entries.set('/files', this.entry('/files', 'directory'))
  }
  private entry(path: string, kind: Entry['kind'], data = new Uint8Array()): Entry {
    return { path, kind, data, revision: crypto.randomUUID(), modifiedAt: Date.now() }
  }
  private metadata(entry: Entry) {
    return {
      path: entry.path,
      kind: entry.kind,
      name: entry.path.split('/').pop(),
      size: entry.data.length,
      permissions,
      revision: entry.revision,
      modifiedAt: entry.modifiedAt
    }
  }
  private update(path: string, kind: string, fromPath?: string) {
    for (const [watchId, watch] of this.watches)
      if (
        path === watch.path ||
        (path.startsWith(watch.path + '/') &&
          (watch.recursive || path.slice(watch.path.length + 1).indexOf('/') < 0))
      )
        this.emit({
          type: 'fs.changed',
          change: { watchId, path, kind, ...(fromPath ? { fromPath } : {}) }
        })
    this.changed(
      [...this.entries.values()]
        .filter((e) => e.kind === 'file')
        .map((e) => ({
          name: e.path.slice(7),
          blob: new Blob([e.data as Uint8Array], { type: 'application/octet-stream' })
        }))
    )
  }
  async handle(
    message: Record<string, unknown>,
    chooseSave: (name: string) => Promise<boolean>,
    chooseFiles?: (pick: FilePick) => Promise<File[]>,
    signal?: AbortSignal
  ) {
    if (message.type === 'fs.info')
      return {
        info: {
          roots: [{ path: '/files', name: 'Session files', permissions }],
          limits: {
            maxReadBytes: MAX_CHUNK,
            maxWriteBytes: MAX_CHUNK,
            maxWatchCount: 16,
            maxInFlightRequests: 8
          }
        }
      }
    if (message.type === 'fs.pickSaveFile') {
      const options = z
        .object({ suggestedName: z.string().max(120).default('napplet.bin') })
        .passthrough()
        .parse(message.options ?? {})
      const name =
        options.suggestedName.replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+/, '_') ||
        'napplet.bin'
      if (!(await chooseSave(name))) throw new Error('cancelled')
      const path = pathSchema.parse('/files/' + name)
      // A picker returns a destination; the first write creates the file.
      return {
        result: { entries: [this.metadata(this.entries.get(path) ?? this.entry(path, 'file'))] }
      }
    }
    if (['fs.pickFile', 'fs.pickFiles', 'fs.pickDirectory'].includes(String(message.type))) {
      if (!chooseFiles) throw new Error('unsupported')
      const pick = filePick(String(message.type), pickOptionsSchema.parse(message.options ?? {}))
      const selected = await chooseFiles(pick)
      signal?.throwIfAborted()
      if (!selected.length) throw new Error('cancelled')
      if (
        (!pick.multiple && selected.length !== 1) ||
        selected.length > 127 ||
        selected.reduce((n, file) => n + file.size, 0) > MAX_TOTAL
      )
        throw new Error('quota-exceeded')
      const base = '/files/import-' + crypto.randomUUID()
      const staged = new Map<string, Entry>([[base, this.entry(base, 'directory')]])
      for (const file of selected) {
        const relative = (pick.directory ? file.webkitRelativePath : file.name).normalize('NFC')
        if (!relative || relative.startsWith('/')) throw new Error('invalid-path')
        const path = pathSchema.parse(base + '/' + relative)
        const parts = path.split('/')
        for (let i = 3; i < parts.length; i++) {
          const parent = parts.slice(0, i).join('/')
          if (staged.get(parent)?.kind === 'file') throw new Error('conflict')
          if (!staged.has(parent)) staged.set(parent, this.entry(parent, 'directory'))
        }
        if (staged.has(path)) throw new Error('conflict')
        staged.set(path, this.entry(path, 'file', new Uint8Array(await file.arrayBuffer())))
        signal?.throwIfAborted()
      }
      // Recheck after asynchronous reads: another request may have filled this scope.
      if (
        this.entries.size + staged.size > 128 ||
        [...this.entries.values(), ...staged.values()].reduce((n, e) => n + e.data.length, 0) >
          MAX_TOTAL
      )
        throw new Error('quota-exceeded')
      for (const [path, entry] of staged) this.entries.set(path, entry)
      this.update(base, 'created')
      const entries = pick.directory
        ? [...staged.values()].filter(
            (e) => e.path.startsWith(base + '/') && !e.path.slice(base.length + 1).includes('/')
          )
        : [...staged.values()].filter((e) => e.kind === 'file')
      return { result: { entries: entries.map((entry) => this.metadata(entry)) } }
    }
    if (message.type === 'fs.unwatch') {
      this.watches.delete(z.string().parse(message.watchId))
      return {}
    }
    const path = pathSchema.parse(message.type === 'fs.move' ? message.fromPath : message.path)
    const existing = this.entries.get(path)
    if (message.type === 'fs.write') {
      const data = z
        .string()
        .max(Math.ceil(MAX_CHUNK / 3) * 4)
        .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
        .parse(message.data)
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      if (bytes.length > MAX_CHUNK) throw new Error('too-large')
      const options = optionsSchema.parse(message.options ?? {})
      if (existing?.kind === 'directory') throw new Error('not-a-file')
      if (
        (options.ifAbsent && existing) ||
        (options.ifRevision !== undefined && options.ifRevision !== existing?.revision)
      )
        throw new Error('conflict')
      if (options.mode === 'patch' ? options.offset === undefined : options.offset !== undefined)
        throw new Error('invalid-data')
      const offset =
        options.mode === 'append'
          ? (existing?.data.length ?? 0)
          : options.mode === 'patch'
            ? options.offset!
            : 0
      const size = Math.max(
        offset + bytes.length,
        options.mode === 'replace' ? 0 : (existing?.data.length ?? 0)
      )
      const total =
        [...this.entries.values()].reduce((n, e) => n + e.data.length, 0) -
        (existing?.data.length ?? 0) +
        size
      if (total > MAX_TOTAL || (!existing && this.entries.size >= 128))
        throw new Error('quota-exceeded')
      if (this.entries.get(path.slice(0, path.lastIndexOf('/')))?.kind !== 'directory')
        throw new Error('not-a-directory')
      const next = new Uint8Array(size)
      if (options.mode !== 'replace' && existing) next.set(existing.data)
      next.set(bytes, offset)
      this.entries.set(path, this.entry(path, 'file', next))
      this.update(path, existing ? 'modified' : 'created')
      return { result: { bytesWritten: bytes.length, size } }
    }
    if (message.type === 'fs.mkdir') {
      if (existing) throw new Error('already-exists')
      const recursive = z
        .object({ recursive: z.boolean().optional() })
        .strict()
        .parse(message.options ?? {}).recursive
      const parts = path.split('/')
      const missing: string[] = []
      for (let i = 3; i <= parts.length; i++) {
        const current = parts.slice(0, i).join('/'),
          e = this.entries.get(current)
        if (e && e.kind !== 'directory') throw new Error('not-a-directory')
        if (!e) {
          if (!recursive && current !== path) throw new Error('not-found')
          missing.push(current)
        }
      }
      if (this.entries.size + missing.length > 128) throw new Error('quota-exceeded')
      for (const current of missing) this.entries.set(current, this.entry(current, 'directory'))
      this.update(path, 'created')
      return {}
    }
    if (!existing) throw new Error('not-found')
    if (message.type === 'fs.stat') return { metadata: this.metadata(existing) }
    if (message.type === 'fs.list') {
      if (existing.kind !== 'directory') throw new Error('not-a-directory')
      return {
        entries: [...this.entries.values()]
          .filter(
            (e) => e.path.startsWith(path + '/') && !e.path.slice(path.length + 1).includes('/')
          )
          .map((e) => this.metadata(e))
      }
    }
    if (message.type === 'fs.read') {
      if (existing.kind !== 'file') throw new Error('not-a-file')
      const { offset, length } = z
        .object({
          offset: z.number().int().min(0).max(MAX_TOTAL).default(0),
          length: z.number().int().min(0).max(MAX_CHUNK).default(MAX_CHUNK)
        })
        .strict()
        .parse(message.options ?? {})
      const chunk = existing.data.slice(offset, offset + length)
      let binary = ''
      for (const byte of chunk) binary += String.fromCharCode(byte)
      return {
        result: {
          data: btoa(binary),
          offset,
          bytesRead: chunk.length,
          size: existing.data.length,
          eof: offset + chunk.length >= existing.data.length
        }
      }
    }
    if (message.type === 'fs.watch') {
      if (this.watches.size >= 16) throw new Error('quota-exceeded')
      const recursive =
        z
          .object({ recursive: z.boolean().optional() })
          .strict()
          .parse(message.options ?? {}).recursive ?? false
      const watchId = crypto.randomUUID()
      this.watches.set(watchId, { path, recursive })
      return { watchId }
    }
    if (path === '/files') throw new Error('permission-denied')
    const descendants = [...this.entries.keys()].filter((key) => key.startsWith(path + '/'))
    if (message.type === 'fs.remove') {
      if (descendants.length && message.recursive !== true) throw new Error('conflict')
      for (const key of [path, ...descendants]) this.entries.delete(key)
      this.update(path, 'deleted')
      return {}
    }
    if (message.type === 'fs.move') {
      const to = pathSchema.parse(message.toPath)
      if (to.startsWith(path + '/') || this.entries.has(to)) throw new Error('conflict')
      if (this.entries.get(to.slice(0, to.lastIndexOf('/')))?.kind !== 'directory')
        throw new Error('not-a-directory')
      for (const key of [path, ...descendants]) {
        const entry = this.entries.get(key)!
        this.entries.delete(key)
        const target = to + key.slice(path.length)
        this.entries.set(target, { ...entry, path: target, revision: crypto.randomUUID() })
      }
      this.update(to, 'moved', path)
      return {}
    }
    throw new Error('unsupported')
  }
}
