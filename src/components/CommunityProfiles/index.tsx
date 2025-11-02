import { Skeleton } from '@/components/ui/skeleton'
import { toNip05Community } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'
import { TNip05Community } from '@/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Nip05CommunityCard from '../Nip05CommunityCard'

const SHOW_COUNT = 10

export default function CommunityProfiles() {
  const { t } = useTranslation()
  const { favoriteDomains, addFavoriteDomains, deleteFavoriteDomains, getCommunity } =
    useNip05Communities()
  const [loading, setLoading] = useState(true)
  const [communities, setCommunities] = useState<TNip05Community[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const { push } = useSecondaryPage()

  useEffect(() => {
    setLoading(true)

    const init = async () => {
      if (favoriteDomains.length === 0) {
        setCommunities([])
        return
      }

      // Fetch community data for all favorite domains
      const communityPromises = favoriteDomains.map((domain) => getCommunity(domain))
      const results = await Promise.all(communityPromises)
      const validCommunities = results.filter(Boolean) as TNip05Community[]

      setCommunities(validCommunities)
    }
    init().finally(() => {
      setLoading(false)
    })
  }, [favoriteDomains, getCommunity])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && showCount < communities.length) {
        setShowCount((prev) => prev + SHOW_COUNT)
      }
    }, options)

    const bottomRef = document.getElementById('community-profiles-bottom')
    if (bottomRef) {
      observerInstance.observe(bottomRef)
    }

    return () => {
      if (observerInstance && bottomRef) {
        observerInstance.unobserve(bottomRef)
      }
    }
  }, [showCount, communities])

  return (
    <div>
      {communities.slice(0, showCount).map((community) => (
        <div
          key={community.domain}
          className="clickable p-4 border-b"
          onClick={(e) => {
            e.stopPropagation()
            push(toNip05Community(community.domain))
          }}
        >
          <Nip05CommunityCard
            community={community}
            select={favoriteDomains.includes(community.domain)}
            onSelectChange={(select) => {
              if (select) {
                addFavoriteDomains([community.domain])
              } else {
                deleteFavoriteDomains([community.domain])
              }
            }}
            showMembers
          />
        </div>
      ))}
      {showCount < communities.length && <div id="community-profiles-bottom" />}
      {loading && <Skeleton className="h-24 p-4" />}
      {!loading && (
        <div className="text-center text-muted-foreground text-sm mt-2">
          {communities.length === 0
            ? t('no communities found')
            : showCount >= communities.length
              ? t('no more communities')
              : ''}
        </div>
      )}
    </div>
  )
}
