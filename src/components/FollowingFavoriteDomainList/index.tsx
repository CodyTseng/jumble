import { Skeleton } from '@/components/ui/skeleton'
import { toNip05Community } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'
import client from '@/services/client.service'
import { TNip05Community } from '@/types'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Nip05CommunityCard from '../Nip05CommunityCard'

const SHOW_COUNT = 10

export default function FollowingFavoriteDomainList() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { favoriteDomains, addFavoriteDomains, deleteFavoriteDomains, getCommunity } =
    useNip05Communities()
  const [loading, setLoading] = useState(true)
  const [domains, setDomains] = useState<[string, string[]][]>([])
  const [communities, setCommunities] = useState<Map<string, TNip05Community>>(new Map())
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)

    const init = async () => {
      if (!pubkey) return

      // Fetch followings
      const followings = await client.fetchFollowings(pubkey)
      if (!followings || followings.length === 0) {
        setDomains([])
        return
      }

      // Fetch profiles for all followings
      const profiles = await Promise.all(
        followings.map((followingPubkey) => client.fetchProfile(followingPubkey))
      )

      // Extract NIP-05 domains and count users per domain
      const domainMap = new Map<string, Set<string>>()
      profiles.forEach((profile) => {
        if (profile?.nip05) {
          const nip05 = profile.nip05
          // Extract domain from NIP-05 identifier (e.g., "user@domain.com" -> "domain.com")
          const parts = nip05.split('@')
          if (parts.length === 2) {
            const domain = parts[1].toLowerCase().trim()
            if (domain) {
              const pubkeys = domainMap.get(domain) || new Set()
              pubkeys.add(profile.pubkey)
              domainMap.set(domain, pubkeys)
            }
          }
        }
      })

      // Convert to sorted array (by user count descending)
      const sortedDomains = Array.from(domainMap.entries())
        .map(([domain, pubkeys]) => [domain, Array.from(pubkeys)] as [string, string[]])
        .sort((a, b) => b[1].length - a[1].length)

      setDomains(sortedDomains)

      // Fetch community data for top domains
      const topDomains = sortedDomains.slice(0, 20).map(([domain]) => domain)
      const communityData = await Promise.all(
        topDomains.map(async (domain) => {
          const community = await getCommunity(domain)
          return { domain, community }
        })
      )

      const communityMap = new Map<string, TNip05Community>()
      communityData.forEach(({ domain, community }) => {
        if (community) {
          communityMap.set(domain, community)
        }
      })
      setCommunities(communityMap)
    }
    init().finally(() => {
      setLoading(false)
    })
  }, [pubkey, getCommunity])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && showCount < domains.length) {
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
  }, [showCount, domains])

  return (
    <div>
      {domains.slice(0, showCount).map(([domain, users]) => (
        <DomainItem
          key={domain}
          domain={domain}
          users={users}
          community={communities.get(domain)}
          isFavorite={favoriteDomains.includes(domain)}
          onFavoriteChange={(select) => {
            if (select) {
              addFavoriteDomains([domain])
            } else {
              deleteFavoriteDomains([domain])
            }
          }}
        />
      ))}
      {showCount < domains.length && <div ref={bottomRef} />}
      {loading && <Skeleton className="p-4" />}
      {!loading && (
        <div className="text-center text-muted-foreground text-sm mt-2">
          {domains.length === 0 ? t('no domains found') : t('no more domains')}
        </div>
      )}
    </div>
  )
}

function DomainItem({
  domain,
  users,
  community,
  isFavorite,
  onFavoriteChange
}: {
  domain: string
  users: string[]
  community?: TNip05Community
  isFavorite: boolean
  onFavoriteChange: (select: boolean) => void
}) {
  const { push } = useSecondaryPage()

  // If we don't have community data yet, create a minimal community object
  const displayCommunity: TNip05Community = community || {
    id: domain,
    domain,
    members: users,
    memberCount: users.length,
    lastUpdated: Date.now()
  }

  return (
    <div
      className="clickable p-4 border-b"
      onClick={(e) => {
        e.stopPropagation()
        push(toNip05Community(domain))
      }}
    >
      <Nip05CommunityCard
        community={displayCommunity}
        select={isFavorite}
        onSelectChange={onFavoriteChange}
        showMembers
      />
    </div>
  )
}
