import { formatNpub } from '@/lib/pubkey'
import TTMention from '@tiptap/extension-mention'
import { ReactNodeViewRenderer } from '@tiptap/react'
import MentionNode from './MentionNode'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      createMention: (id: string) => ReturnType
    }
  }
}

// const MENTION_REGEX = /(nostr:)?(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+)/g

const Mention = TTMention.extend({
  selectable: true,

  addNodeView() {
    return ReactNodeViewRenderer(MentionNode)
  },

  addCommands() {
    return {
      ...this.parent?.(),

      createMention:
        (npub: string) =>
        ({ chain }) => {
          chain()
            .focus()
            .insertContent([
              {
                type: 'mention',
                attrs: {
                  id: npub,
                  label: formatNpub(npub)
                }
              },
              {
                type: 'text',
                text: ' '
              }
            ])
            .run()

          return true
        }
    }
  }

  // addInputRules() {
  //   return [
  //     new InputRule({
  //       find: MENTION_REGEX,
  //       handler: (props) => handler(props)
  //     })
  //   ]
  // },

  // addPasteRules() {
  //   return [
  //     new PasteRule({
  //       find: MENTION_REGEX,
  //       handler: (props) => handler(props)
  //     })
  //   ]
  // }
})
export default Mention

// function handler({
//   range,
//   match,
//   commands
// }: {
//   commands: SingleCommands
//   match: ExtendedRegExpMatchArray
//   range: Range
// }) {
//   const mention = match[0]
//   if (!mention) return
//   const npub = mention.replace('nostr:', '')

//   const matchLength = mention.length
//   const end = range.to
//   const start = Math.max(0, end - matchLength)

//   commands.deleteRange({ from: start, to: end })
//   commands.createMention(npub)
// }
