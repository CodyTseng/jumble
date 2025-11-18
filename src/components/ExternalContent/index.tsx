import {
  EmbeddedHashtagParser,
  EmbeddedUrlParser,
  EmbeddedWebsocketUrlParser,
  parseContent
} from '@/lib/content-parser'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { EmbeddedHashtag, EmbeddedLNInvoice, EmbeddedWebsocketUrl } from '../Embedded'
import ImageGallery from '../ImageGallery'
import MediaPlayer from '../MediaPlayer'
import WebPreview from '../WebPreview'
import XEmbeddedPost from '../XEmbeddedPost'
import YoutubeEmbeddedPlayer from '../YoutubeEmbeddedPlayer'

export default function ExternalContent({
  content,
  className,
  mustLoadMedia
}: {
  content?: string
  className?: string
  mustLoadMedia?: boolean
}) {
  const nodes = useMemo(() => {
    if (!content) return []

    return parseContent(content, [
      EmbeddedUrlParser,
      EmbeddedWebsocketUrlParser,
      EmbeddedHashtagParser
    ])
  }, [content])

  if (!nodes || nodes.length === 0) {
    return null
  }

  const node = nodes[0]

  if (node.type === 'text') {
    return (
      <div className={cn('text-wrap break-words whitespace-pre-wrap', className)}>{content}</div>
    )
  }

  if (node.type === 'url') {
    return <WebPreview url={node.data} className={className} mustLoad={mustLoadMedia} />
  }

  if (node.type === 'x-post') {
    return (
      <XEmbeddedPost
        url={node.data}
        className={className}
        mustLoad={mustLoadMedia}
        embedded={false}
      />
    )
  }

  if (node.type === 'youtube') {
    return <YoutubeEmbeddedPlayer url={node.data} className={className} mustLoad={mustLoadMedia} />
  }

  if (node.type === 'image' || node.type === 'images') {
    const data = Array.isArray(node.data) ? node.data : [node.data]
    return (
      <ImageGallery
        className={className}
        images={data.map((url) => ({ url }))}
        mustLoad={mustLoadMedia}
      />
    )
  }

  if (node.type === 'media') {
    return <MediaPlayer className={className} src={node.data} mustLoad={mustLoadMedia} />
  }

  if (node.type === 'invoice') {
    return <EmbeddedLNInvoice invoice={node.data} className={className} />
  }

  if (node.type === 'websocket-url') {
    return <EmbeddedWebsocketUrl url={node.data} />
  }

  if (node.type === 'hashtag') {
    return <EmbeddedHashtag hashtag={node.data} />
  }

  return null
}
