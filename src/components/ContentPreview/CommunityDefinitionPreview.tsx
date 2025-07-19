import { getCommunityDefinitionFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function CommunityDefinitionPreview({
  event,
  className,
  onClick
}: {
  event: Event
  className?: string
  onClick?: React.MouseEventHandler<HTMLDivElement> | undefined
}) {
  const { t } = useTranslation()
  const metadata = useMemo(() => getCommunityDefinitionFromEvent(event), [event])

  return (
    <div className={cn('pointer-events-none', className)} onClick={onClick}>
      [{t('Community')}] <span className="italic pr-0.5">{metadata.name}</span>
    </div>
  )
}
