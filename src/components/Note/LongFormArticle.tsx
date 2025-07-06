import { Badge } from '@/components/ui/badge'
import { tagNameEquals } from '@/lib/tag'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import ClientSelectorDialog from '../ClientSelectorDialog'
import Image from '../Image'

export default function LongFormArticle({
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
    const tags = new Set<string>()

    event.tags.forEach(([tagName, tagValue]) => {
      if (tagName === 'title') {
        title = tagValue
      } else if (tagName === 'summary') {
        summary = tagValue
      } else if (tagName === 'image') {
        image = tagValue
      } else if (tagName === 't' && tagValue && tags.size < 6) {
        tags.add(tagValue.toLocaleLowerCase())
      }
    })

    if (!title) {
      title = event.tags.find(tagNameEquals('d'))?.[1] ?? 'no title'
    }

    return { title, summary, image, tags: Array.from(tags) }
  }, [event])

  const titleComponent = <div className="text-xl font-semibold line-clamp-2">{metadata.title}</div>

  const tagsComponent = metadata.tags.length > 0 && (
    <div className="flex gap-1 flex-wrap">
      {metadata.tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )

  const summaryComponent = metadata.summary && (
    <div className="text-sm text-muted-foreground line-clamp-4">{metadata.summary}</div>
  )

  if (isSmallScreen) {
    return (
      <div className={className}>
        {metadata.image && (
          <Image
            image={{ url: metadata.image }}
            className="w-full aspect-video object-cover rounded-lg"
            hideIfError
          />
        )}
        <div className="space-y-1">
          {titleComponent}
          {summaryComponent}
          {tagsComponent}
          <ClientSelectorDialog variant="secondary" className="w-full mt-2" event={event} />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        {metadata.image && (
          <Image
            image={{ url: metadata.image }}
            className="rounded-lg aspect-[4/3] xl:aspect-video object-cover bg-foreground h-44"
            hideIfError
          />
        )}
        <div className="flex-1 w-0 space-y-1 px-2">
          {titleComponent}
          {summaryComponent}
          {tagsComponent}
        </div>
      </div>
      <ClientSelectorDialog variant="secondary" className="w-full mt-2" event={event} />
    </div>
  )
}
