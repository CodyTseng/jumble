import { Skeleton } from '@/components/ui/skeleton'
import { useFetchRelayInfo } from '@/hooks'
import { toRelay } from '@/lib/link'
import { recommendRelaysByLanguage } from '@/lib/relay'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import relayInfoService from '@/services/relay-info.service'
import { TAwesomeRelayCollection } from '@/types'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelaySimpleInfo, { RelaySimpleInfoSkeleton } from '../RelaySimpleInfo'

export default function Explore() {
  const { t, i18n } = useTranslation()
  const [collections, setCollections] = useState<TAwesomeRelayCollection[] | null>(null)
  const recommendedRelays = useMemo(() => {
    const lang = i18n.language
    const relays = recommendRelaysByLanguage(lang)
    return relays
  }, [i18n.language])

  useEffect(() => {
    relayInfoService.getAwesomeRelayCollections().then(setCollections)
  }, [])

  if (!collections && recommendedRelays.length === 0) {
    return (
      <div>
        <div className="p-4 max-md:border-b">
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="grid md:px-4 md:grid-cols-2 md:gap-2">
          <RelaySimpleInfoSkeleton className="h-auto px-4 py-3 md:rounded-lg md:border" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {recommendedRelays.length > 0 && (
        <RelayCollection
          collection={{
            id: 'recommended',
            name: t('Recommended'),
            relays: recommendedRelays
          }}
        />
      )}
      {collections &&
        collections.map((collection) => (
          <RelayCollection key={collection.id} collection={collection} />
        ))}
    </div>
  )
}

function RelayCollection({ collection }: { collection: TAwesomeRelayCollection }) {
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
      <div className="grid md:px-4 md:grid-cols-2 md:gap-3">
        {collection.relays.map((url) => (
          <RelayItem key={url} url={url} />
        ))}
      </div>
    </div>
  )
}

function RelayItem({ url }: { url: string }) {
  const { push } = useSecondaryPage()
  const { relayInfo, isFetching } = useFetchRelayInfo(url)

  if (isFetching) {
    return <RelaySimpleInfoSkeleton className="h-auto px-4 py-3 border-b md:rounded-lg md:border" />
  }

  if (!relayInfo) {
    return null
  }

  return (
    <RelaySimpleInfo
      key={relayInfo.url}
      className="clickable h-auto px-4 py-3 border-b md:rounded-lg md:border"
      relayInfo={relayInfo}
      onClick={(e) => {
        e.stopPropagation()
        push(toRelay(relayInfo.url))
      }}
    />
  )
}
