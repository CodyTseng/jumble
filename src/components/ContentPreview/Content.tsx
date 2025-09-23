import {
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
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
      EmbeddedUrlParser,
      EmbeddedEventParser,
      EmbeddedMentionParser,
      EmbeddedEmojiParser
    ])
  }, [content])

  return (
    <span className={cn('pointer-events-none', className)}>
      {nodes.map((node, index) => {
        if (node.type === 'image' || node.type === 'images') {
          return index > 0 ? ` [${t('Image')}]` : `[${t('Image')}]`
        }
        if (node.type === 'media') {
          return index > 0 ? ` [${t('Media')}]` : `[${t('Media')}]`
        }
        if (node.type === 'event') {
          return index > 0 ? ` [${t('Note')}]` : `[${t('Note')}]`
        }
        if (node.type === 'mention') {
          return <EmbeddedMentionText key={index} userId={node.data.split(':')[1]} />
        }
        if (node.type === 'emoji') {
          const shortcode = node.data.split(':')[1]
          const emoji = emojiInfos?.find((e) => e.shortcode === shortcode)
          if (!emoji) return node.data
          return <Emoji key={index} emoji={emoji} classNames={{ img: 'size-4' }} />
        }
        return node.data
      })}
    </span>
  )
}
