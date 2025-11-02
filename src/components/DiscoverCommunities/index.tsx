import { Skeleton } from '@/components/ui/skeleton'
import { toNip05Community } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import nip05CommunityService from '@/services/nip05-community.service'
import { TAwesomeNip05CommunityCollection, TNip05Community } from '@/types'
import { useEffect, useState } from 'react'
import Nip05CommunityCard from '../Nip05CommunityCard'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { cn } from '@/lib/utils'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'
import SearchInput from '../SearchInput'
import { useTranslation } from 'react-i18next'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'

export default function DiscoverCommunities() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [collections, setCollections] = useState<TAwesomeNip05CommunityCollection[] | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState('')
  const [searchResults, setSearchResults] = useState<TNip05Community[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [suggestedDomains, setSuggestedDomains] = useState<string[]>([])
  const [trendingCommunities, setTrendingCommunities] = useState<TNip05Community[]>([])

  useEffect(() => {
    nip05CommunityService.getAwesomeCommunityCollections().then(setCollections)
  }, [])

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInput(searchInput.trim())
    }, 500)

    return () => {
      clearTimeout(handler)
    }
  }, [searchInput])

  // Perform search
  useEffect(() => {
    if (!debouncedInput) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    nip05CommunityService
      .search(debouncedInput)
      .then((results) => {
        setSearchResults(results)
      })
      .finally(() => {
        setIsSearching(false)
      })
  }, [debouncedInput])

  // Fetch suggested domains based on user's follows
  useEffect(() => {
    if (!pubkey) return

    const fetchSuggestedDomains = async () => {
      try {
        const followings = await client.fetchFollowings(pubkey)
        if (!followings || followings.length === 0) return

        // Fetch profiles for followings
        const profiles = await Promise.all(
          followings.slice(0, 100).map((followingPubkey) => client.fetchProfile(followingPubkey))
        )

        // Extract domains from NIP-05 identifiers
        const domainMap = new Map<string, number>()
        profiles.forEach((profile) => {
          if (profile?.nip05) {
            const parts = profile.nip05.split('@')
            if (parts.length === 2) {
              const domain = parts[1].toLowerCase().trim()
              if (domain) {
                domainMap.set(domain, (domainMap.get(domain) || 0) + 1)
              }
            }
          }
        })

        // Sort by popularity and take top 6
        const topDomains = Array.from(domainMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([domain]) => domain)

        setSuggestedDomains(topDomains)
      } catch (error) {
        console.error('Error fetching suggested domains:', error)
      }
    }

    fetchSuggestedDomains()
  }, [pubkey])

  // Fetch trending communities (cached communities sorted by member count)
  useEffect(() => {
    const fetchTrendingCommunities = async () => {
      try {
        const allCommunities = await nip05CommunityService.getAllCommunities()
        const sorted = allCommunities
          .filter((c) => c.memberCount && c.memberCount > 0)
          .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
          .slice(0, 6)
        setTrendingCommunities(sorted)
      } catch (error) {
        console.error('Error fetching trending communities:', error)
      }
    }

    fetchTrendingCommunities()
  }, [])

  if (!collections) {
    return (
      <div>
        <div className="p-4 max-md:border-b">
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="grid md:px-4 md:grid-cols-2 md:gap-2">
          <Skeleton className="h-24 px-4 py-3 md:rounded-lg md:border" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="px-4 pt-4">
        <SearchInput
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('Search communities by domain or name...')}
        />
      </div>

      {/* Search Results */}
      {debouncedInput && (
        <div>
          <div className="px-4 py-3 text-xl font-semibold border-b">
            {t('Search Results')}
          </div>
          {isSearching ? (
            <div className="grid md:px-4 md:grid-cols-2 md:gap-3">
              <Skeleton className="h-24 px-4 py-3 md:rounded-lg md:border" />
              <Skeleton className="h-24 px-4 py-3 md:rounded-lg md:border" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid md:px-4 md:grid-cols-2 md:gap-3">
              {searchResults.map((community) => (
                <CommunityItemWithData key={community.domain} community={community} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-muted-foreground">
              {t('No communities found')}
            </div>
          )}
        </div>
      )}

      {/* Only show curated collections when not searching */}
      {!debouncedInput && (
        <>
          {/* Suggested Domains (based on follows) */}
          {pubkey && suggestedDomains.length > 0 && (
            <SuggestedDomainsSection domains={suggestedDomains} />
          )}

          {/* Trending Communities */}
          {trendingCommunities.length > 0 && (
            <TrendingCommunitiesSection communities={trendingCommunities} />
          )}

          {/* Curated Collections */}
          {collections.map((collection) => (
            <CommunityCollection key={collection.id} collection={collection} />
          ))}
        </>
      )}
    </div>
  )
}

function SuggestedDomainsSection({ domains }: { domains: string[] }) {
  const { t } = useTranslation()
  const { deepBrowsing } = useDeepBrowsing()

  return (
    <div>
      <div
        className={cn(
          'sticky bg-background z-20 px-4 py-3 text-2xl font-semibold max-md:border-b',
          deepBrowsing ? 'top-12' : 'top-24'
        )}
      >
        {t('Suggested for You')}
      </div>
      <div className="px-4 pb-2 text-sm text-muted-foreground">
        {t('Based on people you follow')}
      </div>
      <div className="grid md:px-4 md:grid-cols-2 md:gap-3">
        {domains.map((domain) => (
          <CommunityItem key={domain} domain={domain} />
        ))}
      </div>
    </div>
  )
}

function TrendingCommunitiesSection({ communities }: { communities: TNip05Community[] }) {
  const { t } = useTranslation()
  const { deepBrowsing } = useDeepBrowsing()

  return (
    <div>
      <div
        className={cn(
          'sticky bg-background z-20 px-4 py-3 text-2xl font-semibold max-md:border-b',
          deepBrowsing ? 'top-12' : 'top-24'
        )}
      >
        {t('Trending Communities')}
      </div>
      <div className="px-4 pb-2 text-sm text-muted-foreground">
        {t('Most active domain communities')}
      </div>
      <div className="grid md:px-4 md:grid-cols-2 md:gap-3">
        {communities.map((community) => (
          <CommunityItemWithData key={community.domain} community={community} />
        ))}
      </div>
    </div>
  )
}

function CommunityCollection({
  collection
}: {
  collection: TAwesomeNip05CommunityCollection
}) {
  const { deepBrowsing } = useDeepBrowsing()
  return (
    <div>
      <div
        className={cn(
          'sticky bg-background z-20 px-4 py-3 text-2xl font-semibold max-md:border-b',
          deepBrowsing ? 'top-12' : 'top-24'
        )}
      >
        {collection.name}
      </div>
      {collection.description && (
        <div className="px-4 pb-2 text-sm text-muted-foreground">{collection.description}</div>
      )}
      <div className="grid md:px-4 md:grid-cols-2 md:gap-3">
        {collection.domains.map((domain) => (
          <CommunityItem key={domain} domain={domain} />
        ))}
      </div>
    </div>
  )
}

function CommunityItem({ domain }: { domain: string }) {
  const { push } = useSecondaryPage()
  const { favoriteDomains, addFavoriteDomains, deleteFavoriteDomains } = useNip05Communities()
  const [community, setCommunity] = useState<TNip05Community | null | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  const isFavorite = favoriteDomains.includes(domain)

  useEffect(() => {
    setIsLoading(true)
    nip05CommunityService
      .getCommunity(domain)
      .then((data) => {
        setCommunity(data || null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [domain])

  if (isLoading) {
    return <Skeleton className="h-24 px-4 py-3 border-b md:rounded-lg md:border" />
  }

  if (!community) {
    return null
  }

  return (
    <div
      className="clickable border-b md:rounded-lg md:border"
      onClick={(e) => {
        e.stopPropagation()
        push(toNip05Community(domain))
      }}
    >
      <Nip05CommunityCard
        community={community}
        select={isFavorite}
        onSelectChange={(select) => {
          if (select) {
            addFavoriteDomains([domain])
          } else {
            deleteFavoriteDomains([domain])
          }
        }}
        showMembers
      />
    </div>
  )
}

function CommunityItemWithData({ community }: { community: TNip05Community }) {
  const { push } = useSecondaryPage()
  const { favoriteDomains, addFavoriteDomains, deleteFavoriteDomains } = useNip05Communities()

  const isFavorite = favoriteDomains.includes(community.domain)

  return (
    <div
      className="clickable border-b md:rounded-lg md:border"
      onClick={(e) => {
        e.stopPropagation()
        push(toNip05Community(community.domain))
      }}
    >
      <Nip05CommunityCard
        community={community}
        select={isFavorite}
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
  )
}
