import {
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedHashtagParser,
  EmbeddedImageParser,
  EmbeddedMentionParser,
  EmbeddedNormalUrlParser,
  EmbeddedVideoParser,
  EmbeddedWebsocketUrlParser,
  parseContent
} from '@/lib/content-parser'
import { extractEmojiInfosFromTags, isNsfwEvent } from '@/lib/event'
import { extractImageInfoFromTag } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { TImageInfo } from '@/types'
import { Event } from 'nostr-tools'
import { memo } from 'react'
import {
  EmbeddedHashtag,
  EmbeddedMention,
  EmbeddedNormalUrl,
  EmbeddedNote,
  EmbeddedWebsocketUrl
} from '../Embedded'
import Emoji from '../Emoji'
import ImageGallery from '../ImageGallery'
import VideoPlayer from '../VideoPlayer'
import WebPreview from '../WebPreview'

const Content = memo(({ event, className }: { event: Event; className?: string }) => {
  const nodes = parseContent(event.content, [
    EmbeddedImageParser,
    EmbeddedVideoParser,
    EmbeddedNormalUrlParser,
    EmbeddedWebsocketUrlParser,
    EmbeddedEventParser,
    EmbeddedMentionParser,
    EmbeddedHashtagParser,
    EmbeddedEmojiParser
  ])

  const imageInfos = event.tags
    .map((tag) => extractImageInfoFromTag(tag))
    .filter(Boolean) as TImageInfo[]
  const allImages = nodes
    .map((node) => {
      if (node.type === 'image') {
        const imageInfo = imageInfos.find((image) => image.url === node.data)
        return imageInfo ?? { url: node.data }
      }
      if (node.type === 'images') {
        const urls = Array.isArray(node.data) ? node.data : [node.data]
        return urls.map((url) => {
          const imageInfo = imageInfos.find((image) => image.url === url)
          return imageInfo ?? { url }
        })
      }
      return null
    })
    .filter(Boolean)
    .flat() as TImageInfo[]
  let imageIndex = 0

  const emojiInfos = extractEmojiInfosFromTags(event.tags)

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
            <ImageGallery
              className="mt-2"
              key={index}
              images={allImages}
              isNsfw={isNsfwEvent(event)}
              start={start}
              end={end}
            />
          )
        }
        if (node.type === 'video') {
          return (
            <VideoPlayer className="mt-2" key={index} src={node.data} isNsfw={isNsfwEvent(event)} />
          )
        }
        if (node.type === 'url') {
          return <EmbeddedNormalUrl url={node.data} key={index} />
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
        return null
      })}
      {lastNormalUrl && <WebPreview className="mt-2" url={lastNormalUrl} />}
    </div>
  )
})
Content.displayName = 'Content'
export default Content
