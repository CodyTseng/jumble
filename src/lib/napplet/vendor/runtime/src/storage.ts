export interface KeyValueStorage {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function scopedStorage(storage: KeyValueStorage, identity: string, instance: string) {
  const prefix = `space:napplet:${JSON.stringify(identity)}:`
  const ephemeral = new Map<string, string>()
  const instanceStorage: KeyValueStorage = {
    get length() {
      return ephemeral.size
    },
    key: (i) => [...ephemeral.keys()][i] ?? null,
    getItem: (key) => ephemeral.get(key) ?? null,
    setItem: (key, value) => {
      ephemeral.set(key, value)
    },
    removeItem: (key) => {
      ephemeral.delete(key)
    }
  }
  return (message: Record<string, unknown>) => {
    if (message.scope !== undefined && !['shared', 'instance'].includes(String(message.scope)))
      throw new Error('Invalid storage scope')
    const scope = `${prefix}${message.scope === 'instance' ? `instance:${instance}` : 'shared'}:`
    const target = message.scope === 'instance' ? instanceStorage : storage
    const keys = () =>
      Array.from({ length: target.length }, (_, i) => target.key(i)).filter(
        (key): key is string => key !== null && key.startsWith(scope)
      )
    if (message.type === 'storage.keys')
      return { keys: keys().map((key) => key.slice(scope.length)) }
    if (typeof message.key !== 'string' || message.key.length > 256)
      throw new Error('Invalid storage key')
    const key = scope + message.key
    switch (message.type) {
      case 'storage.get':
        return { value: target.getItem(key) }
      case 'storage.remove':
        target.removeItem(key)
        return {}
      case 'storage.set': {
        if (typeof message.value !== 'string') throw new Error('Storage values must be strings')
        const existing = keys()
        const total = existing
          .filter((k) => k !== key)
          .reduce((n, k) => n + k.length + (target.getItem(k)?.length ?? 0), 0)
        if (
          (existing.length >= 256 && !existing.includes(key)) ||
          total + key.length + message.value.length > 1024 * 1024
        )
          throw new Error('Storage quota exceeded')
        target.setItem(key, message.value)
        return {}
      }
      default:
        throw new Error('Unsupported storage operation')
    }
  }
}
