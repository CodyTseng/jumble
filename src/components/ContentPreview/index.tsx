import {
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedImageParser,
  EmbeddedMentionParser,
  EmbeddedVideoParser,
  parseContent
} from '@/lib/content-parser'
import { extractEmojiInfosFromTags } from '@/lib/event'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmbeddedMentionText } from '../Embedded'
import Emoji from '../Emoji'

export default function ContentPreview({
  event,
  className
}: {
  event?: Event
  className?: string
}) {
  const { t } = useTranslation()
  const nodes = useMemo(() => {
    if (!event) return [{ type: 'text', data: `[${t('Not found the note')}]` }]

    return parseContent(event.content, [
      EmbeddedImageParser,
      EmbeddedVideoParser,
      EmbeddedEventParser,
      EmbeddedMentionParser,
      EmbeddedEmojiParser
    ])
  }, [event])

  const emojiInfos = extractEmojiInfosFromTags(event?.tags)

  return (
    <div className={cn('pointer-events-none', className)}>
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return node.data
        }
        if (node.type === 'image' || node.type === 'images') {
          return index > 0 ? ` [${t('image')}]` : `[${t('image')}]`
        }
        if (node.type === 'video') {
          return index > 0 ? ` [${t('video')}]` : `[${t('video')}]`
        }
        if (node.type === 'event') {
          return index > 0 ? ` [${t('note')}]` : `[${t('note')}]`
        }
        if (node.type === 'mention') {
          return <EmbeddedMentionText key={index} userId={node.data.split(':')[1]} />
        }
        if (node.type === 'emoji') {
          const shortcode = node.data.split(':')[1]
          const emoji = emojiInfos.find((e) => e.shortcode === shortcode)
          if (!emoji) return node.data
          return <Emoji key={index} emoji={emoji} />
        }
      })}
    </div>
  )
}
