import { ApplicationDataKey } from '@/constants'
import { Event, Filter, kinds } from 'nostr-tools'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { describe, expect, it, vi } from 'vitest'
import { createSelfEventSync } from './self-event-sync'

// Public test fixtures only: these keys are never sent to a real relay.
const secretKey = new Uint8Array(32).fill(1)
const otherSecretKey = new Uint8Array(32).fill(2)
const pubkey = getPublicKey(secretKey)

function event(
  kind: number,
  created_at: number,
  { tags = [], content = '', key = secretKey } = {} as {
    tags?: string[][]
    content?: string
    key?: Uint8Array
  }
): Event {
  return finalizeEvent({ kind, created_at, tags, content }, key)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function harness(persistEvent: (event: Event) => Promise<Event> = async (event) => event) {
  const subscriptions: {
    urls: string[]
    filter: Filter
    handlers: { onevent: (event: Event) => void }
    close: ReturnType<typeof vi.fn>
  }[] = []
  const subscribe = vi.fn(
    (urls: string[], filter: Filter, handlers: { onevent: (event: Event) => void }) => {
      const close = vi.fn()
      subscriptions.push({ urls, filter, handlers, close })
      return { close }
    }
  )
  const persist = vi.fn(persistEvent)
  const apply = vi.fn()
  const onOtherEvent = vi.fn()
  const onError = vi.fn()
  const sync = createSelfEventSync({
    pubkey,
    since: 100,
    relays: ['wss://relay.example'],
    subscribe,
    persist,
    apply,
    onOtherEvent,
    onError
  })
  return { sync, subscriptions, subscribe, persist, apply, onOtherEvent, onError }
}

describe('self event synchronization', () => {
  it('listens to every self-authored event on one persistent stream', async () => {
    const { sync, subscriptions, persist, apply, onOtherEvent } = harness()
    const contacts = event(kinds.Contacts, 101, { tags: [['p', 'ab'.repeat(32)]] })
    const reaction = event(kinds.Reaction, 102, { tags: [['e', 'cd'.repeat(32)]] })
    expect(subscriptions).toHaveLength(1)
    expect(subscriptions[0].filter).toEqual({ authors: [pubkey], since: 100 })

    subscriptions[0].handlers.onevent(contacts)
    await sync.receive(reaction)

    expect(persist).toHaveBeenCalledWith(contacts)
    expect(apply).toHaveBeenCalledWith(contacts)
    expect(onOtherEvent).toHaveBeenCalledWith(reaction)
    expect(subscriptions[0].close).not.toHaveBeenCalled()
    sync.dispose()
  })

  it('applies an event already persisted by a sibling tab to this page', async () => {
    const contacts = event(kinds.Contacts, 101, { tags: [['p', 'ab'.repeat(32)]] })
    // IndexedDB can already contain this exact event while this page's React state is stale.
    const { sync, apply, persist } = harness(async () => contacts)
    await sync.receive(contacts)
    expect(persist).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledExactlyOnceWith(contacts)
    sync.dispose()
  })

  it('uses the newer persisted winner when a sibling tab won the storage race', async () => {
    const received = event(kinds.Contacts, 101)
    const stored = event(kinds.Contacts, 102, { tags: [['p', 'ab'.repeat(32)]] })
    const { sync, apply, persist } = harness(async () => stored)

    await sync.receive(received)
    await sync.receive(stored)

    expect(apply).toHaveBeenCalledExactlyOnceWith(stored)
    expect(persist).toHaveBeenCalledOnce()
    sync.dispose()
  })

  it('cannot regress following state after an older event or duplicate relay echo', async () => {
    const followed = event(kinds.Contacts, 101, { tags: [['p', 'ab'.repeat(32)]] })
    const unfollowed = event(kinds.Contacts, 102)
    const { sync, apply, persist } = harness()

    await sync.receive(unfollowed)
    await sync.receive(followed)
    await sync.receive(unfollowed)

    expect(apply).toHaveBeenCalledExactlyOnceWith(unfollowed)
    expect(persist).toHaveBeenCalledOnce()
    sync.dispose()
  })

  it('serializes pending writes so an earlier callback cannot overwrite a later update', async () => {
    const first = event(kinds.Contacts, 101)
    const latest = event(kinds.Contacts, 102, { tags: [['p', 'ab'.repeat(32)]] })
    const writing = deferred<Event>()
    const started = deferred<void>()
    const { sync, apply, persist } = harness(async (incoming) => {
      if (incoming.id === first.id) {
        started.resolve()
        return writing.promise
      }
      return incoming
    })

    const firstReceive = sync.receive(first)
    await started.promise
    const lastReceive = sync.receive(latest)
    expect(persist).toHaveBeenCalledOnce()
    writing.resolve(first)
    await Promise.all([firstReceive, lastReceive])

    expect(apply.mock.calls.map(([value]) => value.id)).toEqual([first.id, latest.id])
    sync.dispose()
  })

  it('keeps different metadata kinds and addressable list coordinates independent', async () => {
    const contacts = event(kinds.Contacts, 200)
    const profile = event(kinds.Metadata, 101, { content: '{"name":"New name"}' })
    const firstEmojiSet = event(kinds.Emojisets, 300, { tags: [['d', 'first']] })
    const secondEmojiSet = event(kinds.Emojisets, 101, { tags: [['d', 'second']] })
    const { sync, apply } = harness()
    for (const incoming of [contacts, profile, firstEmojiSet, secondEmojiSet]) {
      await sync.receive(incoming)
    }
    expect(apply.mock.calls.map(([value]) => value.id)).toEqual([
      contacts.id,
      profile.id,
      firstEmojiSet.id,
      secondEmojiSet.id
    ])
    sync.dispose()
  })

  it('converges on the lower event ID when equal-time events arrive in either order', async () => {
    const candidates = [
      event(kinds.Contacts, 101, { content: 'first' }),
      event(kinds.Contacts, 101, { content: 'second' })
    ].sort((left, right) => left.id.localeCompare(right.id))
    const [winner, loser] = candidates
    for (const order of [
      [loser, winner],
      [winner, loser]
    ]) {
      const { sync, apply } = harness()
      for (const incoming of order) await sync.receive(incoming)
      expect(apply).toHaveBeenLastCalledWith(winner)
      sync.dispose()
    }
  })

  it('routes notification seen-at metadata without treating other app data as its state', async () => {
    const seen = event(kinds.Application, 101, {
      tags: [['d', ApplicationDataKey.NOTIFICATIONS_SEEN_AT]]
    })
    const otherApp = event(kinds.Application, 102, { tags: [['d', 'another_application']] })
    const { sync, persist, apply, onOtherEvent } = harness()
    await sync.receive(seen)
    await sync.receive(otherApp)
    expect(persist).toHaveBeenCalledExactlyOnceWith(seen)
    expect(apply).toHaveBeenCalledExactlyOnceWith(seen)
    expect(onOtherEvent).toHaveBeenCalledExactlyOnceWith(otherApp)
    sync.dispose()
  })

  it('ignores another account even when delivered through the subscription callback', async () => {
    const foreignContacts = event(kinds.Contacts, 101, { key: otherSecretKey })
    const foreignReaction = event(kinds.Reaction, 102, { key: otherSecretKey })
    const { sync, subscriptions, persist, apply, onOtherEvent } = harness()
    subscriptions[0].handlers.onevent(foreignContacts)
    await sync.receive(foreignReaction)
    expect(persist).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
    expect(onOtherEvent).not.toHaveBeenCalled()
    sync.dispose()
  })

  it('disposal during persistence prevents state application and queued work', async () => {
    const first = event(kinds.Contacts, 101)
    const queued = event(kinds.Metadata, 102)
    const writing = deferred<Event>()
    const started = deferred<void>()
    const { sync, subscriptions, persist, apply, subscribe } = harness(async () => {
      started.resolve()
      return writing.promise
    })
    const pending = sync.receive(first)
    await started.promise
    const pendingQueued = sync.receive(queued)

    sync.dispose()
    sync.setRelays(['wss://another.example'])
    writing.resolve(first)
    await Promise.all([pending, pendingQueued])
    subscriptions[0].handlers.onevent(queued)
    await sync.receive(queued)

    expect(apply).not.toHaveBeenCalled()
    expect(persist).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledOnce()
    expect(subscriptions[0].close).toHaveBeenCalledOnce()
  })

  it('continues receiving after a storage failure instead of poisoning the queue', async () => {
    const failed = event(kinds.Contacts, 101)
    const next = event(kinds.Contacts, 102)
    const failure = new Error('temporary storage failure')
    const { sync, apply } = harness(async (incoming) => {
      if (incoming.id === failed.id) throw failure
      return incoming
    })
    await expect(sync.receive(failed)).rejects.toBe(failure)
    await sync.receive(next)
    expect(apply).toHaveBeenCalledExactlyOnceWith(next)
    sync.dispose()
  })

  it('can retry a persisted event when applying it to page state fails', async () => {
    const incoming = event(kinds.Contacts, 101)
    const failure = new Error('temporary state application failure')
    const rendered: Event[] = []
    const { sync, apply } = harness()
    apply
      .mockImplementationOnce(() => {
        throw failure
      })
      .mockImplementation((value: Event) => rendered.push(value))

    await expect(sync.receive(incoming)).rejects.toBe(failure)
    await sync.receive(incoming)

    expect(rendered).toEqual([incoming])
    expect(apply).toHaveBeenCalledTimes(2)
    sync.dispose()
  })

  it('reports a relay callback failure and allows a subsequent retry of that event', async () => {
    const incoming = event(kinds.Contacts, 101)
    const failure = new Error('temporary storage failure')
    const { sync, subscriptions, persist, apply, onError } = harness()
    persist.mockRejectedValueOnce(failure)
    subscriptions[0].handlers.onevent(incoming)

    await vi.waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith(failure))
    await sync.receive(incoming)
    expect(apply).toHaveBeenCalledExactlyOnceWith(incoming)
    sync.dispose()
  })

  it('ignores late callbacks from a replaced stream while accepting its replacement', async () => {
    const incoming = event(kinds.Contacts, 101)
    const barrier = event(kinds.Metadata, 102, { key: otherSecretKey })
    const { sync, subscriptions, persist, apply } = harness()
    sync.setRelays(['wss://replacement.example'])

    subscriptions[0].handlers.onevent(incoming)
    await sync.receive(barrier)
    expect(persist).not.toHaveBeenCalled()

    subscriptions[1].handlers.onevent(incoming)
    await sync.receive(barrier)
    expect(apply).toHaveBeenCalledExactlyOnceWith(incoming)
    sync.dispose()
  })

  it('does not reopen unchanged relay sets and retains its catch-up boundary on real changes', () => {
    const { sync, subscriptions } = harness()
    sync.setRelays(['wss://relay.example/', 'wss://relay.example'])
    expect(subscriptions).toHaveLength(1)

    sync.setRelays(['wss://two.example', 'wss://one.example', 'wss://two.example/'])
    expect(subscriptions).toHaveLength(2)
    expect(subscriptions[0].close).toHaveBeenCalledOnce()
    expect(new Set(subscriptions[1].urls)).toEqual(
      new Set(['wss://one.example/', 'wss://two.example/'])
    )
    expect(subscriptions[1].filter).toEqual({ authors: [pubkey], since: 100 })

    sync.setRelays(['wss://one.example/', 'wss://two.example/'])
    expect(subscriptions).toHaveLength(2)
    sync.dispose()
    sync.dispose()
    expect(subscriptions[1].close).toHaveBeenCalledOnce()
  })
})
