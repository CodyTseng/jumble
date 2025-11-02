import { Skeleton } from '@/components/ui/skeleton'
import { toNip05Community } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import nip05CommunityService from '@/services/nip05-community.service'
import { TAwesomeNip05CommunityCollection } from '@/types'
import { useEffect, useState } from 'react'
import Nip05CommunityCard from '../Nip05CommunityCard'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { cn } from '@/lib/utils'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'

export default function DiscoverCommunities() {
  const [collections, setCollections] = useState<TAwesomeNip05CommunityCollection[] | null>(null)

  useEffect(() => {
    nip05CommunityService.getAwesomeCommunityCollections().then(setCollections)
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
      {collections.map((collection) => (
        <CommunityCollection key={collection.id} collection={collection} />
      ))}
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
  const [community, setCommunity] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isFavorite = favoriteDomains.includes(domain)

  useEffect(() => {
    setIsLoading(true)
    nip05CommunityService
      .getCommunity(domain)
      .then((data) => {
        setCommunity(data)
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
