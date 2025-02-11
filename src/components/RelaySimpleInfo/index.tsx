import { cn } from '@/lib/utils'
import { TNip66RelayInfo } from '@/types'
import RelayBadges from '../RelayBadges'
import RelayIcon from '../RelayIcon'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'
import { HTMLProps } from 'react'

export default function RelaySimpleInfo({
  relayInfo,
  hideBadge = false,
  className,
  ...props
}: HTMLProps<HTMLDivElement> & {
  relayInfo?: TNip66RelayInfo
  hideBadge?: boolean
}) {
  return (
    <div className={cn('space-y-1', className)} {...props}>
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="flex flex-1 w-0 items-center gap-2">
          <RelayIcon url={relayInfo?.url} className="h-9 w-9" />
          <div className="flex-1 w-0">
            <div className="truncate font-semibold">{relayInfo?.name || relayInfo?.shortUrl}</div>
            {relayInfo?.name && (
              <div className="text-xs text-muted-foreground truncate">{relayInfo?.shortUrl}</div>
            )}
          </div>
        </div>
        {relayInfo && <SaveRelayDropdownMenu urls={[relayInfo.url]} />}
      </div>
      {!hideBadge && relayInfo && <RelayBadges relayInfo={relayInfo} />}
      {!!relayInfo?.description && <div className="line-clamp-4">{relayInfo.description}</div>}
    </div>
  )
}
