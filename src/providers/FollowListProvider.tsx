import { createFollowListDraftEvent } from '@/lib/draft-event'
import { tagNameEquals } from '@/lib/tag'
import client from '@/services/client.service'
import { Event } from 'nostr-tools'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNostr } from './NostrProvider'

type TFollowListContext = {
  followListEvent: Event | undefined
  followings: string[]
  isFetching: boolean
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
  const { pubkey: accountPubkey, publish, updateFollowListEvent } = useNostr()
  const [followListEvent, setFollowListEvent] = useState<Event | undefined>(undefined)
  const [isFetching, setIsFetching] = useState(true)
  const followings = useMemo(() => {
    return Array.from(
      new Set(
        followListEvent?.tags
          .filter(tagNameEquals('p'))
          .map(([, pubkey]) => pubkey)
          .filter(Boolean)
          .reverse() ?? []
      )
    )
  }, [followListEvent])

  useEffect(() => {
    if (!accountPubkey) return

    const init = async () => {
      setIsFetching(true)
      setFollowListEvent(undefined)
      const event = await client.fetchFollowListEvent(accountPubkey)
      setFollowListEvent(event)
      setIsFetching(false)
    }

    init()
  }, [accountPubkey])

  const follow = async (pubkey: string) => {
    if (isFetching || !accountPubkey) return

    const newFollowListDraftEvent = createFollowListDraftEvent(
      (followListEvent?.tags ?? []).concat([['p', pubkey]]),
      followListEvent?.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    client.updateFollowListCache(accountPubkey, newFollowListEvent)
    updateFollowListEvent(newFollowListEvent)
    setFollowListEvent(newFollowListEvent)
  }

  const unfollow = async (pubkey: string) => {
    if (isFetching || !accountPubkey || !followListEvent) return

    const newFollowListDraftEvent = createFollowListDraftEvent(
      followListEvent.tags.filter(([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey),
      followListEvent.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    client.updateFollowListCache(accountPubkey, newFollowListEvent)
    updateFollowListEvent(newFollowListEvent)
    setFollowListEvent(newFollowListEvent)
  }

  return (
    <FollowListContext.Provider
      value={{
        followListEvent,
        followings,
        isFetching,
        follow,
        unfollow
      }}
    >
      {children}
    </FollowListContext.Provider>
  )
}
