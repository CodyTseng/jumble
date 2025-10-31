import { Card } from '@/components/ui/card'
import { transformCustomEmojisInContent } from '@/lib/draft-event'
import { createFakeEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import Content from '../../Content'

export default function Preview({
  content,
  className,
  images = []
}: {
  content: string
  className?: string
  images?: Array<{ url: string; alt?: string }>
}) {
  const { content: processedContent, emojiTags } = useMemo(
    () => transformCustomEmojisInContent(content),
    [content]
  )

  // Create imeta tags for images
  const imetaTags = useMemo(() => {
    return images.map((img) => {
      const imetaParts: string[] = ['imeta', `url ${img.url}`]
      if (img.alt) {
        imetaParts.push(`alt ${img.alt}`)
      }
      return imetaParts
    })
  }, [images])

  const allTags = useMemo(() => [...emojiTags, ...imetaTags], [emojiTags, imetaTags])

  return (
    <Card className={cn('p-3', className)}>
      <Content
        event={createFakeEvent({ content: processedContent, tags: allTags })}
        className="pointer-events-none h-full"
        mustLoadMedia
      />
    </Card>
  )
}
