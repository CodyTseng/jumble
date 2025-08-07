import { Badge } from '@/components/ui/badge'
import { getLongFormArticleMetadataFromEvent } from '@/lib/event-metadata'
import type { PhrasingContent, Root, Text } from 'mdast'
import { Event, nip19 } from 'nostr-tools'
import { useMemo } from 'react'
import type { Components } from 'react-markdown'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Plugin } from 'unified'
import type { Data, Node } from 'unist'
import { visit } from 'unist-util-visit'
import { EmbeddedMention, EmbeddedNote } from '../Embedded'
import Image from '../Image'

// Extend the Components interface to include your custom component
interface CustomComponents extends Components {
  nostr: React.ComponentType<{
    nostrUrl: string
    displayText: string
    nostrType: 'mention' | 'note'
  }>
}

export default function LongFormArticle({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const metadata = useMemo(() => getLongFormArticleMetadataFromEvent(event), [event])

  return (
    <div className={`prose prose-zinc max-w-none dark:prose-invert ${className || ''}`}>
      <h1>{metadata.title}</h1>
      {metadata.summary && (
        <blockquote>
          <p>{metadata.summary}</p>
        </blockquote>
      )}
      {metadata.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {metadata.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {metadata.image && (
        <Image
          image={{ url: metadata.image, pubkey: event.pubkey }}
          className="w-full aspect-[3/1] object-cover rounded-lg"
          hideIfError
        />
      )}
      <Markdown
        remarkPlugins={[remarkGfm, remarkNostr]}
        components={
          {
            nostr: ({ bech32Id }: { bech32Id?: string }) => <NostrLink bech32Id={bech32Id} />
          } as CustomComponents
        }
      >
        {event.content}
      </Markdown>
    </div>
  )
}

const NOSTR_REGEX =
  /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+|note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/g
const NOSTR_REFERENCE_REGEX =
  /\[([^\]]+)\]\[(nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+|note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+))\]/g
interface NostrNode extends Node {
  type: 'nostr'
  data: Data & {
    hName: string
    hProperties: {
      bech32Id: string
    }
  }
}

const remarkNostr: Plugin<[], Root> = () => {
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
          bech32Id: match[2].slice(6)
        })),
        ...directMatches.map((match) => ({
          ...match,
          type: 'direct' as const,
          bech32Id: match[0].slice(6)
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
              bech32Id: match.bech32Id
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

function NostrLink({ bech32Id }: { bech32Id?: string }) {
  const { type, id } = useMemo(() => {
    if (!bech32Id) return {}
    console.log('NostrLink bech32Id:', bech32Id)
    try {
      const { type } = nip19.decode(bech32Id)
      if (type === 'npub') {
        return { type: 'mention', id: bech32Id }
      }
      if (type === 'nevent' || type === 'naddr' || type === 'note') {
        return { type: 'note', id: bech32Id }
      }
    } catch (error) {
      console.error('Invalid bech32 ID:', bech32Id, error)
    }
    return {}
  }, [bech32Id])

  if (!type || !id) return null

  if (type === 'mention') {
    return <EmbeddedMention userId={id} className="not-prose" />
  }
  return <EmbeddedNote noteId={id} className="not-prose" />
}
