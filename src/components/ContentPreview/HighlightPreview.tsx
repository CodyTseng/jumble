import { useTranslatedEvent } from '@/hooks'
import { getEmojiInfosFromEmojiTags } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Content from './Content'

export default function HighlightPreview({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { t } = useTranslation()
  const translatedEvent = useTranslatedEvent(event.id)
  const emojiInfos = useMemo(() => getEmojiInfosFromEmojiTags(event.tags), [event])

  return (
    <div className={cn('pointer-events-none', className)}>
      [{t('Highlight')}]{' '}
      <Content
        content={translatedEvent?.content ?? event.content}
        emojiInfos={emojiInfos}
        className="pe-0.5 italic"
      />
    </div>
  )
}
