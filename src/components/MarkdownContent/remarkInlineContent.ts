import { EMOJI_SHORT_CODE_REGEX, HASHTAG_REGEX, LN_INVOICE_REGEX } from '@/constants'
import type { PhrasingContent, Root, Text } from 'mdast'
import type { Plugin } from 'unified'
import type { Node } from 'unist'
import { visit } from 'unist-util-visit'

interface InlineContentNode extends Node {
  type: 'hashtag' | 'emoji' | 'invoice'
  data: {
    hName: string
    hProperties: { value: string }
  }
}

const PATTERNS: { type: InlineContentNode['type']; regex: RegExp }[] = [
  { type: 'invoice', regex: LN_INVOICE_REGEX },
  { type: 'hashtag', regex: HASHTAG_REGEX },
  { type: 'emoji', regex: EMOJI_SHORT_CODE_REGEX }
]

export const remarkInlineContent: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return

      let segments: (Text | InlineContentNode)[] = [{ type: 'text', value: node.value }]

      for (const { type, regex } of PATTERNS) {
        const nextSegments: (Text | InlineContentNode)[] = []

        for (const segment of segments) {
          if (segment.type !== 'text') {
            nextSegments.push(segment)
            continue
          }

          const text = (segment as Text).value
          const localRegex = new RegExp(regex.source, regex.flags)
          const matches = Array.from(text.matchAll(localRegex))

          if (matches.length === 0) {
            nextSegments.push(segment)
            continue
          }

          let lastIndex = 0
          for (const match of matches) {
            const matchStart = match.index!
            if (matchStart > lastIndex) {
              nextSegments.push({ type: 'text', value: text.slice(lastIndex, matchStart) })
            }
            nextSegments.push({
              type,
              data: {
                hName: type,
                hProperties: { value: match[0] }
              }
            } as InlineContentNode)
            lastIndex = matchStart + match[0].length
          }
          if (lastIndex < text.length) {
            nextSegments.push({ type: 'text', value: text.slice(lastIndex) })
          }
        }

        segments = nextSegments
      }

      if (segments.length > 1 || (segments.length === 1 && segments[0].type !== 'text')) {
        parent.children.splice(index, 1, ...(segments as PhrasingContent[]))
      }
    })
  }
}
