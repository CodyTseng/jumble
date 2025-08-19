import { SecondaryPageLink, useSecondaryPage } from '@/PageManager'
import ImageWithLightbox from '@/components/ImageWithLightbox'
import { getLongFormArticleMetadataFromEvent } from '@/lib/event-metadata'
import { toNote, toNoteList, toProfile } from '@/lib/link'
import { ExternalLink } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
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
  const { push } = useSecondaryPage()
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
      {metadata.image && (
        <ImageWithLightbox
          image={{ url: metadata.image, pubkey: event.pubkey }}
          className="w-full aspect-[3/1] object-cover rounded-lg"
        />
      )}
      <Markdown
        remarkPlugins={[remarkGfm, remarkNostr]}
        urlTransform={(url) => {
          if (url.startsWith('nostr:')) {
            return url.slice(6) // Remove 'nostr:' prefix for rendering
          }
          return url
        }}
        components={
          {
            nostr: (props) => <NostrNode {...props} />,
            a: ({ href, children, ...props }) => {
              if (!href) {
                return <span {...props} className="break-words" />
              }
              if (
                href.startsWith('note1') ||
                href.startsWith('nevent1') ||
                href.startsWith('naddr1')
              ) {
                return (
                  <SecondaryPageLink
                    to={toNote(href)}
                    className="break-words underline text-foreground"
                  >
                    {children}
                  </SecondaryPageLink>
                )
              }
              if (href.startsWith('npub1') || href.startsWith('nprofile1')) {
                return (
                  <SecondaryPageLink
                    to={toProfile(href)}
                    className="break-words underline text-foreground"
                  >
                    {children}
                  </SecondaryPageLink>
                )
              }
              return (
                <a
                  {...props}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-words inline-flex items-baseline gap-1"
                >
                  {children} <ExternalLink className="size-3" />
                </a>
              )
            },
            p: (props) => <p {...props} className="break-words" />,
            div: (props) => <div {...props} className="break-words" />,
            code: (props) => <code {...props} className="break-words whitespace-pre-wrap" />
          } as Components
        }
      >
        {event.content}
      </Markdown>
      {metadata.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap pb-2">
          {metadata.tags.map((tag) => (
            <div
              key={tag}
              title={tag}
              className="flex items-center rounded-full px-3 bg-muted text-muted-foreground max-w-44 cursor-pointer hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => {
                e.stopPropagation()
                push(toNoteList({ hashtag: tag, kinds: [kinds.LongFormArticle] }))
              }}
            >
              #<span className="truncate">{tag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
