import Emoji from '@/components/Emoji'
import { TEmoji } from '@/types'
import { NodeViewRendererProps, NodeViewWrapper } from '@tiptap/react'
import { useMemo } from 'react'

export default function EmojiNode(props: NodeViewRendererProps) {
  const emoji = useMemo(() => {
    const name = props.node.attrs.name
    // :shortcode:url: format
    if (name.startsWith(':') && name.endsWith(':')) {
      const content = name.slice(1, -1)
      const colonIndex = content.indexOf(':')
      if (colonIndex !== -1) {
        return {
          shortcode: content.slice(0, colonIndex),
          url: content.slice(colonIndex + 1)
        } as TEmoji
      }
    }
    return name
  }, props.node.attrs.name)

  return (
    <NodeViewWrapper className="inline">
      <Emoji emoji={emoji} />
    </NodeViewWrapper>
  )
}
