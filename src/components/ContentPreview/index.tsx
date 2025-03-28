import { extractEmbeddedNotesFromContent, extractImagesFromContent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  embedded,
  embeddedNostrNpubTextRenderer,
  embeddedNostrProfileTextRenderer
} from '../Embedded'

export default function ContentPreview({
  event,
  className
}: {
  event?: Event
  className?: string
}) {
  const { t } = useTranslation()
  const content = useMemo(() => {
    if (!event) return `[${t('Not found the note')}]`
    const { contentWithoutEmbeddedNotes, embeddedNotes } = extractEmbeddedNotesFromContent(
      event.content
    )
    const { contentWithoutImages, images } = extractImagesFromContent(contentWithoutEmbeddedNotes)
    const contents = [contentWithoutImages]
    if (images?.length) {
      contents.push(`[${t('image')}]`)
    }
    if (embeddedNotes.length) {
      contents.push(`[${t('note')}]`)
    }
    return embedded(contents.join(' '), [
      embeddedNostrProfileTextRenderer,
      embeddedNostrNpubTextRenderer
    ])
  }, [event])

  return <div className={cn('pointer-events-none', className)}>{content}</div>
}
