import { getImetaInfosFromEvent } from '@/lib/event'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import ImageGallery from '../ImageGallery'

export default function PictureNote({ event, className }: { event: Event; className?: string }) {
  const imageInfos = useMemo(() => getImetaInfosFromEvent(event), [event])

  return (
    <div className={className}>
      <Content event={event} />
      {imageInfos.length > 0 && <ImageGallery images={imageInfos} />}
    </div>
  )
}
