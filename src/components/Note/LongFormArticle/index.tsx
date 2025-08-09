import ImageWithLightbox from '@/components/ImageWithLightbox'
import { Badge } from '@/components/ui/badge'
import { getLongFormArticleMetadataFromEvent } from '@/lib/event-metadata'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import NostrNode from './NostrNode'
import { remarkNostr } from './remarkNostr'
import { Components } from './types'

export default function LongFormArticle({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const metadata = useMemo(() => getLongFormArticleMetadataFromEvent(event), [event])

  return (
    <div
      className={`prose prose-zinc max-w-none dark:prose-invert break-words overflow-wrap-anywhere ${className || ''}`}
    >
      <h1 className="break-words">{metadata.title}</h1>
      {metadata.summary && (
        <blockquote>
          <p className="break-words">{metadata.summary}</p>
        </blockquote>
      )}
      {metadata.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {metadata.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="break-words">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {metadata.image && (
        <ImageWithLightbox
          image={{ url: metadata.image, pubkey: event.pubkey }}
          className="w-full aspect-[3/1] object-cover rounded-lg"
        />
      )}
      <Markdown
        remarkPlugins={[remarkGfm, remarkNostr]}
        components={
          {
            nostr: (props) => <NostrNode {...props} />,
            a: (props) => (
              <a {...props} target="_blank" rel="noreferrer noopener" className="break-words" />
            ),
            p: (props) => <p {...props} className="break-words" />,
            div: (props) => <div {...props} className="break-words" />,
            code: (props) => <code {...props} className="break-words whitespace-pre-wrap" />
          } as Components
        }
      >
        {event.content}
      </Markdown>
    </div>
  )
}
