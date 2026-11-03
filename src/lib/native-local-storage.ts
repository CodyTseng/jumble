import type { TLocalStorageSnapshot } from '@/types/native-storage'
import { getNativeStorageBridge } from './native-storage'
import { isAndroid } from './platform'

export const NATIVE_STORAGE_REVISION_KEY = '__jumbleElectronStorageRevision'

const SNAPSHOT_VERSION = 1 as const
const SAVE_DEBOUNCE_MS = 50
const EXCLUDED_KEYS = new Set([
  'encryptionKeyPrivkeyMap',
  'retiredEncryptionKeyPrivkeyMap',
  'clientKeyPrivkeyMap'
])
const ACCOUNT_KEYS = new Set(['accounts', 'currentAccount'])
const SECRET_ACCOUNT_FIELDS = ['nsec', 'ncryptsec', 'bunkerClientSecretKey'] as const

let backupStarted = false

function readRevision(storage: Storage): number {
  const value = Number(storage.getItem(NATIVE_STORAGE_REVISION_KEY) ?? 0)
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function sanitizeAccountValue(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value)
    const stripSecrets = (account: unknown) => {
      if (!account || typeof account !== 'object' || Array.isArray(account)) return account
      const stripped = { ...(account as Record<string, unknown>) }
      for (const field of SECRET_ACCOUNT_FIELDS) delete stripped[field]
      return stripped
    }
    return JSON.stringify(Array.isArray(parsed) ? parsed.map(stripSecrets) : stripSecrets(parsed))
  } catch {
    return null
  }
}

export function collectSafeLocalStorageEntries(storage: Storage): Record<string, string> {
  const entries: Record<string, string> = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || EXCLUDED_KEYS.has(key)) continue
    const value = storage.getItem(key)
    if (value === null) continue
    if (ACCOUNT_KEYS.has(key)) {
      const sanitized = sanitizeAccountValue(value)
      if (sanitized !== null) entries[key] = sanitized
    } else {
      entries[key] = value
    }
  }
  return entries
}

export function shouldRestoreLocalStorage(
  storage: Storage,
  snapshot: TLocalStorageSnapshot
): boolean {
  return snapshot.revision > readRevision(storage)
}

export async function restoreNativeLocalStorage(): Promise<void> {
  const bridge = getNativeStorageBridge()
  if (!bridge) return

  try {
    const snapshot = await bridge.localStorage.load()
    if (!snapshot) return
    if (
      snapshot.version !== 1 ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 0 ||
      !snapshot.entries ||
      typeof snapshot.entries !== 'object' ||
      Array.isArray(snapshot.entries) ||
      Object.values(snapshot.entries).some((value) => typeof value !== 'string')
    ) {
      throw new Error('Invalid native storage snapshot')
    }
    if (!shouldRestoreLocalStorage(window.localStorage, snapshot)) return

    window.localStorage.clear()
    for (const [key, value] of Object.entries(snapshot.entries)) {
      window.localStorage.setItem(key, value)
    }
  } catch (error) {
    if (isAndroid()) throw error
    console.error('[storage] failed to restore native localStorage snapshot:', error)
  }
}

export function startNativeLocalStorageBackup(): void {
  if (backupStarted) return
  const bridge = getNativeStorageBridge()
  if (!bridge) return
  backupStarted = true

  const storage = window.localStorage
  const storagePrototype = Storage.prototype
  const originalSetItem = storagePrototype.setItem
  const originalRemoveItem = storagePrototype.removeItem
  const originalClear = storagePrototype.clear
  let revision = Math.max(readRevision(storage), Date.now())
  let timer: ReturnType<typeof setTimeout> | null = null
  let saveChain: Promise<void> = Promise.resolve()

  const persistRevision = () => {
    originalSetItem.call(storage, NATIVE_STORAGE_REVISION_KEY, revision.toString())
  }

  const saveNow = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const snapshot: TLocalStorageSnapshot = {
      version: SNAPSHOT_VERSION,
      revision,
      entries: collectSafeLocalStorageEntries(storage)
    }
    saveChain = saveChain
      .catch(() => {
        // Keep later snapshots flowing after a transient failure.
      })
      .then(() => bridge.localStorage.save(snapshot))
      .catch((error) => {
        console.error('[storage] failed to back up native localStorage:', error)
      })
  }

  const queueSave = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(saveNow, SAVE_DEBOUNCE_MS)
  }

  const didMutate = () => {
    revision = Math.max(revision + 1, Date.now())
    persistRevision()
    queueSave()
  }

  storagePrototype.setItem = function (key: string, value: string) {
    originalSetItem.call(this, key, value)
    if (this === storage && key !== NATIVE_STORAGE_REVISION_KEY) didMutate()
  }
  storagePrototype.removeItem = function (key: string) {
    originalRemoveItem.call(this, key)
    if (this === storage && key !== NATIVE_STORAGE_REVISION_KEY) didMutate()
  }
  storagePrototype.clear = function () {
    originalClear.call(this)
    if (this === storage) didMutate()
  }

  persistRevision()
  saveNow()
  window.addEventListener('pagehide', saveNow)
  window.addEventListener('jumble:pause', saveNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow()
  })
}
