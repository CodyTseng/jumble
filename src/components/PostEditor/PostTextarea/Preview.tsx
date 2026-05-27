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
    <div className={cn('px-5 py-2 text-base sm:px-6', className)}>
      <Content
        event={createFakeEvent({ content: processedContent, tags: emojiTags })}
        className="pointer-events-none h-full"
        mustLoadMedia
      />
    </div>
  )
}
