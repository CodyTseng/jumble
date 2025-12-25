import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import {
  getEventKey,
  getKeyFromTag,
  getParentTag,
  getReplaceableCoordinateFromEvent,
  getRootTag,
  isProtectedEvent,
  isReplaceableEvent,
  isReplyNoteEvent
} from '@/lib/event'
import { generateBech32IdFromETag } from '@/lib/tag'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Filter, kinds, NostrEvent } from 'nostr-tools'

type TRootInfo =
  | { type: 'E'; id: string; pubkey: string }
  | { type: 'A'; id: string; pubkey: string; relay?: string }
  | { type: 'I'; id: string }

class ThreadService {
  static instance: ThreadService

  private rootInfoCache = new Map<string, Promise<TRootInfo | undefined>>()
  private subscriptions = new Map<
    string,
    {
      promise: Promise<{
        closer: () => void
        timelineKey: string
      }>
      count: number
      until?: number
    }
  >()
  private threadMap = new Map<string, NostrEvent[]>()
  private processedReplyKeys = new Set<string>()
  private parentKeyMap = new Map<string, string>()
  private descendantCache = new Map<string, Map<string, NostrEvent[]>>()

  private threadListeners = new Map<string, Set<() => void>>()
  private allDescendantThreadsListeners = new Map<string, Set<() => void>>()
  private readonly EMPTY_ARRAY: NostrEvent[] = []
  private readonly EMPTY_MAP: Map<string, NostrEvent[]> = new Map()

  constructor() {
    if (!ThreadService.instance) {
      ThreadService.instance = this
    }
    return ThreadService.instance
  }

  async subscribe(stuff: NostrEvent | string, limit = 100) {
    const { event } = this.resolveStuff(stuff)
    const rootInfo = await this.parseRootInfo(stuff)
    if (!rootInfo) return

    const subscription = this.subscriptions.get(rootInfo.id)
    if (subscription) {
      subscription.count += 1
      return
    }

    const _subscribe = async () => {
      let relayUrls: string[] = []
      const rootPubkey = (rootInfo as { pubkey?: string }).pubkey ?? event?.pubkey
      if (rootPubkey) {
        const relayList = await client.fetchRelayList(rootPubkey)
        relayUrls = relayList.read
      }
      relayUrls = relayUrls.concat(BIG_RELAY_URLS).slice(0, 4)

      // If current event is protected, we can assume its replies are also protected and stored on the same relays
      if (event && isProtectedEvent(event)) {
        const seenOn = client.getSeenEventRelayUrls(event.id)
        relayUrls.concat(...seenOn)
      }

      const filters: (Omit<Filter, 'since' | 'until'> & {
        limit: number
      })[] = []
      if (rootInfo.type === 'E') {
        filters.push({
          '#e': [rootInfo.id],
          kinds: [kinds.ShortTextNote],
          limit
        })
        if (event?.kind !== kinds.ShortTextNote) {
          filters.push({
            '#E': [rootInfo.id],
            kinds: [ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT],
            limit
          })
        }
      } else if (rootInfo.type === 'A') {
        filters.push(
          {
            '#a': [rootInfo.id],
            kinds: [kinds.ShortTextNote],
            limit
          },
          {
            '#A': [rootInfo.id],
            kinds: [ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT],
            limit
          }
        )
        if (rootInfo.relay) {
          relayUrls.push(rootInfo.relay)
        }
      } else {
        filters.push({
          '#I': [rootInfo.id],
          kinds: [ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT],
          limit
        })
      }
      const { closer, timelineKey } = await client.subscribeTimeline(
        filters.map((filter) => ({
          urls: relayUrls.slice(0, 8),
          filter
        })),
        {
          onEvents: (events, eosed) => {
            if (events.length > 0) {
              this.addRepliesToThread(events)
            }
            if (eosed) {
              const subscription = this.subscriptions.get(rootInfo.id)
              if (subscription) {
                subscription.until =
                  events.length >= limit ? events[events.length - 1].created_at - 1 : undefined
              }
            }
          },
          onNew: (evt) => {
            this.addRepliesToThread([evt])
          }
        }
      )
      return { closer, timelineKey }
    }

    const promise = _subscribe()
    this.subscriptions.set(rootInfo.id, {
      promise,
      count: 1,
      until: dayjs().unix()
    })
    await promise
  }

  async unsubscribe(stuff: NostrEvent | string) {
    const rootInfo = await this.parseRootInfo(stuff)
    if (!rootInfo) return

    const subscription = this.subscriptions.get(rootInfo.id)
    if (!subscription) return

    setTimeout(() => {
      subscription.count -= 1
      if (subscription.count <= 0) {
        this.subscriptions.delete(rootInfo.id)
        subscription.promise.then(({ closer }) => {
          closer()
        })
      }
    }, 2000)
  }

  async loadMore(stuff: NostrEvent | string, limit = 100): Promise<boolean> {
    const rootInfo = await this.parseRootInfo(stuff)
    if (!rootInfo) return false

    const subscription = this.subscriptions.get(rootInfo.id)
    if (!subscription || !subscription.until) return false

    const { timelineKey } = await subscription.promise
    console.log('loadMore', { timelineKey, until: subscription.until })
    if (!timelineKey) return false

    const events = await client.loadMoreTimeline(timelineKey, subscription.until, limit)
    this.addRepliesToThread(events)

    const { event } = this.resolveStuff(stuff)
    let newUntil = events.length ? events[events.length - 1].created_at - 1 : undefined
    if (newUntil && event && newUntil < event.created_at) {
      newUntil = undefined
    }
    subscription.until = newUntil
    return !!newUntil
  }

  addRepliesToThread(replies: NostrEvent[]) {
    const newReplyEventMap = new Map<string, NostrEvent[]>()
    replies.forEach((reply) => {
      const key = getEventKey(reply)
      if (this.processedReplyKeys.has(key)) return
      this.processedReplyKeys.add(key)

      if (!isReplyNoteEvent(reply)) return

      const parentTag = getParentTag(reply)
      if (parentTag) {
        const parentKey = getKeyFromTag(parentTag.tag)
        if (parentKey) {
          const thread = newReplyEventMap.get(parentKey) ?? []
          thread.push(reply)
          newReplyEventMap.set(parentKey, thread)
          this.parentKeyMap.set(key, parentKey)
        }
      }
    })
    if (newReplyEventMap.size === 0) return

    for (const [key, newReplyEvents] of newReplyEventMap.entries()) {
      const thread = this.threadMap.get(key) ?? []
      thread.push(...newReplyEvents)
      this.threadMap.set(key, thread)
    }

    this.descendantCache.clear()
    for (const key of newReplyEventMap.keys()) {
      this.notifyThreadUpdate(key)
      this.notifyAllDescendantThreadsUpdate(key)
    }
  }

  getThread(stuffKey: string): NostrEvent[] {
    return this.threadMap.get(stuffKey) ?? this.EMPTY_ARRAY
  }

  getAllDescendantThreads(stuffKey: string): Map<string, NostrEvent[]> {
    const cached = this.descendantCache.get(stuffKey)
    if (cached) return cached

    const build = () => {
      const thread = this.threadMap.get(stuffKey)
      if (!thread || thread.length === 0) {
        return this.EMPTY_MAP
      }

      const result = new Map<string, NostrEvent[]>()
      const keys: string[] = [stuffKey]
      while (keys.length > 0) {
        const key = keys.pop()!
        const thread = this.threadMap.get(key) ?? []
        if (thread.length > 0) {
          result.set(key, thread)
          thread.forEach((reply) => {
            const replyKey = getEventKey(reply)
            keys.push(replyKey)
          })
        }
      }
      return result
    }

    const allThreads = build()
    this.descendantCache.set(stuffKey, allThreads)
    return allThreads
  }

  listenThread(key: string, callback: () => void) {
    let set = this.threadListeners.get(key)
    if (!set) {
      set = new Set()
      this.threadListeners.set(key, set)
    }
    set.add(callback)
    return () => {
      set?.delete(callback)
      if (set?.size === 0) this.threadListeners.delete(key)
    }
  }

  private notifyThreadUpdate(key: string) {
    const set = this.threadListeners.get(key)
    if (set) {
      set.forEach((cb) => cb())
    }
  }

  listenAllDescendantThreads(key: string, callback: () => void) {
    let set = this.allDescendantThreadsListeners.get(key)
    if (!set) {
      set = new Set()
      this.allDescendantThreadsListeners.set(key, set)
    }
    set.add(callback)
    return () => {
      set?.delete(callback)
      if (set?.size === 0) this.allDescendantThreadsListeners.delete(key)
    }
  }

  private notifyAllDescendantThreadsUpdate(key: string) {
    const notify = (_key: string) => {
      const set = this.allDescendantThreadsListeners.get(_key)
      if (set) {
        set.forEach((cb) => cb())
      }
    }

    notify(key)
    let parentKey = this.parentKeyMap.get(key)
    while (parentKey) {
      notify(parentKey)
      parentKey = this.parentKeyMap.get(parentKey)
    }
  }

  private async parseRootInfo(stuff: NostrEvent | string): Promise<TRootInfo | undefined> {
    const { event, externalContent } = this.resolveStuff(stuff)
    if (!event && !externalContent) return

    const cacheKey = event ? getEventKey(event) : externalContent!
    const cache = this.rootInfoCache.get(cacheKey)
    if (cache) return cache

    const _parseRootInfo = async (): Promise<TRootInfo | undefined> => {
      let root: TRootInfo = event
        ? isReplaceableEvent(event.kind)
          ? {
              type: 'A',
              id: getReplaceableCoordinateFromEvent(event),
              pubkey: event.pubkey,
              relay: client.getEventHint(event.id)
            }
          : { type: 'E', id: event.id, pubkey: event.pubkey }
        : { type: 'I', id: externalContent! }

      const rootTag = getRootTag(event)
      if (rootTag?.type === 'e') {
        const [, rootEventHexId, , , rootEventPubkey] = rootTag.tag
        if (rootEventHexId && rootEventPubkey) {
          root = { type: 'E', id: rootEventHexId, pubkey: rootEventPubkey }
        } else {
          const rootEventId = generateBech32IdFromETag(rootTag.tag)
          if (rootEventId) {
            const rootEvent = await client.fetchEvent(rootEventId)
            if (rootEvent) {
              root = { type: 'E', id: rootEvent.id, pubkey: rootEvent.pubkey }
            }
          }
        }
      } else if (rootTag?.type === 'a') {
        const [, coordinate, relay] = rootTag.tag
        const [, pubkey] = coordinate.split(':')
        root = { type: 'A', id: coordinate, pubkey, relay }
      } else if (rootTag?.type === 'i') {
        root = { type: 'I', id: rootTag.tag[1] }
      }
      return root
    }

    const promise = _parseRootInfo()
    this.rootInfoCache.set(cacheKey, promise)
    return promise
  }

  private resolveStuff(stuff: NostrEvent | string) {
    return typeof stuff === 'string'
      ? { event: undefined, externalContent: stuff, stuffKey: stuff }
      : { event: stuff, externalContent: undefined, stuffKey: getEventKey(stuff) }
  }
}

const instance = new ThreadService()

export default instance
