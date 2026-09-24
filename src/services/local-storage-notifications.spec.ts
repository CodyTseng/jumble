import { StorageKey } from '@/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/platform', () => ({
  isElectron: () => false,
  getElectronBridge: () => undefined
}))
vi.mock('@/lib/utils', () => ({ isTorBrowser: () => false }))

const values = new Map<string, string>()
const accountA = 'ab'.repeat(32)
const accountB = 'cd'.repeat(32)
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key)
}

// Each module evaluation constructs a real service with independent in-memory caches,
// like separate browser pages, while both pages share the same persistent storage.
async function serviceSnapshot() {
  vi.resetModules()
  return (await import('./local-storage.service')).default
}

function storedReadTimes() {
  return JSON.parse(values.get(StorageKey.LAST_READ_NOTIFICATION_TIME_MAP) ?? '{}')
}

describe('notification read time across local-storage snapshots', () => {
  beforeEach(() => {
    values.clear()
    vi.stubGlobal('window', { localStorage, addEventListener: vi.fn() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('reads a sibling page local-only update without a relay event or storage callback', async () => {
    const pageA = await serviceSnapshot()
    const pageB = await serviceSnapshot()
    expect(pageA).not.toBe(pageB)
    expect(pageB.getLastReadNotificationTime(accountA)).toBe(0)

    // This is the storage write used when marking notifications read with skipPublish.
    pageA.setLastReadNotificationTime(accountA, 200)

    expect(pageB.getLastReadNotificationTime(accountA)).toBe(200)
    expect(storedReadTimes()).toEqual({ [accountA]: 200 })
  })

  it('does not overwrite a newer sibling read time with a stale incoming timestamp', async () => {
    const pageA = await serviceSnapshot()
    const pageB = await serviceSnapshot()

    pageA.setLastReadNotificationTime(accountA, 200)
    // Do not refresh pageB through its getter before the write: its cache is still stale.
    pageB.setLastReadNotificationTime(accountA, 100)

    expect(storedReadTimes()).toEqual({ [accountA]: 200 })
    expect(pageA.getLastReadNotificationTime(accountA)).toBe(200)
    expect(pageB.getLastReadNotificationTime(accountA)).toBe(200)
  })

  it('preserves other account entries when independently cached pages write', async () => {
    const pageA = await serviceSnapshot()
    const pageB = await serviceSnapshot()

    pageA.setLastReadNotificationTime(accountA, 200)
    pageB.setLastReadNotificationTime(accountB, 300)
    pageA.setLastReadNotificationTime(accountA, 250)

    expect(storedReadTimes()).toEqual({ [accountA]: 250, [accountB]: 300 })
    expect(pageA.getLastReadNotificationTime(accountB)).toBe(300)
    expect(pageB.getLastReadNotificationTime(accountA)).toBe(250)
  })
})
