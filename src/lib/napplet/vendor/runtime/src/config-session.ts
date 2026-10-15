import {
  boundedJson,
  ConfigError,
  isRecord,
  resolveConfig,
  validateConfigSchema,
  validConfigValue,
  withoutSecrets,
  type ConfigSchema,
  type ConfigValues
} from './config-schema'
import type { KeyValueStorage } from './storage'

export type ConfigView = {
  schema: ConfigSchema | null
  values: ConfigValues
  open: boolean
  section?: string
  error: string
  persistent: boolean
  revision: number
}
/** Trusted UI methods never appear in window.napplet; wire callers can only read/register. */
export class NappletConfig {
  private schema: ConfigSchema | null = null
  private values: ConfigValues = {}
  private inputs: ConfigValues = {}
  private pendingGets = new Set<string>()
  private subscribed = false
  private active = true
  private lastOpen = -Infinity
  private listeners = new Set<() => void>()
  private view: ConfigView = {
    schema: null,
    values: {},
    open: false,
    error: '',
    persistent: true,
    revision: 0
  }
  private key: string
  private declarationError: ConfigError | null = null
  constructor(
    private options: {
      storage: KeyValueStorage
      identity: string
      pubkey: string | null
      declaration?: { schema?: unknown; error?: string }
      send: (message: Record<string, unknown>) => void
      focused: () => boolean
    }
  ) {
    this.key = this.scope(options.pubkey)
    try {
      if (options.declaration?.error)
        throw new ConfigError('invalid-schema', options.declaration.error)
      if (options.declaration?.schema !== undefined) this.register(options.declaration.schema)
    } catch (error) {
      this.declarationError = this.asError(error)
      this.publishView({ error: this.declarationError.message })
    }
  }
  private scope(pubkey: string | null) {
    return `space:config:v1:${JSON.stringify([this.options.identity, pubkey ?? 'guest'])}`
  }
  private asError(error: unknown) {
    return error instanceof ConfigError
      ? error
      : new ConfigError('invalid-schema', 'Configuration could not be validated.')
  }
  private send(message: Record<string, unknown>) {
    if (this.active) this.options.send(message)
  }
  private pushError(error: ConfigError) {
    this.send({ type: 'config.schemaError', code: error.code, error: error.message })
  }
  private publishView(patch: Partial<ConfigView> = {}) {
    this.view = {
      ...this.view,
      schema: this.schema,
      values: structuredClone(this.values),
      revision: this.view.revision + 1,
      ...patch
    }
    this.listeners.forEach((listener) => listener())
  }
  getSnapshot = () => this.view
  subscribeView = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private read(): ConfigValues {
    try {
      const text = this.options.storage.getItem(this.key)
      const saved = text && text.length <= 65536 ? JSON.parse(text) : {}
      return isRecord(saved) ? (saved as ConfigValues) : {}
    } catch {
      this.view.persistent = false
      return {}
    }
  }
  private persist() {
    if (!this.schema) return
    try {
      this.options.storage.setItem(this.key, boundedJson(withoutSecrets(this.schema, this.inputs)))
    } catch {
      this.view.persistent = false
    }
  }
  private notifyValues(id?: string) {
    if (!this.schema) {
      this.pushError(
        this.declarationError ??
          new ConfigError('no-schema', 'This napplet has not declared settings.')
      )
      return
    }
    if (!validConfigValue(this.schema, this.values, false)) {
      if (id && this.pendingGets.size < 64) this.pendingGets.add(id)
      this.publishView({
        error: 'Choose settings before this napplet can receive a valid snapshot.'
      })
      return
    }
    this.send({
      type: 'config.values',
      ...(id ? { id } : {}),
      values: structuredClone(this.values)
    })
  }
  private changed() {
    if (this.schema && validConfigValue(this.schema, this.values, false)) {
      for (const id of this.pendingGets) this.notifyValues(id)
      this.pendingGets.clear()
    }
    if (this.subscribed) this.notifyValues()
  }
  private register(input: unknown, version?: unknown) {
    const next = validateConfigSchema(input, version)
    if (
      this.schema?.$version !== undefined &&
      next.$version !== undefined &&
      next.$version < this.schema.$version
    )
      throw new ConfigError(
        'version-conflict',
        'A running napplet cannot lower its settings schema version.'
      )
    const saved = this.schema
      ? this.inputs
      : withoutSecrets(next, resolveConfig(next, this.read(), undefined, false))
    this.schema = next
    this.declarationError = null
    this.inputs = resolveConfig(next, saved, undefined, false)
    this.values = resolveConfig(next, this.inputs)
    this.persist() // Drop orphaned values, including secret leftovers from older storage.
    this.publishView({ error: '', open: false })
  }
  ready() {
    if (this.declarationError) this.pushError(this.declarationError)
  }
  handle(message: Record<string, unknown>) {
    if (!this.active) return
    const type = message.type
    const fields: Record<string, string[]> = {
      'config.registerSchema': ['type', 'id', 'schema', 'version'],
      'config.get': ['type', 'id'],
      'config.subscribe': ['type'],
      'config.unsubscribe': ['type'],
      'config.openSettings': ['type', 'section']
    }
    if (typeof type !== 'string' || !fields[type]) return
    if (Object.keys(message).some((key) => !fields[type].includes(key))) return
    if (
      ['config.registerSchema', 'config.get'].includes(type) &&
      (typeof message.id !== 'string' || !message.id || message.id.length > 128)
    )
      return
    if (type === 'config.registerSchema') {
      try {
        this.register(message.schema, message.version)
        this.send({ type: 'config.registerSchema.result', id: message.id, ok: true })
        this.changed()
      } catch (error) {
        const detail = this.asError(error)
        this.send({
          type: 'config.registerSchema.result',
          id: message.id,
          ok: false,
          code: detail.code,
          error: detail.message
        })
        this.pushError(detail)
      }
    } else if (type === 'config.get') this.notifyValues(message.id as string)
    else if (type === 'config.subscribe') {
      this.subscribed = true
      this.notifyValues()
    } else if (type === 'config.unsubscribe') this.subscribed = false
    else if (
      type === 'config.openSettings' &&
      this.options.focused() &&
      Date.now() - this.lastOpen > 2000
    ) {
      if (
        message.section !== undefined &&
        (typeof message.section !== 'string' || message.section.length > 2048)
      )
        return
      this.open(message.section as string | undefined)
      this.lastOpen = Date.now()
    }
  }
  open(section?: string) {
    if (!this.active || !this.schema) return
    // Unknown sections silently fall back to the complete form.
    this.publishView({ open: true, section, error: '' })
  }
  dismiss() {
    this.publishView({ open: false })
  }
  commit(values: unknown): boolean {
    if (!this.active || !this.schema) return false
    try {
      boundedJson(values)
      if (!validConfigValue(this.schema, values)) throw new Error()
      this.inputs = resolveConfig(this.schema, values, undefined, false)
      this.values = resolveConfig(this.schema, this.inputs)
      this.persist()
      this.publishView({ open: false, error: '' })
      this.changed()
      return true
    } catch {
      this.publishView({ error: 'Check required fields, types and limits before saving.' })
      return false
    }
  }
  reset() {
    if (!this.active || !this.schema) return
    this.inputs = {}
    this.values = resolveConfig(this.schema, this.inputs)
    this.persist()
    this.publishView({ error: '' })
    this.changed()
  }
  updateIdentity(pubkey: string | null) {
    if (!this.active || this.key === this.scope(pubkey)) return
    this.key = this.scope(pubkey)
    this.pendingGets.clear()
    this.inputs = this.schema
      ? withoutSecrets(this.schema, resolveConfig(this.schema, this.read(), undefined, false))
      : {}
    this.values = this.schema ? resolveConfig(this.schema, this.inputs) : {}
    this.publishView({ open: false, error: '' })
    if (this.subscribed) this.notifyValues()
  }
  close() {
    this.active = false
    this.subscribed = false
    this.values = {}
    this.inputs = {}
    this.pendingGets.clear()
    this.publishView({ open: false })
    this.listeners.clear()
  }
}
