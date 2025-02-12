import { createFollowListDraftEvent } from '@/lib/draft-event'
import { extractPubkeysFromEventTags } from '@/lib/tag'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNostr } from './NostrProvider'

type TFollowListContext = {
  followListEvent: Event | undefined
  followings: string[]
  isFetching: boolean
  getFollowings: (pubkey: string) => Promise<string[]>
  follow: (pubkey: string) => Promise<void>
  unfollow: (pubkey: string) => Promise<void>
}

const FollowListContext = createContext<TFollowListContext | undefined>(undefined)

export const useFollowList = () => {
  const context = useContext(FollowListContext)
  if (!context) {
    throw new Error('useFollowList must be used within a FollowListProvider')
  }
  return context
}

export function FollowListProvider({ children }: { children: React.ReactNode }) {
  const { pubkey: accountPubkey, publish } = useNostr()
  const [followListEvent, setFollowListEvent] = useState<Event | undefined>(undefined)
  const [isFetching, setIsFetching] = useState(true)
  const followings = useMemo(
    () => (followListEvent ? extractPubkeysFromEventTags(followListEvent.tags) : []),
    [followListEvent]
  )

  useEffect(() => {
    if (!accountPubkey) return

    const init = async () => {
      setIsFetching(true)
      setFollowListEvent(undefined)
      const storedFollowListEvent = await indexedDb.getReplaceableEvent(
        accountPubkey,
        kinds.Contacts
      )
      if (storedFollowListEvent) {
        setFollowListEvent(storedFollowListEvent)
      }
      const event = await client.fetchFollowListEvent(accountPubkey, true)
      if (event) {
        await updateFollowListEvent(event)
      }
      setIsFetching(false)
    }

    init()
  }, [accountPubkey])

  const updateFollowListEvent = async (event: Event) => {
    const isNew = await indexedDb.putReplaceableEvent(event)
    if (!isNew) return
    setFollowListEvent(event)
  }

  const follow = async (pubkey: string) => {
    if (isFetching || !accountPubkey) return

    const newFollowListDraftEvent = createFollowListDraftEvent(
      (followListEvent?.tags ?? []).concat([['p', pubkey]]),
      followListEvent?.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    client.updateFollowListCache(accountPubkey, newFollowListEvent)
    await updateFollowListEvent(newFollowListEvent)
  }

  const unfollow = async (pubkey: string) => {
    if (isFetching || !accountPubkey || !followListEvent) return

    const newFollowListDraftEvent = createFollowListDraftEvent(
      followListEvent.tags.filter(([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey),
      followListEvent.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    client.updateFollowListCache(accountPubkey, newFollowListEvent)
    await updateFollowListEvent(newFollowListEvent)
  }

  const getFollowings = async (pubkey: string) => {
    const followListEvent = await indexedDb.getReplaceableEvent(pubkey, kinds.Contacts)
    if (followListEvent) {
      return extractPubkeysFromEventTags(followListEvent.tags)
    }
    return await client.fetchFollowings(pubkey)
  }

  return (
    <FollowListContext.Provider
      value={{
        followListEvent,
        followings,
        isFetching,
        getFollowings,
        follow,
        unfollow
      }}
    >
      {children}
    </FollowListContext.Provider>
  )
}
