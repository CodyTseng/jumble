import { SecondaryPageLink } from '@/PageManager'
import { X_URL_REGEX, YOUTUBE_URL_REGEX } from '@/constants'
import { toNote, toProfile } from '@/lib/link'
import { getEmojiInfosFromEmojiTags } from '@/lib/tag'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { EmbeddedHashtag, EmbeddedLNInvoice } from '../Embedded'
import Emoji from '../Emoji'
import ExternalLink from '../ExternalLink'
import ImageWithLightbox from '../ImageWithLightbox'
import NostrNode from '../Note/LongFormArticle/NostrNode'
import { remarkNostr } from '../Note/LongFormArticle/remarkNostr'
import { Components as BaseComponents } from '../Note/LongFormArticle/types'

type InlineComponent = React.ComponentType<{ value: string }>

interface Components extends BaseComponents {
  hashtag: InlineComponent
  emoji: InlineComponent
  invoice: InlineComponent
}
import XEmbeddedPost from '../XEmbeddedPost'
import YoutubeEmbeddedPlayer from '../YoutubeEmbeddedPlayer'
import { remarkInlineContent } from './remarkInlineContent'

export default function MarkdownContent({
  content,
  event
}: {
  content: string
  event?: Event
}) {
  const emojiInfos = useMemo(() => getEmojiInfosFromEmojiTags(event?.tags), [event?.tags])

  const components = useMemo(
    () =>
      ({
        nostr: ({ rawText, bech32Id }) => <NostrNode rawText={rawText} bech32Id={bech32Id} />,
        hashtag: ({ value }) => <EmbeddedHashtag hashtag={value} />,
        emoji: ({ value }) => {
          const shortcode = value.slice(1, -1)
          const emojiInfo = emojiInfos.find((e) => e.shortcode === shortcode)
          if (!emojiInfo) return value
          return <Emoji classNames={{ img: 'mb-1' }} emoji={emojiInfo} />
        },
        invoice: ({ value }) => <EmbeddedLNInvoice invoice={value} className="mt-2" />,
        a: ({ href, children }) => {
          if (!href) return <span>{children}</span>
          if (href.startsWith('note1') || href.startsWith('nevent1') || href.startsWith('naddr1')) {
            return (
              <SecondaryPageLink to={toNote(href)} className="text-primary hover:underline">
                {children}
              </SecondaryPageLink>
            )
          }
          if (href.startsWith('npub1') || href.startsWith('nprofile1')) {
            return (
              <SecondaryPageLink to={toProfile(href)} className="text-primary hover:underline">
                {children}
              </SecondaryPageLink>
            )
          }
          if (YOUTUBE_URL_REGEX.test(href)) {
            return <YoutubeEmbeddedPlayer url={href} className="mt-2" />
          }
          if (X_URL_REGEX.test(href)) {
            return <XEmbeddedPost url={href} className="mt-2" />
          }
          return (
            <ExternalLink url={href} justOpenLink />
          )
        },
        h1: ({ children }) => <p className="font-bold">{children}</p>,
        h2: ({ children }) => <p className="font-bold">{children}</p>,
        h3: ({ children }) => <p className="font-bold">{children}</p>,
        h4: ({ children }) => <p className="font-bold">{children}</p>,
        h5: ({ children }) => <p className="font-bold">{children}</p>,
        h6: ({ children }) => <p className="font-bold">{children}</p>,
        p: ({ children }) => <p>{children}</p>,
        img: ({ src }) => (
          <ImageWithLightbox
            image={{ url: src || '', pubkey: event?.pubkey }}
            className="max-h-[80vh] object-contain sm:max-h-[50vh]"
            classNames={{ wrapper: 'w-fit max-w-full mt-2' }}
          />
        ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-sm">{children}</pre>
        ),
        code: ({ children, className }) => {
          if (className) {
            return <code className="whitespace-pre-wrap break-words">{children}</code>
          }
          return <code className="rounded bg-muted px-1 py-0.5 text-sm">{children}</code>
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="whitespace-nowrap border border-border bg-muted px-3 py-1.5 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="whitespace-nowrap border border-border px-3 py-1.5">{children}</td>
        ),
        hr: () => <hr className="border-border" />
      }) as Components,
    [event?.pubkey, emojiInfos]
  )

  return (
    <div className="space-y-3 whitespace-normal">
      <Markdown
        remarkPlugins={[remarkGfm, remarkNostr, remarkInlineContent]}
        urlTransform={(url) => {
          if (url.startsWith('nostr:')) {
            return url.slice(6)
          }
          return url
        }}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  )
}
