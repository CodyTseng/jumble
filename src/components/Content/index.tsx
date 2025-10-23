import { useTranslatedEvent } from '@/hooks'
import {
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedHashtagParser,
  EmbeddedLNInvoiceParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
  EmbeddedWebsocketUrlParser,
  parseContent
} from '@/lib/content-parser'
import { getImetaInfosFromEvent } from '@/lib/event'
import { getEmojiInfosFromEmojiTags, getImetaInfoFromImetaTag } from '@/lib/tag'
import { cn } from '@/lib/utils'
import mediaUpload from '@/services/media-upload.service'
import { TImetaInfo } from '@/types'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import {
  EmbeddedHashtag,
  EmbeddedLNInvoice,
  EmbeddedMention,
  EmbeddedNote,
  EmbeddedWebsocketUrl
} from '../Embedded'
import Emoji from '../Emoji'
import ExternalLink from '../ExternalLink'
import ImageGallery from '../ImageGallery'
import MediaPlayer from '../MediaPlayer'
import WebPreview from '../WebPreview'
import YoutubeEmbeddedPlayer from '../YoutubeEmbeddedPlayer'

export default function Content({
  event,
  content,
  className,
  mustLoadMedia
}: {
  event?: Event
  content?: string
  className?: string
  mustLoadMedia?: boolean
}) {
  const translatedEvent = useTranslatedEvent(event?.id)
  const { nodes, allImages, lastNormalUrl, emojiInfos } = useMemo(() => {
    const _content = translatedEvent?.content ?? event?.content ?? content
    if (!_content) return {}

    const nodes = parseContent(_content, [
      EmbeddedUrlParser,
      EmbeddedLNInvoiceParser,
      EmbeddedWebsocketUrlParser,
      EmbeddedEventParser,
      EmbeddedMentionParser,
      EmbeddedHashtagParser,
      EmbeddedEmojiParser
    ])

    const imetaInfos = event ? getImetaInfosFromEvent(event) : []
    const allImages = nodes
      .map((node) => {
        if (node.type === 'image') {
          const imageInfo = imetaInfos.find((image) => image.url === node.data)
          if (imageInfo) {
            return imageInfo
          }
          const tag = mediaUpload.getImetaTagByUrl(node.data)
          return tag
            ? getImetaInfoFromImetaTag(tag, event?.pubkey)
            : { url: node.data, pubkey: event?.pubkey }
        }
        if (node.type === 'images') {
          const urls = Array.isArray(node.data) ? node.data : [node.data]
          return urls.map((url) => {
            const imageInfo = imetaInfos.find((image) => image.url === url)
            return imageInfo ?? { url, pubkey: event?.pubkey }
          })
        }
        return null
      })
      .filter(Boolean)
      .flat() as TImetaInfo[]

    const emojiInfos = getEmojiInfosFromEmojiTags(event?.tags)

    const lastNormalUrlNode = nodes.findLast((node) => node.type === 'url')
    const lastNormalUrl =
      typeof lastNormalUrlNode?.data === 'string' ? lastNormalUrlNode.data : undefined

    return { nodes, allImages, emojiInfos, lastNormalUrl }
  }, [event, translatedEvent, content])

  if (!nodes || nodes.length === 0) {
    return null
  }

  let imageIndex = 0
  return (
    <div className={cn('text-wrap break-words whitespace-pre-wrap', className)}>
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return node.data
        }
        if (node.type === 'image' || node.type === 'images') {
          const start = imageIndex
          const end = imageIndex + (Array.isArray(node.data) ? node.data.length : 1)
          imageIndex = end
          return (
            <ImageGallery
              className="mt-2"
              key={index}
              images={allImages}
              start={start}
              end={end}
              mustLoad={mustLoadMedia}
            />
          )
        }
        if (node.type === 'media') {
          return (
            <MediaPlayer className="mt-2" key={index} src={node.data} mustLoad={mustLoadMedia} />
          )
        }
        if (node.type === 'url') {
          return <ExternalLink url={node.data} key={index} />
        }
        if (node.type === 'invoice') {
          return <EmbeddedLNInvoice invoice={node.data} key={index} className="mt-2" />
        }
        if (node.type === 'websocket-url') {
          return <EmbeddedWebsocketUrl url={node.data} key={index} />
        }
        if (node.type === 'event') {
          const id = node.data.split(':')[1]
          return <EmbeddedNote key={index} noteId={id} className="mt-2" />
        }
        if (node.type === 'mention') {
          return <EmbeddedMention key={index} userId={node.data.split(':')[1]} />
        }
        if (node.type === 'hashtag') {
          return <EmbeddedHashtag hashtag={node.data} key={index} />
        }
        if (node.type === 'emoji') {
          const shortcode = node.data.split(':')[1]
          const emoji = emojiInfos.find((e) => e.shortcode === shortcode)
          if (!emoji) return node.data
          return <Emoji classNames={{ img: 'mb-1' }} emoji={emoji} key={index} />
        }
        if (node.type === 'youtube') {
          return (
            <YoutubeEmbeddedPlayer
              key={index}
              url={node.data}
              className="mt-2"
              mustLoad={mustLoadMedia}
            />
          )
        }
        return null
      })}
      {lastNormalUrl && <WebPreview className="mt-2" url={lastNormalUrl} />}
    </div>
  )
}
