import Emoji from '@/components/Emoji'
import customEmojiService from '@/services/custom-emoji.service'
import { NodeViewRendererProps, NodeViewWrapper } from '@tiptap/react'
import { useMemo } from 'react'

export default function EmojiNode(props: NodeViewRendererProps) {
  const emoji = useMemo(
    () => customEmojiService.getEmojiById(props.node.attrs.name),
    [props.node.attrs.name]
  )

  if (!emoji) {
    return null
  }

  return (
    <NodeViewWrapper className="inline-flex items-baseline">
      <Emoji emoji={emoji} />
    </NodeViewWrapper>
  )
}
