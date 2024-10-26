import {
  embedded,
  embeddedHashtagRenderer,
  embeddedNormalUrlRenderer,
  embeddedNostrNpubRenderer,
  embeddedNostrProfileRenderer
} from '@renderer/embedded'
import { isNsfwEvent } from '@renderer/lib/event'
import { cn } from '@renderer/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { EmbeddedNote } from '../Embedded'
import ImageGallery from '../ImageGallery'
import VideoPlayer from '../VideoPlayer'

export default function Content({ event, className }: { event: Event; className?: string }) {
  const nodes = useMemo(() => {
    const { content, images, videos, embeddedNotes } = preprocess(event.content)
    const isNsfw = isNsfwEvent(event)
    const nodes = embedded(
      [content],
      [
        embeddedNormalUrlRenderer,
        embeddedHashtagRenderer,
        embeddedNostrNpubRenderer,
        embeddedNostrProfileRenderer
      ]
    )

    // Add images
    if (images.length) {
      nodes.push(
        <ImageGallery className="mt-2 w-fit" key="images" images={images} isNsfw={isNsfw} />
      )
    }

    // Add videos
    if (videos.length) {
      videos.forEach((src, index) => {
        nodes.push(
          <VideoPlayer className="mt-2" key={`video-${index}`} src={src} isNsfw={isNsfw} />
        )
      })
    }

    // Add embedded notes
    if (embeddedNotes.length) {
      embeddedNotes.forEach((note, index) => {
        const id = note.split(':')[1]
        nodes.push(<EmbeddedNote key={`embedded-event-${index}`} noteId={id} />)
      })
    }

    return nodes
  }, [event.id])

  return (
    <div className={cn('text-sm text-wrap break-words whitespace-pre-wrap', className)}>
      {nodes}
    </div>
  )
}

function preprocess(content: string) {
  const urlRegex = /(https?:\/\/[^\s"']+)/g
  const urls = content.match(urlRegex) || []

  let c = content
  const images: string[] = []
  const videos: string[] = []

  urls.forEach((url) => {
    if (isImage(url)) {
      c = c.replace(url, '').trim()
      images.push(url)
    } else if (isVideo(url)) {
      c = c.replace(url, '').trim()
      videos.push(url)
    }
  })

  const embeddedNotes: string[] = []
  const embeddedNoteRegex = /(nostr:note1[a-z0-9]{58}|nostr:nevent1[a-z0-9]+)/g
  ;(c.match(embeddedNoteRegex) || []).forEach((note) => {
    c = c.replace(note, '').trim()
    embeddedNotes.push(note)
  })

  return { content: c, images, videos, embeddedNotes }
}

function isImage(url: string) {
  try {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', 'webp', 'heic', 'svg']
    return imageExtensions.some((ext) => new URL(url).pathname.toLowerCase().endsWith(ext))
  } catch {
    return false
  }
}

function isVideo(url: string) {
  try {
    const videoExtensions = ['.mp4', '.webm', '.ogg']
    return videoExtensions.some((ext) => new URL(url).pathname.toLowerCase().endsWith(ext))
  } catch {
    return false
  }
}
