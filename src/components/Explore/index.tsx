import { Skeleton } from '@/components/ui/skeleton'
import { useFetchRelayInfo } from '@/hooks'
import { toRelay } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import relayInfoService from '@/services/relay-info.service'
import { TAwesomeRelayCollection } from '@/types'
import { useEffect, useState } from 'react'
import RelaySimpleInfo, { RelaySimpleInfoSkeleton } from '../RelaySimpleInfo'

export default function Explore() {
  const [collections, setCollections] = useState<TAwesomeRelayCollection[] | null>(null)

  useEffect(() => {
    relayInfoService.getAwesomeRelayCollections().then(setCollections)
  }, [])

  if (!collections) {
    return (
      <div>
        <div className="p-4 max-md:border-b">
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="md:px-4 space-y-2">
          <RelaySimpleInfoSkeleton className="h-auto px-4 py-3 md:rounded-lg md:border" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {collections.map((collection) => (
        <RelayCollection key={collection.id} collection={collection} />
      ))}
    </div>
  )
}

function RelayCollection({ collection }: { collection: TAwesomeRelayCollection }) {
  return (
    <div className="-mt-6 first:mt-0 pt-6">
      <div className="bg-background px-4 py-3 text-base font-semibold max-md:border-b -mt-6">
        {collection.name}
      </div>
      <div className="md:px-4 space-y-2">
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
    return <RelaySimpleInfoSkeleton className="h-auto px-4 py-2 border-b md:rounded-lg md:border" />
  }

  if (!relayInfo) {
    return null
  }

  return (
    <RelaySimpleInfo
      key={relayInfo.url}
      className="clickable h-auto px-4 py-2 border-b md:rounded-lg md:border"
      relayInfo={relayInfo}
      compact
      showPinButton
      onClick={(e) => {
        e.stopPropagation()
        push(toRelay(relayInfo.url))
      }}
    />
  )
}
