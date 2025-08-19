import type { PhrasingContent, Root, Text } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { NostrNode } from './types'

const NOSTR_REGEX =
  /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+|note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/g
const NOSTR_REFERENCE_REGEX =
  /\[[^\]]+\]\[(nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+|note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+))\]/g

export const remarkNostr: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const text = node.value

      // First, handle reference-style nostr links [text][nostr:...]
      const refMatches = Array.from(text.matchAll(NOSTR_REFERENCE_REGEX))
      // Then, handle direct nostr links that are not part of reference links
      const directMatches = Array.from(text.matchAll(NOSTR_REGEX)).filter((directMatch) => {
        return !refMatches.some(
          (refMatch) =>
            directMatch.index! >= refMatch.index! &&
            directMatch.index! < refMatch.index! + refMatch[0].length
        )
      })

      // Combine and sort matches by position
      const allMatches = [
        ...refMatches.map((match) => ({
          ...match,
          type: 'reference' as const,
          bech32Id: match[2],
          rawText: match[0]
        })),
        ...directMatches.map((match) => ({
          ...match,
          type: 'direct' as const,
          bech32Id: match[1],
          rawText: match[0]
        }))
      ].sort((a, b) => a.index! - b.index!)

      if (allMatches.length === 0) return

      const children: (Text | NostrNode)[] = []
      let lastIndex = 0

      allMatches.forEach((match) => {
        const matchStart = match.index!
        const matchEnd = matchStart + match[0].length

        // Add text before the match
        if (matchStart > lastIndex) {
          children.push({
            type: 'text',
            value: text.slice(lastIndex, matchStart)
          })
        }

        // Create custom nostr node with type information
        const nostrNode: NostrNode = {
          type: 'nostr',
          data: {
            hName: 'nostr',
            hProperties: {
              bech32Id: match.bech32Id,
              rawText: match.rawText
            }
          }
        }
        children.push(nostrNode)

        lastIndex = matchEnd
      })

      // Add remaining text after the last match
      if (lastIndex < text.length) {
        children.push({
          type: 'text',
          value: text.slice(lastIndex)
        })
      }

      // Type assertion to tell TypeScript these are valid AST nodes
      parent.children.splice(index, 1, ...(children as PhrasingContent[]))
    })
  }
}
