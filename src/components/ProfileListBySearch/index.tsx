import { SEARCHABLE_RELAY_URLS } from '@/constants'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import UserItem, { UserItemSkeleton } from '../UserItem'

const LIMIT = 50

export function ProfileListBySearch({ search }: { search: string }) {
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [pubkeySet, setPubkeySet] = useState(new Set<string>())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUntil(dayjs().unix())
    setHasMore(true)
    setPubkeySet(new Set<string>())
    loadMore()
  }, [search])

  useEffect(() => {
    if (!hasMore) return
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore()
      }
    }, options)

    const currentBottomRef = bottomRef.current

    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [hasMore, search, until])

  const loadMore = async () => {
    const profiles = await client.searchProfiles(SEARCHABLE_RELAY_URLS, {
      search,
      until,
      limit: LIMIT
    })
    const newPubkeySet = new Set<string>()
    profiles.forEach((profile) => {
      if (!pubkeySet.has(profile.pubkey)) {
        newPubkeySet.add(profile.pubkey)
      }
    })
    setPubkeySet((prev) => new Set([...prev, ...newPubkeySet]))
    setHasMore(profiles.length >= LIMIT)
    const lastProfileCreatedAt = profiles[profiles.length - 1].created_at
    setUntil(lastProfileCreatedAt ? lastProfileCreatedAt - 1 : 0)
  }

  return (
    <div className="px-4">
      {Array.from(pubkeySet).map((pubkey, index) => (
        <UserItem key={`${index}-${pubkey}`} userId={pubkey} />
      ))}
      {hasMore && <UserItemSkeleton />}
      {hasMore && <div ref={bottomRef} />}
    </div>
  )
}
