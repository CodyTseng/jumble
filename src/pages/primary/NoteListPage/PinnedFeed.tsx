import NormalFeed from '@/components/NormalFeed'
import { SPECIAL_FEED_ID } from '@/constants'
import { useNostr } from '@/providers/NostrProvider'
import { usePinnedUsers } from '@/providers/PinnedUsersProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { useEffect, useRef, useState } from 'react'

export default function PinnedFeed() {
  const { pubkey } = useNostr()
  const { pinnedPubkeySet } = usePinnedUsers()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return

    async function init() {
      if (!pubkey || pinnedPubkeySet.size === 0) {
        setSubRequests([])
        return
      }

      initializedRef.current = true
      const pinnedPubkeys = Array.from(pinnedPubkeySet)
      setSubRequests(await client.generateSubRequestsForPubkeys(pinnedPubkeys, pubkey))
    }

    init()
  }, [pubkey, pinnedPubkeySet])

  return <NormalFeed feedId={SPECIAL_FEED_ID.PINNED} subRequests={subRequests} isPubkeyFeed />
}
