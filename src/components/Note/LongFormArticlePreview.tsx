import { getLongFormArticleMetadataFromEvent } from '@/lib/event-metadata'
import { toNoteList } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import Image from '../Image'

export default function LongFormArticlePreview({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { isSmallScreen } = useScreenSize()
  const { push } = useSecondaryPage()
  const metadata = useMemo(() => getLongFormArticleMetadataFromEvent(event), [event])

  const titleComponent = <div className="text-xl font-semibold line-clamp-2">{metadata.title}</div>

  const tagsComponent = metadata.tags.length > 0 && (
    <div className="flex gap-1 flex-wrap">
      {metadata.tags.map((tag) => (
        <div
          key={tag}
          className="flex items-center rounded-full text-xs px-2.5 py-0.5 bg-muted text-muted-foreground max-w-32 cursor-pointer hover:bg-accent hover:text-accent-foreground"
          onClick={(e) => {
            e.stopPropagation()
            push(toNoteList({ hashtag: tag, kinds: [kinds.LongFormArticle] }))
          }}
        >
          #<span className="truncate">{tag}</span>
        </div>
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
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="w-full aspect-video object-cover rounded-lg"
            hideIfError
          />
        )}
        <div className="space-y-1">
          {titleComponent}
          {summaryComponent}
          {tagsComponent}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-4">
        {metadata.image && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="rounded-lg aspect-[4/3] xl:aspect-video object-cover bg-foreground h-44"
            hideIfError
          />
        )}
        <div className="flex-1 w-0 space-y-1">
          {titleComponent}
          {summaryComponent}
          {tagsComponent}
        </div>
      </div>
    </div>
  )
}
