import {
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedImageParser,
  EmbeddedMentionParser,
  EmbeddedMediaParser,
  parseContent
} from '@/lib/content-parser'
import { cn } from '@/lib/utils'
import { TEmoji } from '@/types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmbeddedMentionText } from '../Embedded'
import Emoji from '../Emoji'

export default function Content({
  content,
  className,
  emojiInfos
}: {
  content: string
  className?: string
  emojiInfos?: TEmoji[]
}) {
  const { t } = useTranslation()
  const nodes = useMemo(() => {
    return parseContent(content, [
      EmbeddedImageParser,
      EmbeddedMediaParser,
      EmbeddedEventParser,
      EmbeddedMentionParser,
      EmbeddedEmojiParser
    ])
  }, [content])

  return (
    <span className={cn('pointer-events-none', className)}>
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return node.data
        }
        if (node.type === 'image' || node.type === 'images') {
          return index > 0 ? ` [${t('image')}]` : `[${t('image')}]`
        }
        if (node.type === 'media') {
          return index > 0 ? ` [${t('media')}]` : `[${t('media')}]`
        }
        if (node.type === 'event') {
          return index > 0 ? ` [${t('note')}]` : `[${t('note')}]`
        }
        if (node.type === 'mention') {
          return <EmbeddedMentionText key={index} userId={node.data.split(':')[1]} />
        }
        if (node.type === 'emoji') {
          const shortcode = node.data.split(':')[1]
          const emoji = emojiInfos?.find((e) => e.shortcode === shortcode)
          if (!emoji) return node.data
          return <Emoji key={index} emoji={emoji} />
        }
      })}
    </span>
  )
}
