import UserItem from '@renderer/components/UserItem'
import { useSearchParams } from '@renderer/hooks'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Filter } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LIMIT = 50

export default function ProfileListPage() {
  const { t } = useTranslation()
  const { searchParams } = useSearchParams()
  const { relayUrls, searchableRelayUrls } = useRelaySettings()
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [pubkeySet, setPubkeySet] = useState(new Set<string>())
  const observer = useRef<IntersectionObserver | null>(null)
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
    return filter.search ? searchableRelayUrls : relayUrls
  }, [relayUrls, searchableRelayUrls, filter])
  const title = useMemo(() => {
    return filter.search ? `${t('search')}: ${filter.search}` : t('all users')
  }, [filter])

  useEffect(() => {
    if (!hasMore) return
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore()
      }
    }, options)

    if (bottomRef.current) {
      observer.current.observe(bottomRef.current)
    }

    return () => {
      if (observer.current && bottomRef.current) {
        observer.current.unobserve(bottomRef.current)
      }
    }
  }, [filter, hasMore])

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
    <SecondaryPageLayout titlebarContent={title}>
      <div className="space-y-2 max-sm:px-4">
        {Array.from(pubkeySet).map((pubkey, index) => (
          <UserItem key={`${index}-${pubkey}`} pubkey={pubkey} />
        ))}
        {hasMore && <div ref={bottomRef} />}
      </div>
    </SecondaryPageLayout>
  )
}
