import { createFollowListDraftEvent } from '@/lib/draft-event'
import { extractPubkeysFromEventTags } from '@/lib/tag'
import client from '@/services/client.service'
import { createContext, useContext, useMemo } from 'react'
import { useNostr } from './NostrProvider'

type TFollowListContext = {
  followings: string[]
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
  const { pubkey: accountPubkey, followListEvent, publish, updateFollowListEvent } = useNostr()
  const followings = useMemo(
    () => (followListEvent ? extractPubkeysFromEventTags(followListEvent.tags) : []),
    [followListEvent]
  )

  const follow = async (pubkey: string) => {
    if (!accountPubkey) return

    const followListEvent = await client.fetchFollowListEvent(accountPubkey)
    const newFollowListDraftEvent = createFollowListDraftEvent(
      (followListEvent?.tags ?? []).concat([['p', pubkey]]),
      followListEvent?.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    await updateFollowListEvent(newFollowListEvent)
  }

  const unfollow = async (pubkey: string) => {
    if (!accountPubkey) return

    const followListEvent = await client.fetchFollowListEvent(accountPubkey)
    if (!followListEvent) return

    const newFollowListDraftEvent = createFollowListDraftEvent(
      followListEvent.tags.filter(([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey),
      followListEvent.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    await updateFollowListEvent(newFollowListEvent)
  }

  return (
    <FollowListContext.Provider
      value={{
        followings,
        follow,
        unfollow
      }}
    >
      {children}
    </FollowListContext.Provider>
  )
}
