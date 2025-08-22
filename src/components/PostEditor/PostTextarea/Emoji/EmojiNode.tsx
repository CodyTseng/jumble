import Emoji from '@/components/Emoji'
import customEmojiService from '@/services/custom-emoji.service'
import { emojis, shortcodeToEmoji } from '@tiptap/extension-emoji'
import { NodeViewRendererProps, NodeViewWrapper } from '@tiptap/react'
import { useMemo } from 'react'

export default function EmojiNode(props: NodeViewRendererProps) {
  const emoji = useMemo(() => {
    const name = props.node.attrs.name
    if (customEmojiService.isCustomEmojiId(name)) {
      return customEmojiService.getEmojiById(name)
    }
    return shortcodeToEmoji(name, emojis)?.emoji
  }, [props.node.attrs.name])

  if (!emoji) {
    return null
  }

  if (typeof emoji === 'string') {
    return (
      <NodeViewWrapper className="inline">
        <span>{emoji}</span>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="inline">
      <Emoji emoji={emoji} classNames={{ img: 'mb-1' }} />
    </NodeViewWrapper>
  )
}
