import { Skeleton } from '@/components/ui/skeleton'
import { toNip05Community } from '@/lib/link'
import { fetchPubkeysFromDomain } from '@/lib/nip05'
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
      if (!pubkey) {
        setDomains([])
        setLoading(false)
        return
      }

      console.log('[FollowingDomains] Fetching followings for:', pubkey)

      // Fetch followings
      const followings = await client.fetchFollowings(pubkey)
      if (!followings || followings.length === 0) {
        console.log('[FollowingDomains] No followings found')
        setDomains([])
        setLoading(false)
        return
      }

      console.log('[FollowingDomains] Found followings:', followings.length)

      // Fetch profiles for all followings in batches
      const batchSize = 20
      const profiles = []
      for (let i = 0; i < followings.length; i += batchSize) {
        const batch = followings.slice(i, i + batchSize)
        const batchProfiles = await Promise.all(
          batch.map((followingPubkey) => client.fetchProfile(followingPubkey))
        )
        profiles.push(...batchProfiles)
        console.log(`[FollowingDomains] Fetched ${profiles.length}/${followings.length} profiles`)
      }

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

      console.log('[FollowingDomains] Found unique domains:', domainMap.size)

      // Convert to sorted array (by user count descending)
      const sortedDomains = Array.from(domainMap.entries())
        .map(([domain, pubkeys]) => [domain, Array.from(pubkeys)] as [string, string[]])
        .sort((a, b) => b[1].length - a[1].length)

      setDomains(sortedDomains)

      // Fetch community data for ALL domains (not just top 20) in the background
      // This ensures we have nostr.json data for each community
      console.log('[FollowingDomains] Fetching community data for', sortedDomains.length, 'domains')

      // Fetch in batches to avoid overwhelming the system
      const communityBatchSize = 5
      const communityMap = new Map<string, TNip05Community>()

      for (let i = 0; i < sortedDomains.length; i += communityBatchSize) {
        const batch = sortedDomains.slice(i, i + communityBatchSize)
        const communityData = await Promise.all(
          batch.map(async ([domain]) => {
            try {
              // First try to get cached data
              let community = await getCommunity(domain)

              // If no cached data or stale data, refresh from nostr.json
              if (!community || !community.members || community.members.length === 0) {
                console.log('[FollowingDomains] Fetching fresh data for:', domain)
                const members = await fetchPubkeysFromDomain(domain)
                if (members.length > 0) {
                  community = {
                    id: domain,
                    domain,
                    members,
                    memberCount: members.length,
                    lastUpdated: Date.now()
                  }
                }
              }

              return { domain, community }
            } catch (error) {
              console.error('[FollowingDomains] Error fetching community:', domain, error)
              return { domain, community: undefined }
            }
          })
        )

        communityData.forEach(({ domain, community }) => {
          if (community) {
            communityMap.set(domain, community)
          }
        })

        setCommunities(new Map(communityMap))
        console.log(`[FollowingDomains] Fetched ${communityMap.size}/${sortedDomains.length} communities`)
      }

      // Re-sort domains by actual community member count (descending)
      const sortedByMemberCount = sortedDomains.sort((a, b) => {
        const communityA = communityMap.get(a[0])
        const communityB = communityMap.get(b[0])

        const countA = communityA?.memberCount || communityA?.members.length || 0
        const countB = communityB?.memberCount || communityB?.members.length || 0

        return countB - countA
      })

      setDomains(sortedByMemberCount)
      console.log('[FollowingDomains] Sorted by member count')
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
