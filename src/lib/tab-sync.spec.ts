import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishTabSync, TabSyncType, type TTabSyncMessage } from './tab-sync'

describe('tab-sync', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports stable message type constants used by FollowListProvider', () => {
    expect(TabSyncType.FOLLOW_LIST_UPDATED).toBe('follow-list-updated')
    expect(TabSyncType.MUTE_LIST_UPDATED).toBe('mute-list-updated')
  })

  it('publishTabSync writes then clears localStorage fallback payload', () => {
    const writes: Array<{ key: string; value: string }> = []
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => {
        writes.push({ key: k, value: v })
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
      getItem: (k: string) => store.get(k) ?? null
    })
    // Force no BroadcastChannel so localStorage path is exercised
    vi.stubGlobal('BroadcastChannel', undefined)

    publishTabSync({ type: TabSyncType.FOLLOW_LIST_UPDATED, accountPubkey: 'abc' })

    expect(writes.length).toBeGreaterThanOrEqual(1)
    expect(writes[0].key).toBe('jumble:tab-sync')
    const msg = JSON.parse(writes[0].value) as TTabSyncMessage
    expect(msg.type).toBe('follow-list-updated')
    expect(msg.accountPubkey).toBe('abc')
    expect(typeof msg.ts).toBe('number')
    // implementation clears after write so same payload can fire again
    expect(store.has('jumble:tab-sync')).toBe(false)
  })
})
