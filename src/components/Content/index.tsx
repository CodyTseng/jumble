import { useTranslatedEvent } from '@/hooks'
import {
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedHashtagParser,
  EmbeddedImageParser,
  EmbeddedLNInvoiceParser,
  EmbeddedMediaParser,
  EmbeddedMentionParser,
  EmbeddedNormalUrlParser,
  EmbeddedWebsocketUrlParser,
  EmbeddedYoutubeParser,
  parseContent
} from '@/lib/content-parser'
import { getImageInfosFromEvent } from '@/lib/event'
import { getEmojiInfosFromEmojiTags, getImageInfoFromImetaTag } from '@/lib/tag'
import { cn } from '@/lib/utils'
import mediaUpload from '@/services/media-upload.service'
import { TImageInfo } from '@/types'
import { Event } from 'nostr-tools'
import { memo } from 'react'
import {
  EmbeddedHashtag,
  EmbeddedLNInvoice,
  EmbeddedMention,
  EmbeddedNormalUrl,
  EmbeddedNote,
  EmbeddedWebsocketUrl
} from '../Embedded'
import Emoji from '../Emoji'
import ImageGallery from '../ImageGallery'
import MediaPlayer from '../MediaPlayer'
import WebPreview from '../WebPreview'
import YoutubeEmbeddedPlayer from '../YoutubeEmbeddedPlayer'

const Content = memo(({ event, className }: { event: Event; className?: string }) => {
  const translatedEvent = useTranslatedEvent(event.id)
  const nodes = parseContent(translatedEvent?.content ?? event.content, [
    EmbeddedYoutubeParser,
    EmbeddedImageParser,
    EmbeddedMediaParser,
    EmbeddedNormalUrlParser,
    EmbeddedLNInvoiceParser,
    EmbeddedWebsocketUrlParser,
    EmbeddedEventParser,
    EmbeddedMentionParser,
    EmbeddedHashtagParser,
    EmbeddedEmojiParser
  ])

  const imageInfos = getImageInfosFromEvent(event)
  const allImages = nodes
    .map((node) => {
      if (node.type === 'image') {
        const imageInfo = imageInfos.find((image) => image.url === node.data)
        if (imageInfo) {
          return imageInfo
        }
        const tag = mediaUpload.getImetaTagByUrl(node.data)
        return tag
          ? getImageInfoFromImetaTag(tag, event.pubkey)
          : { url: node.data, pubkey: event.pubkey }
      }
      if (node.type === 'images') {
        const urls = Array.isArray(node.data) ? node.data : [node.data]
        return urls.map((url) => {
          const imageInfo = imageInfos.find((image) => image.url === url)
          return imageInfo ?? { url, pubkey: event.pubkey }
        })
      }
      return null
    })
    .filter(Boolean)
    .flat() as TImageInfo[]
  let imageIndex = 0

  const emojiInfos = getEmojiInfosFromEmojiTags(event.tags)

  const lastNormalUrlNode = nodes.findLast((node) => node.type === 'url')
  const lastNormalUrl =
    typeof lastNormalUrlNode?.data === 'string' ? lastNormalUrlNode.data : undefined

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
            <ImageGallery className="mt-2" key={index} images={allImages} start={start} end={end} />
          )
        }
        if (node.type === 'media') {
          return <MediaPlayer className="mt-2" key={index} src={node.data} />
        }
        if (node.type === 'url') {
          return <EmbeddedNormalUrl url={node.data} key={index} />
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
          return <Emoji emoji={emoji} key={index} className="size-4" />
        }
        if (node.type === 'youtube') {
          return <YoutubeEmbeddedPlayer key={index} url={node.data} className="mt-2" />
        }
        return null
      })}
      {lastNormalUrl && <WebPreview className="mt-2" url={lastNormalUrl} />}
    </div>
  )
})
Content.displayName = 'Content'
export default Content
