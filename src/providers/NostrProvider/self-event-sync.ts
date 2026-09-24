import { ApplicationDataKey, ExtendedKind } from '@/constants'
import { compareEvents } from '@/lib/event-order'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import { Event, Filter, kinds } from 'nostr-tools'

export const SELF_EVENT_KINDS = [
  kinds.Metadata,
  kinds.RelayList,
  kinds.Contacts,
  kinds.Mutelist,
  kinds.BookmarkList,
  ExtendedKind.FAVORITE_RELAYS,
  ExtendedKind.BLOSSOM_SERVER_LIST,
  kinds.UserEmojiList,
  kinds.Pinlist,
  ExtendedKind.PINNED_USERS,
  ExtendedKind.DM_RELAYS,
  ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT,
  kinds.Emojisets,
  kinds.Relaysets
]

export function isSelfMetadataEvent(event: Event) {
  return (
    SELF_EVENT_KINDS.includes(event.kind) ||
    (event.kind === kinds.Application &&
      event.tags.find(([name]) => name === 'd')?.[1] === ApplicationDataKey.NOTIFICATIONS_SEEN_AT)
  )
}

type SelfEventSyncOptions = {
  pubkey: string
  since: number
  relays: string[]
  subscribe: (
    urls: string[],
    filter: Filter,
    handlers: { onevent: (event: Event) => void }
  ) => { close: () => void }
  persist: (event: Event) => Promise<Event>
  apply: (event: Event) => void
  onOtherEvent?: (event: Event) => void
  onError?: (error: unknown) => void
}

/** One account's snapshot, local writes and live events share the same ordering. */
export function createSelfEventSync(options: SelfEventSyncOptions) {
  let disposed = false
  let pending = Promise.resolve()
  let subscription: { close: () => void } | undefined
  let relayKey: string | undefined
  let subscriptionGeneration = 0
  const latest = new Map<string, Event>()

  const receive = (event: Event): Promise<void> => {
    const task = pending.then(async () => {
      if (disposed || event.pubkey !== options.pubkey) return
      if (!isSelfMetadataEvent(event)) {
        options.onOtherEvent?.(event)
        return
      }

      const identifier = kinds.isAddressableKind(event.kind)
        ? (event.tags.find(([name]) => name === 'd')?.[1] ?? '')
        : ''
      const key = `${event.kind}:${identifier}`
      const previous = latest.get(key)
      if (previous && compareEvents(event, previous) <= 0) return

      // Another tab may already have persisted this event (or a newer one).
      // The returned winner still needs to be applied to this tab's memory.
      const retained = await options.persist(event)
      if (disposed || retained.pubkey !== options.pubkey) return
      if (previous && compareEvents(retained, previous) <= 0) return
      options.apply(retained)
      latest.set(key, retained)
    })
    // A failed write must not poison subsequent events in the queue.
    pending = task.catch(() => {})
    return task
  }

  const setRelays = (urls: string[]) => {
    if (disposed) return
    const relays = Array.from(
      new Set(urls.filter(isWebsocketUrl).map(normalizeUrl).filter(Boolean))
    ).sort()
    const nextKey = JSON.stringify(relays)
    if (nextKey === relayKey) return
    relayKey = nextKey
    const generation = ++subscriptionGeneration
    subscription?.close()
    subscription = options.subscribe(
      relays,
      // Retain the initial boundary when relays change, including while the
      // initial snapshot loads, so closing/reopening cannot leave a time gap.
      { authors: [options.pubkey], since: options.since },
      {
        onevent: (event) => {
          if (disposed || generation !== subscriptionGeneration) return
          void receive(event).catch(options.onError ?? console.error)
        }
      }
    )
  }

  setRelays(options.relays)
  return {
    receive,
    setRelays,
    dispose: () => {
      if (disposed) return
      disposed = true
      subscriptionGeneration++
      subscription?.close()
    }
  }
}
