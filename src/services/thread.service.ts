import { ExtendedKind } from '@/constants'
import { BoundedMap } from '@/lib/bounded-map'
import {
  getEventKey,
  getEventAuthorPubkey,
  getKeyFromTag,
  getParentTag,
  getReplaceableCoordinateFromEvent,
  getRootTag,
  isProtectedEvent,
  isReplaceableEvent,
  isReplyNoteEvent
} from '@/lib/event'
import { getDefaultRelayUrls } from '@/lib/relay'
import { generateBech32IdFromETag } from '@/lib/tag'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import lightning from '@/services/lightning.service'
import dayjs from 'dayjs'
import { Filter, kinds, NostrEvent } from 'nostr-tools'

type TRootInfo =
  | { type: 'E'; id: string; logicalPubkey: string }
  | { type: 'A'; id: string; logicalPubkey: string; relay?: string }
  | { type: 'I'; id: string }

class ThreadService {
  static instance: ThreadService

  private rootInfoCache = new BoundedMap<string, Promise<TRootInfo | undefined>>({
    maxSize: 2_000
  })
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
  // The topology is cheap to retain and preserves replies discovered while
  // browsing. Event bodies are resolved by ClientService when the UI needs them.
  private threadMap = new Map<string, string[]>()
  private parentKeyMap = new Map<string, string>()
  private descendantCache = new BoundedMap<string, Map<string, string[]>>({ maxSize: 500 })
  private ancestorChainCache = new BoundedMap<string, string[]>({ maxSize: 2_000 })

  private threadListeners = new Map<string, Set<() => void>>()
  private allDescendantThreadsListeners = new Map<string, Set<() => void>>()
  private readonly EMPTY_ARRAY: string[] = []
  private readonly EMPTY_STRING_ARRAY: string[] = []
  private readonly EMPTY_MAP: Map<string, string[]> = new Map()

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
      const logicalPubkey = rootInfo.type === 'I' ? undefined : rootInfo.logicalPubkey
      if (logicalPubkey) {
        const relayList = await client.fetchRelayList(logicalPubkey)
        relayUrls = relayList.read
      }
      relayUrls = relayUrls.concat(getDefaultRelayUrls()).slice(0, 4)

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

      const knownReplyIds = this.getDescendantReplyIds(rootInfo.id)
      let storedReplies: NostrEvent[]
      if (knownReplyIds.length > 0) {
        const storedItems = await indexedDb.getEventsByIds(knownReplyIds)
        storedItems.forEach(({ event, relays }) => {
          client.trackEventExternalSeenOn(event.id, relays)
        })
        storedReplies = storedItems.map(({ event }) => event)
      } else {
        storedReplies = (
          await Promise.all(
            filters.map((filter) => client.getEventsFromIndexed({ ...filter, limit: undefined }))
          )
        ).flat()
      }
      this.addRepliesToThread(storedReplies, false)

      let resolve: () => void
      const _promise = new Promise<void>((res) => {
        resolve = res
      })
      const { closer, timelineKey } = await client.subscribeTimeline(
        filters.map((filter) => ({
          urls: relayUrls.slice(0, 8),
          filter
        })),
        {
          onEvents: (events, eosed) => {
            if (events.length > 0) {
              this.addRepliesToThread(events, false)
            }
            if (eosed) {
              const subscription = this.subscriptions.get(rootInfo.id)
              if (subscription && events.length > 0) {
                subscription.until = events[events.length - 1].created_at - 1
              }
              resolve()
            }
          },
          onNew: (evt) => {
            this.addRepliesToThread([evt], false)
          }
        },
        { needSaveToDb: true }
      )
      await _promise
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
    if (!subscription) return false

    const { timelineKey } = await subscription.promise
    if (!timelineKey) return false

    if (!subscription.until) return false

    const events = await client.loadMoreTimeline(timelineKey, subscription.until, limit)
    this.addRepliesToThread(events)

    const { event } = this.resolveStuff(stuff)
    let newUntil = events.length ? events[events.length - 1].created_at - 1 : undefined
    if (newUntil && event && !isReplaceableEvent(event.kind) && newUntil < event.created_at) {
      newUntil = undefined
    }
    subscription.until = newUntil
    return !!newUntil
  }

  addRepliesToThread(replies: NostrEvent[], persist = true) {
    const newReplyIdMap = new Map<string, string[]>()
    const affectedParentKeys = new Set<string>()
    const refreshedParentKeys = new Set<string>()
    const persistableReplies: NostrEvent[] = []
    let topologyChanged = false

    replies.forEach((reply) => {
      const key = getEventKey(reply)
      client.addEventToCache(reply)

      if (!isReplyNoteEvent(reply)) return

      const knownParentKey = this.parentKeyMap.get(key)
      if (knownParentKey) {
        affectedParentKeys.add(knownParentKey)
        refreshedParentKeys.add(knownParentKey)
        return
      }
      if (persist) persistableReplies.push(reply)

      const parentTag = getParentTag(reply)
      if (parentTag) {
        const parentKey = getKeyFromTag(parentTag.tag)
        if (parentKey) {
          const thread = newReplyIdMap.get(parentKey) ?? []
          thread.push(key)
          newReplyIdMap.set(parentKey, thread)
          this.parentKeyMap.set(key, parentKey)
          affectedParentKeys.add(parentKey)
          topologyChanged = true
        }
      }
    })

    if (persistableReplies.length > 0) {
      void indexedDb
        .putEvents(
          persistableReplies.map((event) => ({
            event,
            relays: client.getEventHints(event.id)
          }))
        )
        .catch((error) => console.error('Failed to persist thread replies:', error))
    }

    for (const [key, newReplyIds] of newReplyIdMap.entries()) {
      const thread = this.threadMap.get(key) ?? []
      this.threadMap.set(key, [...thread, ...newReplyIds])
    }

    // A known ID may have failed to resolve earlier and just become available
    // through ClientService. Replace the array so useSyncExternalStore readers
    // retry their existing IDs without keeping another event-body cache here.
    for (const key of refreshedParentKeys) {
      if (newReplyIdMap.has(key)) continue
      const thread = this.threadMap.get(key)
      if (thread) this.threadMap.set(key, [...thread])
    }

    if (affectedParentKeys.size === 0) return

    this.descendantCache.clear()
    if (topologyChanged) this.ancestorChainCache.clear()
    for (const key of affectedParentKeys) {
      this.notifyThreadUpdate(key)
      this.notifyAllDescendantThreadsUpdate(key)
    }
  }

  getAncestorChain(currentKey: string, rootKey: string): string[] {
    if (!currentKey || !rootKey || currentKey === rootKey) return this.EMPTY_STRING_ARRAY

    const cacheKey = `${currentKey}:${rootKey}`
    const cached = this.ancestorChainCache.get(cacheKey)
    if (cached) return cached

    const chain: string[] = []
    const visited = new Set<string>([currentKey])
    let key: string | undefined = this.parentKeyMap.get(currentKey)
    while (key && key !== rootKey && !visited.has(key)) {
      chain.unshift(key)
      visited.add(key)
      key = this.parentKeyMap.get(key)
    }

    const result = chain.length === 0 ? this.EMPTY_STRING_ARRAY : chain
    this.ancestorChainCache.set(cacheKey, result)
    return result
  }

  getThread(stuffKey: string): string[] {
    return this.threadMap.get(stuffKey) ?? this.EMPTY_ARRAY
  }

  getAllDescendantThreads(stuffKey: string): Map<string, string[]> {
    const cached = this.descendantCache.get(stuffKey)
    if (cached) return cached

    const build = () => {
      const replyIds = this.threadMap.get(stuffKey)
      if (!replyIds || replyIds.length === 0) {
        return this.EMPTY_MAP
      }

      const result = new Map<string, string[]>()
      const keys: string[] = [stuffKey]
      while (keys.length > 0) {
        const key = keys.pop()!
        const childIds = this.threadMap.get(key) ?? []
        if (childIds.length > 0) {
          result.set(key, childIds)
          keys.push(...childIds)
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
      let root: TRootInfo
      if (event) {
        const logicalPubkey = getEventAuthorPubkey(event)
        root = isReplaceableEvent(event.kind)
          ? {
              type: 'A',
              id: getReplaceableCoordinateFromEvent(event),
              logicalPubkey,
              relay: client.getEventHint(event.id)
            }
          : { type: 'E', id: event.id, logicalPubkey }
      } else {
        root = { type: 'I', id: externalContent! }
      }

      // A zap receipt's e tag is the zap target, not a thread root marker.
      const rootTag = event?.kind === kinds.Zap ? undefined : getRootTag(event)
      if (rootTag?.type === 'e') {
        const [, rootEventHexId, , markerOrPubkey, markerPubkey] = rootTag.tag
        const rootEventPubkey = rootTag.tag[0] === 'E' ? markerOrPubkey : markerPubkey
        const rootKind = Number(event?.tags.find(([tagName]) => tagName === 'K')?.[1])
        const rootAuthorPubkey =
          rootKind === kinds.Zap
            ? event?.tags.find(([tagName]) => tagName === 'P')?.[1]
            : rootEventPubkey
        if (rootEventHexId && rootAuthorPubkey) {
          root = {
            type: 'E',
            id: rootEventHexId,
            logicalPubkey: rootAuthorPubkey
          }
        }
        if (rootKind === kinds.Zap) {
          const rootEventId = generateBech32IdFromETag(rootTag.tag)
          if (!rootEventId) return undefined
          const rootEvent = await client.fetchEvent(rootEventId)
          if (
            !rootEvent ||
            rootEvent.kind !== kinds.Zap ||
            !(await lightning.validateZapReceipt(rootEvent))
          ) {
            return undefined
          }
          root = {
            type: 'E',
            id: rootEvent.id,
            logicalPubkey: getEventAuthorPubkey(rootEvent)
          }
        } else if (!rootAuthorPubkey) {
          const rootEventId = generateBech32IdFromETag(rootTag.tag)
          if (rootEventId) {
            const rootEvent = await client.fetchEvent(rootEventId)
            if (rootEvent) {
              root = {
                type: 'E',
                id: rootEvent.id,
                logicalPubkey: getEventAuthorPubkey(rootEvent)
              }
            }
          }
        }
      } else if (rootTag?.type === 'a') {
        const [, coordinate, relay] = rootTag.tag
        const [, pubkey] = coordinate.split(':')
        root = { type: 'A', id: coordinate, logicalPubkey: pubkey, relay }
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

  private getDescendantReplyIds(rootKey: string): string[] {
    const result: string[] = []
    const pending = [rootKey]
    const visited = new Set<string>()
    while (pending.length > 0) {
      const parentKey = pending.pop()!
      for (const replyId of this.threadMap.get(parentKey) ?? []) {
        if (visited.has(replyId)) continue
        visited.add(replyId)
        result.push(replyId)
        pending.push(replyId)
      }
    }
    return result
  }
}

const instance = new ThreadService()

export default instance
