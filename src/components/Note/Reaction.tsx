import Emoji from '@/components/Emoji'
import { getEmojiInfosFromEmojiTags } from '@/lib/tag'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'

export default function Reaction({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const emoji = useMemo(() => {
    const content = event.content
    if (!content || content === '+') return '+'

    const emojiName = /^:([^:]+):$/.exec(content)?.[1]
    if (emojiName) {
      const emojiInfos = getEmojiInfosFromEmojiTags(event.tags)
      const emojiInfo = emojiInfos.find((e) => e.shortcode === emojiName)
      if (emojiInfo) return emojiInfo
    }

    if (content.length <= 4) return content
    return '+'
  }, [event])

  return (
    <div className={className}>
      <Emoji emoji={emoji} classNames={{ text: 'text-7xl leading-none', img: 'size-20' }} />
    </div>
  )
}
