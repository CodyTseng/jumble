import NormalFeed from '@/components/NormalFeed'
import { SPECIAL_FEED_ID } from '@/constants'
import { useNostr } from '@/providers/NostrProvider'
import { usePinnedUsers } from '@/providers/PinnedUsersProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { useEffect, useState } from 'react'

export default function PinnedFeed() {
  const { pubkey, pinnedUsersEvent } = useNostr()
  const { pinnedPubkeySet } = usePinnedUsers()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])

  useEffect(() => {
    async function init() {
      if (!pubkey || pinnedUsersEvent?.pubkey !== pubkey || pinnedPubkeySet.size === 0) {
        setSubRequests([])
        return
      }

      const pinnedPubkeys = Array.from(pinnedPubkeySet)
      setSubRequests(await client.generateSubRequestsForPubkeys(pinnedPubkeys, pubkey))
    }

    init()
  }, [pubkey, pinnedUsersEvent, pinnedPubkeySet])

  return <NormalFeed feedId={SPECIAL_FEED_ID.PINNED} subRequests={subRequests} isPubkeyFeed />
}
