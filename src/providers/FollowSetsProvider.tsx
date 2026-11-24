import { IS_COMMUNITY_MODE } from '@/constants'
import { createDeletionRequestDraftEvent } from '@/lib/draft-event'
import { getReplaceableEventIdentifier } from '@/lib/event-core'
import {
  createFollowSetDraft,
  getFollowSetDeletionFilters,
  mergeFollowSetEvents,
  TFollowSet
} from '@/lib/follow-set'
import { randomString } from '@/lib/random'
import { getDefaultRelayUrls } from '@/lib/relay'
import client from '@/services/client.service'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNostr } from './NostrProvider'

type TFollowSetsContext = {
  followSets: TFollowSet[]
  isLoading: boolean
  canEdit: boolean
  saveFollowSet: (
    name: string,
    pubkeys: string[],
    previous?: TFollowSet
  ) => Promise<'saved' | 'changed' | 'unverified'>
  deleteFollowSet: (id: string) => Promise<void>
}

const FollowSetsContext = createContext<TFollowSetsContext | undefined>(undefined)

export function useFollowSets() {
  const context = useContext(FollowSetsContext)
  if (!context) throw new Error('useFollowSets must be used within a FollowSetsProvider')
  return context
}

function cacheKey(pubkey: string) {
  return `followSetEvents:${pubkey}`
}

function readCachedEvents(pubkey: string): Event[] {
  try {
    const events = JSON.parse(localStorage.getItem(cacheKey(pubkey)) ?? '[]')
    return Array.isArray(events) ? events : []
  } catch {
    return []
  }
}

export function FollowSetsProvider({ children }: { children: React.ReactNode }) {
  const { pubkey, account, signer, relayList, publish } = useNostr()
  const accountRef = useRef(account)
  accountRef.current = account
  const enabled = !!pubkey && !IS_COMMUNITY_MODE
  const canEdit = enabled && !!signer && account?.signerType !== 'npub'
  const [result, setResult] = useState<{ pubkey: string; events: Event[] }>()
  const [loadedAccount, setLoadedAccount] = useState<string>()
  const changes = useRef(new Map<string, Event[]>())
  const pending = useRef(new Set<string>())
  const relayKey = JSON.stringify(relayList?.write)
  const cachedEvents = useMemo(
    () => (enabled ? (changes.current.get(pubkey) ?? readCachedEvents(pubkey)) : []),
    [enabled, pubkey]
  )
  const followSets = useMemo(() => {
    if (!enabled) return []
    const events = result?.pubkey === pubkey ? result.events : cachedEvents
    return mergeFollowSetEvents(pubkey, events).followSets
  }, [cachedEvents, enabled, pubkey, result])

  const updateEvents = (author: string, incoming: Event[]) => {
    const previous = [...(changes.current.get(author) ?? []), ...readCachedEvents(author)]
    const { events } = mergeFollowSetEvents(author, [...previous, ...incoming])
    changes.current.set(author, events)
    try {
      localStorage.setItem(cacheKey(author), JSON.stringify(events))
    } catch (error) {
      console.warn('Could not cache follow lists', error)
    }
    if (accountRef.current?.pubkey === author) setResult({ pubkey: author, events })
  }

  const findCurrentSet = (author: string, id: string) => {
    const current = [...(changes.current.get(author) ?? []), ...readCachedEvents(author)]
    return mergeFollowSetEvents(author, current).followSets.find((set) => set.id === id)
  }

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const fetchLists = async () => {
      try {
        const relays = [...(relayList?.write ?? []), ...getDefaultRelayUrls()]
        const events = await client.fetchEvents(relays, {
          authors: [pubkey],
          kinds: [kinds.Followsets]
        })
        if (cancelled) return
        const { followSets } = mergeFollowSetEvents(pubkey, [
          ...(changes.current.get(pubkey) ?? cachedEvents),
          ...events
        ])
        const heads = followSets.map((set) => set.event)
        const deletionFilters = getFollowSetDeletionFilters(pubkey, heads)
        const deletionRelays = [
          ...relays,
          ...heads.flatMap((event) => client.getSeenEventRelayUrls(event.id))
        ]
        const deletions = deletionFilters.length
          ? await client.fetchEvents(deletionRelays, deletionFilters)
          : []
        if (!cancelled) updateEvents(pubkey, [...events, ...deletions])
      } catch (error) {
        console.warn('Could not load follow lists', error)
      } finally {
        if (!cancelled) setLoadedAccount(pubkey)
      }
    }
    void fetchLists()
    return () => {
      cancelled = true
    }
  }, [enabled, pubkey, relayKey])

  const saveFollowSet = async (name: string, pubkeys: string[], previous?: TFollowSet) => {
    if (!pubkey || !canEdit || !name.trim() || accountRef.current !== account) {
      throw new Error('Follow list cannot be saved')
    }
    const operation = previous?.id ?? pubkey
    if (pending.current.has(operation)) throw new Error('Follow list is already being updated')
    pending.current.add(operation)
    try {
      const { write } = await client.fetchRelayList(pubkey)
      const relays = write.length ? write : getDefaultRelayUrls()
      if (accountRef.current !== account) throw new Error('Account changed')
      const identifier = previous ? getReplaceableEventIdentifier(previous.event) : randomString()
      const seenOn = previous ? client.getSeenEventRelayUrls(previous.event.id) : []
      if (previous) {
        const readRelays = [...relays, ...seenOn, ...getDefaultRelayUrls()]
        const versions = await client.fetchEvents(readRelays, {
          authors: [pubkey],
          kinds: [kinds.Followsets],
          '#d': [identifier]
        })
        const deletions = await client.fetchEvents(
          readRelays,
          getFollowSetDeletionFilters(pubkey, [previous.event, ...versions])
        )
        updateEvents(pubkey, [...versions, ...deletions])
        if (accountRef.current !== account) throw new Error('Account changed')
        const current = findCurrentSet(pubkey, previous.id)
        if (current?.event.id !== previous.event.id) return 'changed'
        // A relay query may return an empty result when all connections fail.
        if (!versions.some((version) => version.id === previous.event.id)) return 'unverified'
      }
      const event = await publish(
        createFollowSetDraft(identifier, name, pubkeys, previous?.event),
        {
          specifiedRelayUrls: [...relays, ...seenOn]
        }
      )
      if (event.pubkey !== pubkey) throw new Error('Signer changed')
      updateEvents(pubkey, [event])
      return 'saved'
    } finally {
      pending.current.delete(operation)
    }
  }

  const deleteFollowSet = async (id: string) => {
    if (!pubkey || !canEdit || accountRef.current !== account || pending.current.has(id)) {
      throw new Error('Follow list cannot be deleted')
    }
    const current = findCurrentSet(pubkey, id)
    if (!current) return
    pending.current.add(id)
    try {
      const draft = createDeletionRequestDraftEvent(current.event)
      draft.created_at = Math.max(draft.created_at, current.event.created_at)
      const event = await publish(draft, {
        additionalRelayUrls: client.getSeenEventRelayUrls(current.event.id)
      })
      if (event.pubkey !== pubkey) throw new Error('Signer changed')
      updateEvents(pubkey, [event])
    } finally {
      pending.current.delete(id)
    }
  }

  return (
    <FollowSetsContext.Provider
      value={{
        followSets,
        isLoading: enabled && loadedAccount !== pubkey,
        canEdit,
        saveFollowSet,
        deleteFollowSet
      }}
    >
      {children}
    </FollowSetsContext.Provider>
  )
}
