import { extractEmbeddedNotesFromContent, extractImagesFromContent } from '@/lib/event'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { embedded, embeddedNostrNpubRenderer, embeddedNostrProfileRenderer } from '../../Embedded'

export function ContentPreview({ event }: { event?: Event }) {
  const { t } = useTranslation()
  const content = useMemo(() => {
    if (!event) return null
    const { contentWithoutEmbeddedNotes } = extractEmbeddedNotesFromContent(event.content)
    const { contentWithoutImages, images } = extractImagesFromContent(contentWithoutEmbeddedNotes)
    return embedded(contentWithoutImages + (images?.length ? `[${t('image')}]` : ''), [
      embeddedNostrProfileRenderer,
      embeddedNostrNpubRenderer
    ])
  }, [event])
  if (!event) return null

  return <div className="truncate flex-1 w-0">{content}</div>
}
