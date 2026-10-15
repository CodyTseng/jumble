import type { KeyValueStorage } from './vendor/runtime/src/storage'

/** Present a virtual storage root to upstream, so every upstream key is account-scoped. */
export function accountStorage(storage: KeyValueStorage, account: string): KeyValueStorage {
  const prefix = `jumble:napplet:${JSON.stringify(account)}:`
  const keys = () =>
    Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
      (key): key is string => key !== null && key.startsWith(prefix)
    )
  return {
    get length() {
      return keys().length
    },
    key: (index) => keys()[index]?.slice(prefix.length) ?? null,
    getItem: (key) => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: (key) => storage.removeItem(prefix + key)
  }
}
