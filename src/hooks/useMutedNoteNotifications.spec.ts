// @vitest-environment jsdom

import { StorageKey } from '@/constants'
import { createStore, Provider } from 'jotai'
import { kinds, type NostrEvent } from 'nostr-tools'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMutedNoteNotifications } from './useMutedNoteNotifications'

const account = vi.hoisted(() => ({ pubkey: '1'.repeat(64) }))
vi.mock('@/providers/NostrProvider', () => ({ useNostr: () => account }))

const initialAccount = account.pubkey
const otherAccount = '2'.repeat(64)
const article: NostrEvent = {
  kind: kinds.LongFormArticle,
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  created_at: 100,
  tags: [['d', 'article']],
  content: '',
  sig: 'c'.repeat(128)
}
let root: Root
let store: ReturnType<typeof createStore>
let result: ReturnType<typeof useMutedNoteNotifications>

function TestComponent() {
  result = useMutedNoteNotifications()
  return null
}

const render = () => root.render(createElement(Provider, { store }, createElement(TestComponent)))
const storedMutes = () => JSON.parse(localStorage.getItem(StorageKey.MUTED_NOTE_NOTIFICATIONS)!)

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  account.pubkey = initialAccount
  root = createRoot(document.createElement('div'))
  store = createStore()
})

afterEach(async () => {
  await act(() => root.unmount())
  localStorage.removeItem(StorageKey.MUTED_NOTE_NOTIFICATIONS)
  vi.unstubAllGlobals()
})

it('persists a note mute per account and removes it from storage when unmuted', async () => {
  const coordinate = `${article.kind}:${article.pubkey}:article`
  await act(render)
  expect(result.mutedNoteKeys.size).toBe(0)
  await act(() => result.setNoteMuted(article, true))
  expect(result.mutedNoteKeys).toEqual(new Set([coordinate]))
  expect(storedMutes()).toEqual({ [initialAccount]: { [coordinate]: coordinate } })

  account.pubkey = otherAccount
  await act(render)
  expect(result.mutedNoteKeys.size).toBe(0)

  localStorage.setItem(
    StorageKey.MUTED_NOTE_NOTIFICATIONS,
    JSON.stringify({ [initialAccount]: { [coordinate]: article.id } })
  )
  account.pubkey = initialAccount
  store = createStore()
  await act(render)
  expect(result.mutedNoteKeys).toEqual(new Set([coordinate]))

  await act(() => result.setNoteMuted({ ...article, id: 'd'.repeat(64) }, false))
  expect(result.mutedNoteKeys.size).toBe(0)
  expect(storedMutes()).toEqual({ [initialAccount]: {} })
})

it('limits each account to the last 1000 additions and keeps the original position of a duplicate', async () => {
  const ids = Array.from({ length: 1002 }, (_, index) => index.toString(16).padStart(64, '0'))
  const oldestRetained = ids[1]
  const newId = ids[1001]
  const otherMute = { [ids[0]]: ids[0] }
  localStorage.setItem(
    StorageKey.MUTED_NOTE_NOTIFICATIONS,
    JSON.stringify({
      [initialAccount]: Object.fromEntries(ids.slice(0, 1001).map((id) => [id, id])),
      [otherAccount]: otherMute
    })
  )
  const note = (id: string) => ({ ...article, kind: kinds.ShortTextNote, id, tags: [] })

  await act(render)
  expect([...result.mutedNoteKeys]).toEqual(ids.slice(1, 1001))

  await act(() => result.setNoteMuted(note(oldestRetained), true))
  expect(Object.keys(storedMutes()[initialAccount])).toEqual(ids.slice(1, 1001))
  await act(() => result.setNoteMuted(note(newId), true))
  expect([...result.mutedNoteKeys]).toEqual(ids.slice(2))
  expect(Object.keys(storedMutes()[initialAccount])).toEqual(ids.slice(2))
  expect(storedMutes()[otherAccount]).toEqual(otherMute)

  await act(() => result.setNoteMuted(note(newId), false))
  expect([...result.mutedNoteKeys]).toEqual(ids.slice(2, 1001))
})
