import { Card } from '@/components/ui/card'
import { transformCustomEmojisInContent } from '@/lib/draft-event'
import { createFakeEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import Content from '../../Content'

export default function Preview({ content, className }: { content: string; className?: string }) {
  const { content: processedContent, emojiTags } = useMemo(
    () => transformCustomEmojisInContent(content),
    [content]
  )
  return (
    <Card className={cn('p-3', className)}>
      <Content
        event={createFakeEvent({ content: processedContent, tags: emojiTags })}
        className="pointer-events-none h-full"
      />
    </Card>
  )
}
