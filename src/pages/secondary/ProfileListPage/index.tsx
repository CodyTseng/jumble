import UserItem from '@/components/UserItem'
import { SEARCHABLE_RELAY_URLS } from '@/constants'
import { useFetchRelayInfos, useSearchParams } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useFeed } from '@/providers/FeedProvider'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Filter } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LIMIT = 50

export default function ProfileListPage({ index }: { index?: number }) {
  const { t } = useTranslation()
  const { searchParams } = useSearchParams()
  const { relayUrls } = useFeed()
  const { searchableRelayUrls } = useFetchRelayInfos(relayUrls)
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [pubkeySet, setPubkeySet] = useState(new Set<string>())
  const bottomRef = useRef<HTMLDivElement>(null)
  const filter = useMemo(() => {
    const f: Filter = { until }
    const search = searchParams.get('s')
    if (search) {
      f.search = search
    }
    return f
  }, [searchParams, until])
  const urls = useMemo(() => {
    return filter.search ? searchableRelayUrls.concat(SEARCHABLE_RELAY_URLS).slice(0, 4) : relayUrls
  }, [relayUrls, searchableRelayUrls, filter])
  const title = useMemo(() => {
    return filter.search ? `${t('Search')}: ${filter.search}` : t('All users')
  }, [filter])

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
  }, [hasMore, filter, urls])

  async function loadMore() {
    if (urls.length === 0) {
      return setHasMore(false)
    }
    const profiles = await client.fetchProfiles(urls, { ...filter, limit: LIMIT })
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
    <SecondaryPageLayout index={index} title={title} displayScrollToTopButton>
      <div className="space-y-2 px-4">
        {Array.from(pubkeySet).map((pubkey, index) => (
          <UserItem key={`${index}-${pubkey}`} pubkey={pubkey} />
        ))}
        {hasMore && <div ref={bottomRef} />}
      </div>
    </SecondaryPageLayout>
  )
}
