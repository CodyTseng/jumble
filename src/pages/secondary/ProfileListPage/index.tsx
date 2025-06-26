import { Favicon } from '@/components/Favicon'
import ProfileList from '@/components/ProfileList'
import UserItem from '@/components/UserItem'
import { SEARCHABLE_RELAY_URLS } from '@/constants'
import { useFetchRelayInfos } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { fetchPubkeysFromDomain } from '@/lib/nip05'
import { useFeed } from '@/providers/FeedProvider'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LIMIT = 50

const ProfileListPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const [title, setTitle] = useState<React.ReactNode>()
  const [data, setData] = useState<{
    type: 'search' | 'domain'
    id: string
  } | null>(null)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const search = searchParams.get('s')
    if (search) {
      setTitle(`${t('Search')}: ${search}`)
      setData({ type: 'search', id: search })
      return
    }

    const domain = searchParams.get('d')
    if (domain) {
      setTitle(
        <div className="flex items-center gap-1">
          {domain}
          <Favicon domain={domain} className="w-5 h-5" />
        </div>
      )
      setData({ type: 'domain', id: domain })
      return
    }
  }, [])

  let content: React.ReactNode = null
  if (data?.type === 'search') {
    content = <ProfileListBySearch search={data.id} />
  } else if (data?.type === 'domain') {
    content = <ProfileListByDomain domain={data.id} />
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={title} displayScrollToTopButton>
      {content}
    </SecondaryPageLayout>
  )
})
ProfileListPage.displayName = 'ProfileListPage'
export default ProfileListPage

function ProfileListByDomain({ domain }: { domain: string }) {
  const [pubkeys, setPubkeys] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      const _pubkeys = await fetchPubkeysFromDomain(domain)
      setPubkeys(_pubkeys)
    }
    init()
  }, [domain])

  return <ProfileList pubkeys={pubkeys} />
}

function ProfileListBySearch({ search }: { search: string }) {
  const { relayUrls } = useFeed()
  const { searchableRelayUrls } = useFetchRelayInfos(relayUrls)
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [pubkeySet, setPubkeySet] = useState(new Set<string>())
  const bottomRef = useRef<HTMLDivElement>(null)
  const filter = { until, search }
  const urls = useMemo(() => {
    return filter.search ? searchableRelayUrls.concat(SEARCHABLE_RELAY_URLS).slice(0, 4) : relayUrls
  }, [relayUrls, searchableRelayUrls, filter])

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
    const profiles = await client.searchProfiles(urls, { ...filter, limit: LIMIT })
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
        <UserItem key={`${index}-${pubkey}`} pubkey={pubkey} />
      ))}
      {hasMore && <div ref={bottomRef} />}
    </div>
  )
}
