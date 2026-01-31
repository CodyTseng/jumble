import { Skeleton } from '@/components/ui/skeleton'
import { IS_COMMUNITY_MODE } from '@/constants'
import { createFakeEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { TRelayInfo } from '@/types'
import { HTMLProps } from 'react'
import { useTranslation } from 'react-i18next'
import ContentPreview from '../ContentPreview'
import RelayIcon from '../RelayIcon'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'
import { SimpleUserAvatar } from '../UserAvatar'

export default function RelaySimpleInfo({
  relayInfo,
  users,
  className,
  ...props
}: HTMLProps<HTMLDivElement> & {
  relayInfo?: TRelayInfo
  users?: string[]
}) {
  const { t } = useTranslation()

  return (
    <div className={cn('space-y-1', className)} {...props}>
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex w-0 flex-1 items-center gap-2">
          <RelayIcon url={relayInfo?.url} className="h-9 w-9" />
          <div className="w-0 flex-1">
            <div className="truncate font-semibold">{relayInfo?.name || relayInfo?.shortUrl}</div>
            {relayInfo?.name && (
              <div className="truncate text-xs text-muted-foreground">{relayInfo?.shortUrl}</div>
            )}
          </div>
        </div>
        {relayInfo && !IS_COMMUNITY_MODE && <SaveRelayDropdownMenu urls={[relayInfo.url]} />}
      </div>
      {!!relayInfo?.description && (
        <div className="line-clamp-3 whitespace-pre-wrap break-words">
          <ContentPreview event={createFakeEvent({ content: relayInfo.description })} />
        </div>
      )}
      {!!users?.length && (
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{t('Favorited by')} </div>
          <div className="flex items-center gap-1">
            {users.slice(0, 10).map((user) => (
              <SimpleUserAvatar key={user} userId={user} size="xSmall" />
            ))}
            {users.length > 10 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                +{users.length - 10}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function RelaySimpleInfoSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex w-full items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="w-0 flex-1 space-y-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
