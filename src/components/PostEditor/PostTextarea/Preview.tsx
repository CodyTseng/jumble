import { Card } from '@/components/ui/card'
import { transformCustomEmojisInContent } from '@/lib/draft-event'
import { normalizeNostrReferences } from '@/lib/nostr'
import { createFakeEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import Content from '../../Content'

export default function Preview({ content, className }: { content: string; className?: string }) {
  const normalizedContent = useMemo(() => normalizeNostrReferences(content), [content])
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
