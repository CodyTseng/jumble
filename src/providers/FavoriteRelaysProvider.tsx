import { IS_COMMUNITY_MODE, COMMUNITY_RELAY_SETS } from '@/constants'
import { createFavoriteRelaysDraftEvent, createRelaySetDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { getReplaceableEventIdentifier } from '@/lib/event'
import { getRelaySetFromEvent } from '@/lib/event-metadata'
import { randomString } from '@/lib/random'
import { getDefaultRelayUrls } from '@/lib/relay'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import { TRelaySet } from '@/types'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useNostr } from './NostrProvider'

type TFavoriteRelaysContext = {
  favoriteRelays: string[]
  addFavoriteRelays: (relayUrls: string[]) => Promise<void>
  deleteFavoriteRelays: (relayUrls: string[]) => Promise<void>
  reorderFavoriteRelays: (reorderedRelays: string[]) => Promise<void>
  relaySets: TRelaySet[]
  createRelaySet: (relaySetName: string, relayUrls?: string[]) => Promise<void>
  addRelaySets: (newRelaySetEvents: Event[]) => Promise<void>
  deleteRelaySet: (id: string) => Promise<void>
  updateRelaySet: (newSet: TRelaySet) => Promise<void>
  reorderRelaySets: (reorderedSets: TRelaySet[]) => Promise<void>
}

const FavoriteRelaysContext = createContext<TFavoriteRelaysContext | undefined>(undefined)

export const useFavoriteRelays = () => {
  const context = useContext(FavoriteRelaysContext)
  if (!context) {
    throw new Error('useFavoriteRelays must be used within a FavoriteRelaysProvider')
  }
  return context
}

export function FavoriteRelaysProvider({ children }: { children: React.ReactNode }) {
  const { favoriteRelaysEvent, updateFavoriteRelaysEvent, pubkey, relayList, publish } = useNostr()
  const [favoriteRelays, setFavoriteRelays] = useState<string[]>([])
  const [relaySetEvents, setRelaySetEvents] = useState<Event[]>([])
  const [relaySets, setRelaySets] = useState<TRelaySet[]>([])

  useEffect(() => {
    if (IS_COMMUNITY_MODE) {
      setRelaySets(COMMUNITY_RELAY_SETS)
      return
    }
    if (!favoriteRelaysEvent) {
      const favoriteRelays: string[] = []
      const storedRelaySets = storage.getRelaySets()
      storedRelaySets.forEach(({ relayUrls }) => {
        relayUrls.forEach((url) => {
          if (!favoriteRelays.includes(url)) {
            favoriteRelays.push(url)
          }
        })
      })

      setFavoriteRelays(favoriteRelays)
      setRelaySetEvents([])
      return
    }

    const init = async () => {
      const relays: string[] = []
      const relaySetIds: string[] = []

      favoriteRelaysEvent.tags.forEach(([tagName, tagValue]) => {
        if (!tagValue) return

        if (tagName === 'relay') {
          const normalizedUrl = normalizeUrl(tagValue)
          if (normalizedUrl && !relays.includes(normalizedUrl)) {
            relays.push(normalizedUrl)
          }
        } else if (tagName === 'a') {
          const [kind, author, relaySetId] = tagValue.split(':')
          if (kind !== kinds.Relaysets.toString()) return
          if (!pubkey || author !== pubkey) return // TODO: support others relay sets
          if (!relaySetId) return

          if (!relaySetIds.includes(relaySetId)) {
            relaySetIds.push(relaySetId)
          }
        }
      })

      setFavoriteRelays(relays)

      if (!pubkey || !relaySetIds.length) {
        setRelaySets([])
        return
      }
      const storedRelaySetEvents = await Promise.all(
        relaySetIds.map((id) => indexedDb.getReplaceableEvent(pubkey, kinds.Relaysets, id))
      )
      setRelaySetEvents(storedRelaySetEvents.filter(Boolean) as Event[])

      const newRelaySetEvents = await client.fetchEvents(
        (relayList?.write ?? []).concat(getDefaultRelayUrls()).slice(0, 5),
        {
          kinds: [kinds.Relaysets],
          authors: [pubkey],
          '#d': relaySetIds
        }
      )
      const relaySetEventMap = new Map<string, Event>()
      newRelaySetEvents.forEach((event) => {
        const d = getReplaceableEventIdentifier(event)
        if (!d) return

        const old = relaySetEventMap.get(d)
        if (!old || old.created_at < event.created_at) {
          relaySetEventMap.set(d, event)
        }
      })
      const uniqueNewRelaySetEvents = relaySetIds
        .map((id, index) => {
          const event = relaySetEventMap.get(id)
          if (event) {
            return event
          }
          return storedRelaySetEvents[index] || null
        })
        .filter(Boolean) as Event[]
      setRelaySetEvents(uniqueNewRelaySetEvents)
      await Promise.all(
        uniqueNewRelaySetEvents.map((event) => {
          return indexedDb.putReplaceableEvent(event)
        })
      )
    }
    init()
  }, [favoriteRelaysEvent])

  useEffect(() => {
    setRelaySets(
      relaySetEvents.map((evt) => getRelaySetFromEvent(evt)).filter(Boolean) as TRelaySet[]
    )
  }, [relaySetEvents])

  const addFavoriteRelays = async (relayUrls: string[]) => {
    const normalizedUrls = relayUrls
      .map((relayUrl) => normalizeUrl(relayUrl))
      .filter((url) => !!url && !favoriteRelays.includes(url))
    if (!normalizedUrls.length) return

    const draftEvent = createFavoriteRelaysDraftEvent(
      [...favoriteRelays, ...normalizedUrls],
      relaySetEvents
    )
    try {
      const newFavoriteRelaysEvent = await publish(draftEvent)
      updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to add favorite relays: ${err}`, { duration: 10_000 })
      })
    }
  }

  const deleteFavoriteRelays = async (relayUrls: string[]) => {
    const normalizedUrls = relayUrls
      .map((relayUrl) => normalizeUrl(relayUrl))
      .filter((url) => !!url && favoriteRelays.includes(url))
    if (!normalizedUrls.length) return

    const draftEvent = createFavoriteRelaysDraftEvent(
      favoriteRelays.filter((url) => !normalizedUrls.includes(url)),
      relaySetEvents
    )
    try {
      const newFavoriteRelaysEvent = await publish(draftEvent)
      updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to delete favorite relays: ${err}`, { duration: 10_000 })
      })
    }
  }

  const createRelaySet = async (relaySetName: string, relayUrls: string[] = []) => {
    const normalizedUrls = relayUrls
      .map((url) => normalizeUrl(url))
      .filter((url) => isWebsocketUrl(url))
    const id = randomString()
    const relaySetDraftEvent = createRelaySetDraftEvent({
      id,
      name: relaySetName,
      relayUrls: normalizedUrls
    })
    try {
      const newRelaySetEvent = await publish(relaySetDraftEvent)
      await indexedDb.putReplaceableEvent(newRelaySetEvent)

      const favoriteRelaysDraftEvent = createFavoriteRelaysDraftEvent(favoriteRelays, [
        ...relaySetEvents,
        newRelaySetEvent
      ])
      const newFavoriteRelaysEvent = await publish(favoriteRelaysDraftEvent)
      updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to create relay set: ${err}`, { duration: 10_000 })
      })
    }
  }

  const addRelaySets = async (newRelaySetEvents: Event[]) => {
    const favoriteRelaysDraftEvent = createFavoriteRelaysDraftEvent(favoriteRelays, [
      ...relaySetEvents,
      ...newRelaySetEvents
    ])
    try {
      const newFavoriteRelaysEvent = await publish(favoriteRelaysDraftEvent)
      updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to add relay sets: ${err}`, { duration: 10_000 })
      })
    }
  }

  const deleteRelaySet = async (id: string) => {
    const newRelaySetEvents = relaySetEvents.filter((event) => {
      return getReplaceableEventIdentifier(event) !== id
    })
    if (newRelaySetEvents.length === relaySetEvents.length) return

    const draftEvent = createFavoriteRelaysDraftEvent(favoriteRelays, newRelaySetEvents)
    try {
      const newFavoriteRelaysEvent = await publish(draftEvent)
      updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to delete relay set: ${err}`, { duration: 10_000 })
      })
    }
  }

  const updateRelaySet = async (newSet: TRelaySet) => {
    const draftEvent = createRelaySetDraftEvent(newSet)

    try {
      const newRelaySetEvent = await publish(draftEvent)
      await indexedDb.putReplaceableEvent(newRelaySetEvent)

      setRelaySetEvents((prev) => {
        return prev.map((event) => {
          if (getReplaceableEventIdentifier(event) === newSet.id) {
            return newRelaySetEvent
          }
          return event
        })
      })
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to update relay set: ${err}`, { duration: 10_000 })
      })
    }
  }

  const reorderFavoriteRelays = async (reorderedRelays: string[]) => {
    setFavoriteRelays(reorderedRelays)
    const draftEvent = createFavoriteRelaysDraftEvent(reorderedRelays, relaySetEvents)
    try {
      const newFavoriteRelaysEvent = await publish(draftEvent)
      updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to reorder favorite relays: ${err}`, { duration: 10_000 })
      })
    }
  }

  const reorderRelaySets = async (reorderedSets: TRelaySet[]) => {
    setRelaySets(reorderedSets)
    const draftEvent = createFavoriteRelaysDraftEvent(
      favoriteRelays,
      reorderedSets.map((set) => set.aTag)
    )
    try {
      const newFavoriteRelaysEvent = await publish(draftEvent)
      updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to reorder relay sets: ${err}`, { duration: 10_000 })
      })
    }
  }

  return (
    <FavoriteRelaysContext.Provider
      value={{
        favoriteRelays,
        addFavoriteRelays,
        deleteFavoriteRelays,
        reorderFavoriteRelays,
        relaySets,
        createRelaySet,
        addRelaySets,
        deleteRelaySet,
        updateRelaySet,
        reorderRelaySets
      }}
    >
      {children}
    </FavoriteRelaysContext.Provider>
  )
}
