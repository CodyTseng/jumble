import { Skeleton } from '@/components/ui/skeleton'
import { fetchPubkeysFromDomain } from '@/lib/nip05'
import { useNostr } from '@/providers/NostrProvider'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'
import client from '@/services/client.service'
import nip05CommunityService from '@/services/nip05-community.service'
import { TNip05Community } from '@/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Nip05CommunityCard from '../Nip05CommunityCard'

const SHOW_COUNT = 10

type TCommunitySizeFilter = 'small' | 'medium' | 'large'

export default function FollowingFavoriteDomainList({
  sizeFilter = 'large'
}: {
  sizeFilter?: TCommunitySizeFilter
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { favoriteDomains, addFavoriteDomains, deleteFavoriteDomains, getCommunity } =
    useNip05Communities()
  const [loading, setLoading] = useState(true)
  const [allDomains, setAllDomains] = useState<[string, string[]][]>([])
  const [communities, setCommunities] = useState<Map<string, TNip05Community>>(new Map())
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)

    const init = async () => {
      if (!pubkey) {
        setAllDomains([])
        setLoading(false)
        return
      }

      console.log('[FollowingDomains] Fetching followings for:', pubkey)

      // Fetch followings
      const followings = await client.fetchFollowings(pubkey)
      if (!followings || followings.length === 0) {
        console.log('[FollowingDomains] No followings found')
        setAllDomains([])
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

      // Convert to sorted array (by user count descending) - this is just initial grouping
      const sortedDomains = Array.from(domainMap.entries())
        .map(([domain, pubkeys]) => [domain, Array.from(pubkeys)] as [string, string[]])
        .sort((a, b) => b[1].length - a[1].length)

      // Don't set allDomains yet - wait until we have community data and can sort properly

      // Fetch community data for ALL domains in the background
      // This ensures we have nostr.json data for each community
      console.log('[FollowingDomains] Fetching community data for', sortedDomains.length, 'domains')

      // Fetch in batches to avoid overwhelming the system
      const communityBatchSize = 5
      const communityMap = new Map<string, TNip05Community>()

      for (let i = 0; i < sortedDomains.length; i += communityBatchSize) {
        const batch = sortedDomains.slice(i, i + communityBatchSize)
        const communityData = await Promise.all(
          batch.map(async ([domain, followedPubkeys]) => {
            try {
              // First try to get cached data from the service
              let community = await getCommunity(domain)

              // Check if cached data has full member list (not just followed users)
              const hasCachedFullData =
                community && community.members && community.members.length > followedPubkeys.length

              // If no cached full data, try to fetch from nostr.json
              if (!hasCachedFullData) {
                console.log('[FollowingDomains] Fetching fresh data for:', domain)
                try {
                  const members = await fetchPubkeysFromDomain(domain)
                  if (members.length > 0) {
                    community = {
                      id: domain,
                      domain,
                      members,
                      memberCount: members.length,
                      lastUpdated: Date.now()
                    }
                    // Save to service cache
                    await nip05CommunityService.addCommunity(community)
                    console.log(
                      '[FollowingDomains] Successfully fetched:',
                      domain,
                      members.length,
                      'members'
                    )
                  } else {
                    // nostr.json returned empty, fall back to followed users
                    throw new Error('Empty nostr.json')
                  }
                } catch (fetchError) {
                  // Fetch failed (CORS, network, etc.), use followed users as fallback
                  console.warn('[FollowingDomains] Fetch failed, using followed users for:', domain)
                  community = {
                    id: domain,
                    domain,
                    members: followedPubkeys,
                    memberCount: followedPubkeys.length,
                    lastUpdated: Date.now()
                  }
                  // Save fallback data to cache
                  await nip05CommunityService.addCommunity(community)
                }
              }

              return { domain, community }
            } catch (error) {
              console.error('[FollowingDomains] Error processing community:', domain, error)
              return { domain, community: undefined }
            }
          })
        )

        communityData.forEach(({ domain, community }) => {
          if (community) {
            communityMap.set(domain, community)
          }
        })

        console.log(`[FollowingDomains] Fetched ${communityMap.size}/${sortedDomains.length} communities`)

        // Update states incrementally so communities show up as they load
        const currentDomainsWithNostrJson = sortedDomains.filter(([domain]) => {
          const community = communityMap.get(domain)
          return community && community.members && community.members.length > 0
        })

        const currentSorted = currentDomainsWithNostrJson.sort((a, b) => {
          const communityA = communityMap.get(a[0])
          const communityB = communityMap.get(b[0])

          const countA = communityA?.memberCount || communityA?.members.length || 0
          const countB = communityB?.memberCount || communityB?.members.length || 0

          return countB - countA
        })

        setCommunities(new Map(communityMap))
        setAllDomains(currentSorted)
      }

      // Final logging after all batches complete
      console.log('[FollowingDomains] All communities fetched and sorted')

      // Log the top 10 for debugging
      const finalDomains = allDomains.length > 0 ? allDomains : sortedDomains
      finalDomains.slice(0, 10).forEach(([domain], index) => {
        const community = communityMap.get(domain)
        const count = community?.memberCount || community?.members.length || 0
        console.log(`  ${index + 1}. ${domain} - ${count} members`)
      })

      // Log size distribution
      const validDomains = sortedDomains.filter(([domain]) => communityMap.get(domain))
      const small = validDomains.filter(([domain]) => {
        const c = communityMap.get(domain)
        const count = c?.memberCount || c?.members.length || 0
        return count < 21
      }).length
      const medium = validDomains.filter(([domain]) => {
        const c = communityMap.get(domain)
        const count = c?.memberCount || c?.members.length || 0
        return count >= 21 && count <= 500
      }).length
      const large = validDomains.filter(([domain]) => {
        const c = communityMap.get(domain)
        const count = c?.memberCount || c?.members.length || 0
        return count > 500
      }).length

      console.log(`[FollowingDomains] Size distribution:`)
      console.log(`  Small (<21): ${small}`)
      console.log(`  Medium (21-500): ${medium}`)
      console.log(`  Large (>500): ${large}`)
    }
    init().finally(() => {
      setLoading(false)
    })
  }, [pubkey, getCommunity])

  // Filter domains based on size
  const domains = useMemo(() => {
    const filtered = allDomains.filter(([domain]) => {
      const community = communities.get(domain)
      if (!community) return false

      const memberCount = community.memberCount || community.members.length

      if (sizeFilter === 'small') {
        return memberCount < 21
      } else if (sizeFilter === 'medium') {
        return memberCount >= 21 && memberCount <= 500
      } else {
        // large
        return memberCount > 500
      }
    })

    console.log(`[FollowingDomains] Filter '${sizeFilter}': ${filtered.length} communities`)
    return filtered
  }, [allDomains, communities, sizeFilter])

  // Reset show count when size filter changes
  useEffect(() => {
    setShowCount(SHOW_COUNT)
  }, [sizeFilter])

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
      {domains.slice(0, showCount).map(([domain]) => (
        <DomainItem
          key={domain}
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
        <div className="text-center text-muted-foreground text-sm mt-2 p-4">
          {domains.length === 0 ? (
            <div>
              <p>{t('no communities found')}</p>
              {allDomains.length > 0 && (
                <p className="mt-1 text-xs">
                  {t('Try a different size filter. Total communities')}: {allDomains.length}
                </p>
              )}
            </div>
          ) : (
            t('no more domains')
          )}
        </div>
      )}
    </div>
  )
}

function DomainItem({
  community,
  isFavorite,
  onFavoriteChange
}: {
  community?: TNip05Community
  isFavorite: boolean
  onFavoriteChange: (select: boolean) => void
}) {
  // Community should always exist since we filter for valid nostr.json
  // But provide fallback for type safety
  if (!community) {
    return null
  }

  return (
    <div className="p-4 border-b">
      <Nip05CommunityCard
        community={community}
        select={isFavorite}
        onSelectChange={onFavoriteChange}
        showMembers
      />
    </div>
  )
}
