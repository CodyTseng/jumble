import { SecondaryPageLink, useSecondaryPage } from '@/PageManager'
import ExternalLink from '@/components/ExternalLink'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import ImageWithLightbox from '@/components/ImageWithLightbox'
import HighlightButton from '@/components/HighlightButton'
import PostEditor from '@/components/PostEditor'
import { useTranslatedEvent } from '@/hooks'
import { getLongFormArticleMetadataFromEvent } from '@/lib/event-metadata'
import { toNote, toNoteList, toProfile } from '@/lib/link'
import { estimateReadingMinutes, transformMarkdownUrl } from '@/lib/markdown'
import { Event, kinds } from 'nostr-tools'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const translatedEvent = useTranslatedEvent(event.id)
  const displayEvent = translatedEvent ?? event
  const metadata = useMemo(() => getLongFormArticleMetadataFromEvent(displayEvent), [displayEvent])
  const readingMinutes = useMemo(
    () => estimateReadingMinutes(displayEvent.content),
    [displayEvent.content]
  )
  const contentRef = useRef<HTMLDivElement>(null)
  const [showHighlightEditor, setShowHighlightEditor] = useState(false)
  const [selectedText, setSelectedText] = useState('')

  const handleHighlight = (text: string) => {
    setSelectedText(text)
    setShowHighlightEditor(true)
  }

  const components = useMemo(
    () =>
      ({
        nostr: ({ rawText, bech32Id }) => <NostrNode rawText={rawText} bech32Id={bech32Id} />,
        a: ({ href, children }) => {
          if (!href) {
            return <span className="wrap-break-word">{children}</span>
          }
          if (href.startsWith('note1') || href.startsWith('nevent1') || href.startsWith('naddr1')) {
            return (
              <SecondaryPageLink
                to={toNote(href)}
                className="text-foreground wrap-break-word underline"
              >
                {children}
              </SecondaryPageLink>
            )
          }
          if (href.startsWith('npub1') || href.startsWith('nprofile1')) {
            return (
              <SecondaryPageLink
                to={toProfile(href)}
                className="text-foreground wrap-break-word underline"
              >
                {children}
              </SecondaryPageLink>
            )
          }
          return (
            <ExternalLink url={href} className="wrap-break-word">
              {children}
            </ExternalLink>
          )
        },
        p: (props) => <p {...props} className="wrap-break-word" />,
        div: (props) => <div {...props} className="wrap-break-word" />,
        code: (props) => <code {...props} className="wrap-break-word whitespace-pre-wrap" />,
        img: (props) => (
          <ImageWithLightbox
            image={{ url: props.src || '', pubkey: event.pubkey }}
            className="my-0 max-h-[80vh] object-contain sm:max-h-[50vh]"
            classNames={{
              wrapper: 'w-fit max-w-full'
            }}
          />
        )
      }) as Components,
    [event.pubkey]
  )

  return (
    <>
      <div
        ref={contentRef}
        className={`overflow-wrap-anywhere prose prose-zinc dark:prose-invert prose-img:my-0 max-w-none wrap-break-word ${className || ''}`}
      >
        <h1 className="wrap-break-word">{metadata.title}</h1>
        <div className="text-muted-foreground -mt-4 mb-6 text-sm">
          {t('{{count}} min read', { count: readingMinutes })}
          <span className="mx-1.5">·</span>
          {t('Last edited')}: <FormattedTimestamp timestamp={event.created_at} />
        </div>
        {metadata.summary && (
          <blockquote>
            <p className="wrap-break-word whitespace-pre-line">{metadata.summary}</p>
          </blockquote>
        )}
        {metadata.image && (
          <ImageWithLightbox
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="my-0 aspect-3/1 w-full object-cover"
          />
        )}
        <Markdown
          remarkPlugins={[remarkGfm, remarkNostr]}
          urlTransform={transformMarkdownUrl}
          components={components}
        >
          {displayEvent.content}
        </Markdown>
        {metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {metadata.tags.map((tag) => (
              <div
                key={tag}
                title={tag}
                className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground flex max-w-44 cursor-pointer items-center rounded-full px-3"
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
      <HighlightButton onHighlight={handleHighlight} containerRef={contentRef} />
      <PostEditor
        highlightedText={selectedText}
        parentStuff={event}
        open={showHighlightEditor}
        setOpen={setShowHighlightEditor}
      />
    </>
  )
}
