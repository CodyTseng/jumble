import { Separator } from '@/components/ui/separator'
import { toRelay } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { TNip66RelayInfo } from '@/types'
import RelayBadges from '../RelayBadges'
import RelayIcon from '../RelayIcon'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'

export default function RelayCard({
  relayInfo,
  className
}: {
  relayInfo: TNip66RelayInfo
  className?: string
}) {
  const { push } = useSecondaryPage()

  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        push(toRelay(relayInfo.url))
      }}
    >
      <div className="clickable pl-4 pr-1 py-3 flex items-center gap-2 justify-between">
        <div className="flex-1 w-0 space-y-1">
          <div className="flex items-center gap-2 w-full">
            <RelayIcon url={relayInfo.url} className="h-8 w-8" />
            <div className="flex-1 w-0">
              <div className="truncate font-semibold">{relayInfo.name ?? relayInfo.shortUrl}</div>
              {relayInfo.name && (
                <div className="text-xs text-muted-foreground truncate">{relayInfo.shortUrl}</div>
              )}
            </div>
          </div>
          <RelayBadges relayInfo={relayInfo} />
          {!!relayInfo?.description && <div className="line-clamp-4">{relayInfo.description}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <SaveRelayDropdownMenu urls={[relayInfo.url]} />
        </div>
      </div>
      <Separator />
    </div>
  )
}
