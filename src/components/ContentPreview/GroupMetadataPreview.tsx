import { getGroupMetadataFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function GroupMetadataPreview({
  event,
  className,
  onClick
}: {
  event: Event
  className?: string
  onClick?: React.MouseEventHandler<HTMLDivElement> | undefined
}) {
  const { t } = useTranslation()
  const metadata = useMemo(() => getGroupMetadataFromEvent(event), [event])

  return (
    <div className={cn('pointer-events-none', className)} onClick={onClick}>
      [{t('Group')}] <span className="italic pr-0.5">{metadata.name}</span>
    </div>
  )
}
