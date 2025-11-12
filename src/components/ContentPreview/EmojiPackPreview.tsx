import { getEmojiPackInfoFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function EmojiPackPreview({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { t } = useTranslation()
  const { title, emojis } = useMemo(() => getEmojiPackInfoFromEvent(event), [event])

  return (
    <div className={cn('pointer-events-none', className)}>
      [{t('Emoji Pack')}] <span className="italic pr-0.5">{title}</span>
      {emojis.length > 0 && <span>({emojis.length})</span>}
    </div>
  )
}
