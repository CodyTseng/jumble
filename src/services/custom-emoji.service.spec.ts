import { getDefaultStore } from 'jotai'
import { Event, kinds } from 'nostr-tools'
import { finalizeEvent } from 'nostr-tools/pure'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import customEmojiService, { customEmojiCollectionsAtom } from './custom-emoji.service'

const client = vi.hoisted(() => ({ fetchEmojiSetEvents: vi.fn() }))
vi.mock('@/services/client.service', () => ({ default: client }))
vi.mock('@/services/recent-emoji.service', () => ({ default: { getRecent: () => [] } }))
vi.mock('@/services/local-storage.service', () => ({ default: {} }))
vi.mock('@/services/media-upload.service', () => ({ default: {} }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function emojiFixtures(name: string, keyByte: number) {
  const key = new Uint8Array(32).fill(keyByte)
  const pack = finalizeEvent(
    {
      kind: kinds.Emojisets,
      created_at: keyByte,
      content: '',
      tags: [
        ['d', name],
        ['title', name],
        ['emoji', name, `https://emoji.example/${name}.png`]
      ]
    },
    key
  )
  const list = finalizeEvent(
    {
      kind: kinds.UserEmojiList,
      created_at: keyByte,
      content: '',
      tags: [
        ['a', `${pack.kind}:${pack.pubkey}:${name}`],
        ['emoji', `${name}single`, `https://emoji.example/${name}-single.png`]
      ]
    },
    key
  )
  return { list, pack }
}

describe('custom emoji account initialization', () => {
  beforeEach(async () => {
    client.fetchEmojiSetEvents.mockReset()
    await customEmojiService.init(null)
  })

  it('keeps the current account collections and search when an old account fetch finishes late', async () => {
    const oldAccount = emojiFixtures('legacy', 1)
    const currentAccount = emojiFixtures('current', 2)
    const oldFetch = deferred<Event[]>()
    const oldFetchStarted = deferred<void>()
    client.fetchEmojiSetEvents
      .mockImplementationOnce(() => {
        oldFetchStarted.resolve()
        return oldFetch.promise
      })
      .mockResolvedValueOnce([currentAccount.pack])

    const oldInitialization = customEmojiService.init(oldAccount.list)
    await oldFetchStarted.promise
    await customEmojiService.init(currentAccount.list)
    const currentCollections = getDefaultStore().get(customEmojiCollectionsAtom)
    expect(currentCollections.packs.map((pack) => pack.title)).toEqual(['current'])

    oldFetch.resolve([oldAccount.pack])
    await oldInitialization

    expect(getDefaultStore().get(customEmojiCollectionsAtom)).toBe(currentCollections)
    expect(customEmojiService.getEmojiPacks()).toEqual(currentCollections.packs)
    expect(customEmojiService.getStandaloneEmojis()).toEqual(currentCollections.standalone)
    expect((await customEmojiService.searchEmojis('')).map((emoji) => emoji.shortcode)).toEqual(
      expect.arrayContaining(['current', 'currentsingle'])
    )
    expect(await customEmojiService.searchEmojis('legacy')).toEqual([])
    expect(await customEmojiService.searchEmojis('current')).toHaveLength(2)
  })

  it('does not repopulate collections or search after logout cancels a pending fetch', async () => {
    const account = emojiFixtures('legacy', 1)
    const pendingFetch = deferred<Event[]>()
    const fetchStarted = deferred<void>()
    client.fetchEmojiSetEvents.mockImplementationOnce(() => {
      fetchStarted.resolve()
      return pendingFetch.promise
    })

    const initialization = customEmojiService.init(account.list)
    await fetchStarted.promise
    await customEmojiService.init(null)
    const loggedOutCollections = getDefaultStore().get(customEmojiCollectionsAtom)
    expect(loggedOutCollections).toMatchObject({ standalone: [], packs: [] })

    pendingFetch.resolve([account.pack])
    await initialization

    expect(getDefaultStore().get(customEmojiCollectionsAtom)).toBe(loggedOutCollections)
    expect(customEmojiService.getEmojiPacks()).toEqual([])
    expect(customEmojiService.getStandaloneEmojis()).toEqual([])
    expect(await customEmojiService.searchEmojis('')).toEqual([])
    expect(await customEmojiService.searchEmojis('legacy')).toEqual([])
  })
})
