import { extractEmbeddedNotesFromContent, extractImagesFromContent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { embedded, embeddedNostrNpubRenderer, embeddedNostrProfileRenderer } from '../Embedded'

export default function ContentPreview({
  event,
  className
}: {
  event?: Event
  className?: string
}) {
  const { t } = useTranslation()
  const content = useMemo(() => {
    if (!event) return t('Not found')
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
    return embedded(contents.join(' '), [embeddedNostrProfileRenderer, embeddedNostrNpubRenderer])
  }, [event])
  if (!event) return null

  return <div className={cn('pointer-events-none', className)}>{content}</div>
}
