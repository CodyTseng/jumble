import TTEmoji from '@tiptap/extension-emoji'
import { ReactNodeViewRenderer } from '@tiptap/react'
import EmojiNode from './EmojiNode'

const Emoji = TTEmoji.extend({
  selectable: true,

  addNodeView() {
    return ReactNodeViewRenderer(EmojiNode)
  }
})
export default Emoji
