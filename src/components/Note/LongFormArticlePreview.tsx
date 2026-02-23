import { getLongFormArticleMetadataFromEvent } from '@/lib/event-metadata'
import { toNoteList } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
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
  const { autoLoadMedia } = useContentPolicy()
  const metadata = useMemo(() => getLongFormArticleMetadataFromEvent(event), [event])

  const titleComponent = <div className="line-clamp-2 text-xl font-semibold">{metadata.title}</div>

  const tagsComponent = metadata.tags.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {metadata.tags.map((tag) => (
        <div
          key={tag}
          className="flex max-w-32 cursor-pointer items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
    <div className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{metadata.summary}</div>
  )

  if (isSmallScreen) {
    return (
      <div className={className}>
        {metadata.image && autoLoadMedia && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="aspect-video w-full"
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
        {metadata.image && autoLoadMedia && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="aspect-[4/3] h-44 bg-foreground object-cover xl:aspect-video"
            hideIfError
          />
        )}
        <div className="w-0 flex-1 space-y-1">
          {titleComponent}
          {summaryComponent}
          {tagsComponent}
        </div>
      </div>
    </div>
  )
}
