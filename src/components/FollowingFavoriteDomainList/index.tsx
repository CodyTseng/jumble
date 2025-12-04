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
  const [secondDegreeDomains, setSecondDegreeDomains] = useState<Set<string>>(new Set())
  const [firstFollowingPubkey, setFirstFollowingPubkey] = useState<string | null>(null)
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

      // If user follows ≤5 people, supplement with 2nd degree connections
      let allAuthors = followings
      let secondDegreeAuthors: string[] = []

      if (followings.length <= 5 && followings.length > 0) {
        console.log('[FollowingDomains] Few followings detected, fetching 2nd degree connections...')

        // Use the first person they follow (likely someone they know/trust)
        const firstFollowing = followings[0]
        setFirstFollowingPubkey(firstFollowing)
        console.log('[FollowingDomains] Fetching followings of first connection:', firstFollowing)

        // Fetch their follow list
        const secondDegreeFollowings = await client.fetchFollowings(firstFollowing)

        if (secondDegreeFollowings && secondDegreeFollowings.length > 0) {
          // Limit to first 50 to avoid performance issues
          const limitedSecondDegree = secondDegreeFollowings.slice(0, 50)
          console.log(`[FollowingDomains] Found ${secondDegreeFollowings.length} 2nd degree connections, using first ${limitedSecondDegree.length}`)

          // Remove duplicates (people already in 1st degree)
          secondDegreeAuthors = limitedSecondDegree.filter(pubkey => !followings.includes(pubkey))
          console.log(`[FollowingDomains] After deduplication: ${secondDegreeAuthors.length} unique 2nd degree connections`)

          // Combine 1st and 2nd degree
          allAuthors = [...followings, ...secondDegreeAuthors]
          console.log(`[FollowingDomains] Total authors to fetch: ${allAuthors.length}`)
        }
      } else {
        // Reset 2nd degree tracking if not applicable
        setFirstFollowingPubkey(null)
      }

      // Fetch all profiles in one batch using a single subscription
      // This is much more efficient than individual fetches
      console.log('[FollowingDomains] Fetching all profiles in batch...')
      const profileEvents = await client.fetchEvents([], {
        kinds: [0], // kind 0 = profile metadata
        authors: allAuthors
      })

      console.log(`[FollowingDomains] Fetched ${profileEvents.length} profile events`)

      // Parse profile events and extract NIP-05 domains
      const domainMap = new Map<string, Set<string>>()
      const secondDegreeDomainsSet = new Set<string>()

      profileEvents.forEach((event) => {
        try {
          const profile = JSON.parse(event.content)
          if (profile?.nip05) {
            const nip05 = profile.nip05
            // Extract domain from NIP-05 identifier (e.g., "user@domain.com" -> "domain.com")
            const parts = nip05.split('@')
            if (parts.length === 2) {
              const domain = parts[1].toLowerCase().trim()
              if (domain) {
                const pubkeys = domainMap.get(domain) || new Set()
                pubkeys.add(event.pubkey)
                domainMap.set(domain, pubkeys)

                // Track if this domain came from a 2nd degree connection
                if (secondDegreeAuthors.includes(event.pubkey)) {
                  secondDegreeDomainsSet.add(domain)
                }
              }
            }
          }
        } catch (error) {
          // Skip invalid profile JSON
        }
      })

      // Update state with 2nd degree domains
      setSecondDegreeDomains(secondDegreeDomainsSet)
      console.log('[FollowingDomains] Found unique domains:', domainMap.size)
      console.log('[FollowingDomains] 2nd degree domains:', secondDegreeDomainsSet.size)

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
              let community: TNip05Community | undefined

              // Try to fetch from nostr.json for actual member count
              console.log('[FollowingDomains] Fetching data for:', domain)
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
                  // Save to service cache immediately
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
                // Fetch failed (CORS, network, etc.) - drop this community from the list
                // We don't want to show communities without proper nostr.json
                console.log('[FollowingDomains] Dropping community (nostr.json fetch failed):', domain)
                return { domain, community: undefined }
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
          isSecondDegree={secondDegreeDomains.has(domain)}
          firstFollowingPubkey={firstFollowingPubkey}
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
              {allDomains.length > 0 ? (
                // User has followings with communities, just wrong size filter
                <>
                  <p>{t('no communities found')}</p>
                  <p className="mt-1 text-xs">
                    {t('Try a different size filter. Total communities')}: {allDomains.length}
                  </p>
                </>
              ) : (
                // New user with no followings - encourage them to follow others
                <>
                  <p className="text-base mb-2">{t('No communities to show yet')}</p>
                  <p className="text-xs">
                    {t('Follow others to discover their communities and see them here')}
                  </p>
                </>
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
  isSecondDegree,
  firstFollowingPubkey,
  onFavoriteChange
}: {
  community?: TNip05Community
  isFavorite: boolean
  isSecondDegree: boolean
  firstFollowingPubkey: string | null
  onFavoriteChange: (select: boolean) => void
}) {
  const [firstFollowingProfile, setFirstFollowingProfile] = useState<any>(null)

  // Fetch the first following's profile to show their name
  useEffect(() => {
    if (isSecondDegree && firstFollowingPubkey) {
      client.fetchProfile(firstFollowingPubkey).then((profile) => {
        if (profile) {
          setFirstFollowingProfile(profile)
        }
      })
    }
  }, [isSecondDegree, firstFollowingPubkey])

  // Community should always exist since we filter for valid nostr.json
  // But provide fallback for type safety
  if (!community) {
    return null
  }

  const firstFollowingName = firstFollowingProfile?.displayName || firstFollowingProfile?.name || 'someone you follow'

  return (
    <div className="p-4 border-b">
      <Nip05CommunityCard
        community={community}
        select={isFavorite}
        onSelectChange={onFavoriteChange}
        showMembers
      />
      {isSecondDegree && (
        <div className="mt-2 text-xs text-muted-foreground italic">
          From {firstFollowingName}'s network
        </div>
      )}
    </div>
  )
}
