import { Badge } from '@/components/ui/badge'
import { toHablaLongFormArticle } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ExternalLink } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Image from '../Image'

export default function LongFormArticleNote({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { isSmallScreen } = useScreenSize()
  const metadata = useMemo(() => {
    let title: string | undefined
    let summary: string | undefined
    let image: string | undefined
    let publishDateString: string | undefined
    const tags = new Set<string>()

    event.tags.forEach(([tagName, tagValue]) => {
      if (tagName === 'title') {
        title = tagValue
      } else if (tagName === 'summary') {
        summary = tagValue
      } else if (tagName === 'image') {
        image = tagValue
      } else if (tagName === 'published_at') {
        try {
          const publishedAt = parseInt(tagValue)
          publishDateString = !isNaN(publishedAt)
            ? new Date(publishedAt * 1000).toLocaleString()
            : undefined
        } catch {
          // ignore
        }
      } else if (tagName === 't' && tagValue) {
        tags.add(tagValue.toLocaleLowerCase())
      }
    })

    if (!title) {
      title = event.tags.find(tagNameEquals('d'))?.[1] ?? 'no title'
    }

    return { title, summary, image, publishDateString, tags: Array.from(tags) }
  }, [event])

  if (isSmallScreen) {
    return (
      <div
        className={cn('flex flex-col gap-2', className)}
        onClick={(e) => {
          e.stopPropagation()
          window.open(toHablaLongFormArticle(event), '_blank')
        }}
      >
        {metadata.image && (
          <Image
            image={{ url: metadata.image }}
            className="w-full aspect-video object-cover rounded-lg"
          />
        )}
        <div>
          <div className="text-xl font-semibold line-clamp-1">{metadata.title}</div>
          {metadata.publishDateString && (
            <div className="text-xs text-muted-foreground mt-1">{metadata.publishDateString}</div>
          )}
          {metadata.summary && (
            <div className="text-sm text-muted-foreground line-clamp-4 mt-1">
              {metadata.summary}
            </div>
          )}
          {metadata.tags.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {metadata.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative border rounded-lg', className)}>
      <div className="p-3 flex gap-2 items-start">
        <div className="flex-1 w-0">
          <div className="text-xl font-semibold line-clamp-1">{metadata.title}</div>
          {metadata.publishDateString && (
            <div className="text-xs text-muted-foreground mt-1">{metadata.publishDateString}</div>
          )}
          {metadata.summary && (
            <div className="text-sm text-muted-foreground line-clamp-4 mt-1">
              {metadata.summary}
            </div>
          )}
          {metadata.tags.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {metadata.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {metadata.image && (
          <Image image={{ url: metadata.image }} className="h-32 max-w-44 rounded-lg" />
        )}
      </div>
      <div
        className="absolute top-0 w-full h-full bg-muted/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center cursor-pointer transition-opacity opacity-0 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          window.open(toHablaLongFormArticle(event), '_blank')
        }}
      >
        <div className="flex gap-2 items-center font-semibold">
          <ExternalLink className="size-4" /> Open in Habla
        </div>
      </div>
    </div>
  )
}
