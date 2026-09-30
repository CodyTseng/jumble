import { useFetchRelayInfo } from '@/hooks'
import { toRelay } from '@/lib/link'
import { useHideFollowedPosts } from '@/providers/HideFollowedPostsProvider' // Add this line for the toggle provider hook
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelaySimpleInfo, { RelaySimpleInfoSkeleton } from '../RelaySimpleInfo'

const SHOW_COUNT = 10

export default function FollowingFavoriteRelayList() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [loading, setLoading] = useState(true)
  const [relays, setRelays] = useState<[string, string[]][]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)

    const init = async () => {
      if (!pubkey) return

      const relays = (await client.fetchFollowingFavoriteRelays(pubkey)) ?? []
      setRelays(relays)
    }
    init().finally(() => {
      setLoading(false)
    })
  }, [pubkey])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && showCount < relays.length) {
        setShowCount((prev) => prev + SHOW_COUNT)
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
  }, [showCount, relays])

  return (
    <div>
      {relays.slice(0, showCount).map(([url, users]) => (
        <RelayItem key={url} url={url} users={users} />
      ))}
      {showCount < relays.length && <div ref={bottomRef} />}
      {loading && <RelaySimpleInfoSkeleton className="p-4" />}
      {!loading && (
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {relays.length === 0 ? t('no relays found') : t('no more relays')}
        </div>
      )}
    </div>
  )
}

function RelayItem({ url, users }: { url: string; users: string[] }) {
  const { push } = useSecondaryPage()
  const { relayInfo } = useFetchRelayInfo(url)

  return (
    <RelaySimpleInfo
      key={url}
      relayInfo={relayInfo}
      users={users}
      className="clickable border-b p-4"
      onClick={(e) => {
        e.stopPropagation()
        push(toRelay(url))
      }}
    />
  )
}
