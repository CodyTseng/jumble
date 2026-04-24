import { getFollowPackInfoFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowPackPreview({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { t } = useTranslation()
  const { title } = useMemo(() => getFollowPackInfoFromEvent(event), [event])

  return (
    <div className={cn('truncate', className)}>
      [{t('Follow Pack')}] <span className="pe-0.5 italic">{title}</span>
    </div>
  )
}
