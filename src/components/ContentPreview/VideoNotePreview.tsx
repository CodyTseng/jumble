import { ExtendedKind } from '@/constants'
import { getVideoMetadataFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function VideoNotePreview({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { t } = useTranslation()
  const isAddressable =
    event.kind === ExtendedKind.ADDRESSABLE_NORMAL_VIDEO ||
    event.kind === ExtendedKind.ADDRESSABLE_SHORT_VIDEO
  const metadata = useMemo(
    () => (isAddressable ? getVideoMetadataFromEvent(event) : null),
    [event, isAddressable]
  )

  return (
    <div className={cn('pointer-events-none', className)}>
      [{t('Media')}]{' '}
      <span className="pr-0.5 italic">{metadata?.title || event.content}</span>
    </div>
  )
}
