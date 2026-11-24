// @vitest-environment jsdom

import { StorageKey } from '@/constants'
import { createStore, Provider } from 'jotai'
import { kinds, type NostrEvent } from 'nostr-tools'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { useMutedNoteNotifications } from './useMutedNoteNotifications'

const account = vi.hoisted(() => ({ pubkey: '1'.repeat(64) }))
vi.mock('@/providers/NostrProvider', () => ({ useNostr: () => account }))

it('persists a note mute per account and removes it from storage when unmuted', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(document.createElement('div'))
  const event: NostrEvent = {
    kind: kinds.LongFormArticle,
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 100,
    tags: [['d', 'article']],
    content: '',
    sig: 'c'.repeat(128)
  }
  const coordinate = `${event.kind}:${event.pubkey}:article`
  let result: ReturnType<typeof useMutedNoteNotifications>
  function TestComponent() {
    result = useMutedNoteNotifications()
    return null
  }
  let store = createStore()
  const render = () => root.render(createElement(Provider, { store }, createElement(TestComponent)))
  const initialAccount = account.pubkey

  try {
    await act(render)
    expect(result!.mutedNoteKeys.size).toBe(0)
    await act(() => result!.setNoteMuted(event, true))
    expect(result!.mutedNoteKeys).toEqual(new Set([coordinate, event.id]))

    account.pubkey = '2'.repeat(64)
    await act(render)
    expect(result!.mutedNoteKeys.size).toBe(0)

    account.pubkey = initialAccount
    store = createStore()
    await act(render)
    expect(result!.mutedNoteKeys).toEqual(new Set([coordinate, event.id]))

    await act(() => result!.setNoteMuted({ ...event, id: 'd'.repeat(64) }, false))
    expect(result!.mutedNoteKeys.size).toBe(0)
    expect(JSON.parse(localStorage.getItem(StorageKey.MUTED_NOTE_NOTIFICATIONS)!)).toEqual({
      [initialAccount]: {}
    })
  } finally {
    await act(() => root.unmount())
    account.pubkey = initialAccount
    localStorage.removeItem(StorageKey.MUTED_NOTE_NOTIFICATIONS)
  }
})
