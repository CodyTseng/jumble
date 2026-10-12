import { getImetaInfosFromEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import { CONTENT_LAYOUT_CLASS_NAME } from '../Content/node-layout'
import ImageGallery from '../ImageGallery'

export default function PictureNote({ event, className }: { event: Event; className?: string }) {
  const imageInfos = useMemo(() => getImetaInfosFromEvent(event), [event])

  return (
    <div className={cn(CONTENT_LAYOUT_CLASS_NAME, className)}>
      <Content event={event} />
      {imageInfos.length > 0 && <ImageGallery images={imageInfos} />}
    </div>
  )
}
