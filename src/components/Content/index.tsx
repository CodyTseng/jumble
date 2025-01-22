import { URL_REGEX } from '@/constants'
import { isNsfwEvent, isPictureEvent } from '@/lib/event'
import { extractImageInfoFromTag } from '@/lib/tag'
import { isImage, isVideo } from '@/lib/url'
import { cn } from '@/lib/utils'
import { TImageInfo } from '@/types'
import { Event } from 'nostr-tools'
import { memo } from 'react'
import {
  embedded,
  embeddedHashtagRenderer,
  embeddedNormalUrlRenderer,
  embeddedNostrNpubRenderer,
  embeddedNostrProfileRenderer,
  EmbeddedNote,
  embeddedWebsocketUrlRenderer
} from '../Embedded'
import ImageGallery from '../ImageGallery'
import VideoPlayer from '../VideoPlayer'
import WebPreview from '../WebPreview'

const Content = memo(
  ({
    event,
    className,
    size = 'normal',
    disableLightbox = false
  }: {
    event: Event
    className?: string
    size?: 'normal' | 'small'
    disableLightbox?: boolean
  }) => {
    const { content, images, videos, embeddedNotes, lastNonMediaUrl } = preprocess(event)
    const isNsfw = isNsfwEvent(event)
    const nodes = embedded(content, [
      embeddedNormalUrlRenderer,
      embeddedWebsocketUrlRenderer,
      embeddedHashtagRenderer,
      embeddedNostrNpubRenderer,
      embeddedNostrProfileRenderer
    ])

    // Add images
    if (images.length) {
      nodes.push(
        <ImageGallery
          className={`${size === 'small' ? 'mt-1' : 'mt-2'}`}
          key={`image-gallery-${event.id}`}
          images={images}
          isNsfw={isNsfw}
          size={size}
          disableLightbox={disableLightbox}
        />
      )
    }

    // Add videos
    if (videos.length) {
      videos.forEach((src, index) => {
        nodes.push(
          <VideoPlayer
            className={size === 'small' ? 'mt-1' : 'mt-2'}
            key={`video-${index}-${src}`}
            src={src}
            isNsfw={isNsfw}
            size={size}
          />
        )
      })
    }

    // Add website preview
    if (lastNonMediaUrl) {
      nodes.push(
        <WebPreview
          className={size === 'small' ? 'mt-1' : 'mt-2'}
          key={`web-preview-${event.id}`}
          url={lastNonMediaUrl}
          size={size}
        />
      )
    }

    // Add embedded notes
    if (embeddedNotes.length) {
      embeddedNotes.forEach((note, index) => {
        const id = note.split(':')[1]
        nodes.push(
          <EmbeddedNote
            key={`embedded-event-${index}`}
            noteId={id}
            className={size === 'small' ? 'mt-1' : 'mt-2'}
          />
        )
      })
    }

    return <div className={cn('text-wrap break-words whitespace-pre-wrap', className)}>{nodes}</div>
  }
)
Content.displayName = 'Content'
export default Content

function preprocess(event: Event) {
  const content = event.content
  const urls = content.match(URL_REGEX) || []
  let lastNonMediaUrl: string | undefined

  let c = content
  const imageUrls: string[] = []
  const videos: string[] = []

  urls.forEach((url) => {
    if (isImage(url)) {
      c = c.replace(url, '').trim()
      imageUrls.push(url)
    } else if (isVideo(url)) {
      c = c.replace(url, '').trim()
      videos.push(url)
    } else {
      lastNonMediaUrl = url
    }
  })

  const imageInfos = event.tags
    .map((tag) => extractImageInfoFromTag(tag))
    .filter(Boolean) as TImageInfo[]
  const images = isPictureEvent(event)
    ? imageInfos
    : imageUrls.map((url) => {
        const imageInfo = imageInfos.find((info) => info.url === url)
        return imageInfo ?? { url }
      })

  const embeddedNotes: string[] = []
  const embeddedNoteRegex = /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/g
  ;(c.match(embeddedNoteRegex) || []).forEach((note) => {
    c = c.replace(note, '').trim()
    embeddedNotes.push(note)
  })

  c = c.replace(/\n{3,}/g, '\n\n').trim()

  return { content: c, images, videos, embeddedNotes, lastNonMediaUrl }
}
