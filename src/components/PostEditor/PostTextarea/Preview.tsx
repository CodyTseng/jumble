import { Card } from '@/components/ui/card'
import { transformCustomEmojisInContent } from '@/lib/draft-event'
import { extractNostrReferences, normalizeNostrReferences } from '@/lib/nostr'
import { createFakeEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import client from '@/services/client.service'
import { useEffect, useMemo, useRef } from 'react'
import Content from '../../Content'

export default function Preview({ content, className }: { content: string; className?: string }) {
  const normalizedContent = useMemo(() => normalizeNostrReferences(content), [content])
  const mentionIdentifiers = useMemo(
    () => extractNostrReferences(normalizedContent),
    [normalizedContent]
  )
  const prefetchedMentionsRef = useRef<Set<string>>(new Set())
  const prefetchedInFlightRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (mentionIdentifiers.length === 0) return

    // Prefetch mention profiles so the preview can render resolved usernames.
    mentionIdentifiers.forEach((identifier) => {
      if (!identifier.startsWith('npub1') && !identifier.startsWith('nprofile1')) {
        return
      }
      if (
        prefetchedMentionsRef.current.has(identifier) ||
        prefetchedInFlightRef.current.has(identifier)
      ) {
        return
      }
      prefetchedInFlightRef.current.add(identifier)

      void (async () => {
        try {
          const profile = await client.fetchProfile(identifier)
          if (!profile?.original_username) {
            await client.fetchProfile(identifier, true)
          }
        } catch {
          // ignore
        } finally {
          prefetchedInFlightRef.current.delete(identifier)
          prefetchedMentionsRef.current.add(identifier)
        }
      })()
    })
  }, [mentionIdentifiers])

  const { content: processedContent, emojiTags } = useMemo(
    () => transformCustomEmojisInContent(normalizedContent),
    [normalizedContent]
  )
  return (
    <Card className={cn('p-3', className)}>
      <Content
        event={createFakeEvent({ content: processedContent, tags: emojiTags })}
        className="pointer-events-none h-full"
        mustLoadMedia
      />
    </Card>
  )
}
