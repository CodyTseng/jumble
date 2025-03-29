import { BIG_RELAY_URLS } from '@/constants'
import { createFavoriteRelaysDraftEvent, createRelaySetDraftEvent } from '@/lib/draft-event'
import { getRelaySetFromRelaySetEvent, getReplaceableEventIdentifier } from '@/lib/event'
import { randomString } from '@/lib/random'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import { TRelaySet } from '@/types'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'

type TFavoriteRelaysContext = {
  favoriteRelays: string[]
  addFavoriteRelay: (relayUrl: string) => Promise<void>
  deleteFavoriteRelay: (relayUrl: string) => Promise<void>
  relaySets: TRelaySet[]
  addRelaySet: (relaySetName: string, relayUrls?: string[]) => Promise<void>
  deleteRelaySet: (id: string) => Promise<void>
  updateRelaySet: (newSet: TRelaySet) => Promise<void>
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
    if (!favoriteRelaysEvent) return

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
          if (!pubkey || author !== pubkey) return
          if (!relaySetId) return

          if (!relaySetIds.includes(relaySetId)) {
            relaySetIds.push(relaySetId)
          }
        }
      })

      setFavoriteRelays(relays)

      if (!pubkey) return
      const relaySetEvents = await Promise.all(
        relaySetIds.map((id) => indexedDb.getReplaceableEvent(pubkey, kinds.Relaysets, id))
      )
      const nonExistingRelaySetIds = relaySetIds.filter((_, index) => {
        return !relaySetEvents[index]
      })
      if (nonExistingRelaySetIds.length) {
        const relaySetEvents = await client.fetchEvents(
          (relayList?.write ?? []).concat(BIG_RELAY_URLS).slice(0, 5),
          {
            kinds: [kinds.Relaysets],
            authors: [pubkey],
            '#d': nonExistingRelaySetIds
          }
        )
        const relaySetEventMap = new Map<string, Event>()
        relaySetEvents.forEach((event) => {
          const d = getReplaceableEventIdentifier(event)
          if (!d) return

          const old = relaySetEventMap.get(d)
          if (!old || old.created_at < event.created_at) {
            relaySetEventMap.set(d, event)
          }
        })
        await Promise.all(
          Array.from(relaySetEventMap.values()).map((event) => {
            return indexedDb.putReplaceableEvent(event)
          })
        )
        nonExistingRelaySetIds.forEach((id) => {
          const event = relaySetEventMap.get(id)
          if (event) {
            const index = relaySetIds.indexOf(id)
            if (index !== -1) {
              relaySetEvents[index] = event
            }
          }
        })
      }

      setRelaySetEvents(relaySetEvents.filter(Boolean) as Event[])
    }
    init()
  }, [favoriteRelaysEvent])

  useEffect(() => {
    setRelaySets(
      relaySetEvents.map((evt) => getRelaySetFromRelaySetEvent(evt)).filter(Boolean) as TRelaySet[]
    )
  }, [relaySetEvents])

  const addFavoriteRelay = async (relayUrl: string) => {
    const normalizedUrl = normalizeUrl(relayUrl)
    if (!normalizedUrl || favoriteRelays.includes(normalizedUrl)) return

    const draftEvent = createFavoriteRelaysDraftEvent(
      [...favoriteRelays, normalizedUrl],
      relaySetEvents
    )
    const newFavoriteRelaysEvent = await publish(draftEvent)
    updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
  }

  const deleteFavoriteRelay = async (relayUrl: string) => {
    const normalizedUrl = normalizeUrl(relayUrl)
    if (!normalizedUrl || !favoriteRelays.includes(normalizedUrl)) return

    const draftEvent = createFavoriteRelaysDraftEvent(
      favoriteRelays.filter((url) => url !== normalizedUrl),
      relaySetEvents
    )
    const newFavoriteRelaysEvent = await publish(draftEvent)
    updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
  }

  const addRelaySet = async (relaySetName: string, relayUrls: string[] = []) => {
    const normalizedUrls = relayUrls
      .map((url) => normalizeUrl(url))
      .filter((url) => isWebsocketUrl(url))
    const id = randomString()
    const relaySetDraftEvent = createRelaySetDraftEvent({
      id,
      name: relaySetName,
      relayUrls: normalizedUrls
    })
    const newRelaySetEvent = await publish(relaySetDraftEvent)
    await indexedDb.putReplaceableEvent(newRelaySetEvent)

    const favoriteRelaysDraftEvent = createFavoriteRelaysDraftEvent(favoriteRelays, [
      ...relaySetEvents,
      newRelaySetEvent
    ])
    const newFavoriteRelaysEvent = await publish(favoriteRelaysDraftEvent)
    updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
  }

  const deleteRelaySet = async (id: string) => {
    const newRelaySetEvents = relaySetEvents.filter((event) => {
      return getReplaceableEventIdentifier(event) !== id
    })
    if (newRelaySetEvents.length === relaySetEvents.length) return

    const draftEvent = createFavoriteRelaysDraftEvent(favoriteRelays, newRelaySetEvents)
    const newFavoriteRelaysEvent = await publish(draftEvent)
    updateFavoriteRelaysEvent(newFavoriteRelaysEvent)
  }

  const updateRelaySet = async (newSet: TRelaySet) => {
    const draftEvent = createRelaySetDraftEvent(newSet)
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
  }

  return (
    <FavoriteRelaysContext.Provider
      value={{
        favoriteRelays,
        addFavoriteRelay,
        deleteFavoriteRelay,
        relaySets,
        addRelaySet,
        deleteRelaySet,
        updateRelaySet
      }}
    >
      {children}
    </FavoriteRelaysContext.Provider>
  )
}
