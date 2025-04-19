import {
  EmbeddedEmojiParser,
  EmbeddedHashtagParser,
  EmbeddedMentionParser,
  EmbeddedNormalUrlParser,
  EmbeddedWebsocketUrlParser,
  parseContent
} from '@/lib/content-parser'
import { extractEmojiInfosFromTags, extractImageInfosFromEventTags, isNsfwEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { memo, useMemo } from 'react'
import {
  EmbeddedHashtag,
  EmbeddedMention,
  EmbeddedNormalUrl,
  EmbeddedWebsocketUrl
} from '../Embedded'
import { ImageCarousel } from '../ImageCarousel'
import Emoji from '../Emoji'

const PictureContent = memo(({ event, className }: { event: Event; className?: string }) => {
  const images = useMemo(() => extractImageInfosFromEventTags(event), [event])
  const isNsfw = isNsfwEvent(event)

  const nodes = parseContent(event.content, [
    EmbeddedNormalUrlParser,
    EmbeddedWebsocketUrlParser,
    EmbeddedHashtagParser,
    EmbeddedMentionParser,
    EmbeddedEmojiParser
  ])

  const emojiInfos = extractEmojiInfosFromTags(event.tags)

  return (
    <div className={cn('text-wrap break-words whitespace-pre-wrap space-y-2', className)}>
      <ImageCarousel images={images} isNsfw={isNsfw} />
      <div className="px-4">
        {nodes.map((node, index) => {
          if (node.type === 'text') {
            return node.data
          }
          if (node.type === 'url') {
            return <EmbeddedNormalUrl key={index} url={node.data} />
          }
          if (node.type === 'websocket-url') {
            return <EmbeddedWebsocketUrl key={index} url={node.data} />
          }
          if (node.type === 'hashtag') {
            return <EmbeddedHashtag key={index} hashtag={node.data} />
          }
          if (node.type === 'mention') {
            return <EmbeddedMention key={index} userId={node.data.split(':')[1]} />
          }
          if (node.type === 'emoji') {
            const shortcode = node.data.split(':')[1]
            const emoji = emojiInfos.find((e) => e.shortcode === shortcode)
            if (!emoji) return node.data
            return <Emoji key={index} emoji={emoji} />
          }
        })}
      </div>
    </div>
  )
})
PictureContent.displayName = 'PictureContent'
export default PictureContent
