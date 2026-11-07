import { ExtendedKind, NSFW_DISPLAY_POLICY } from '@/constants'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { useFetchProfile } from '@/hooks/useFetchProfile'
import {
  EmbeddedEventParser,
  EmbeddedLegacyEventParser,
  EmbeddedLegacyMentionParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
  parseContent
} from '@/lib/content-parser'
import { getEventAuthorPubkey, isMentioningMutedUsers, isNsfwEvent } from '@/lib/event-core'
import { summarizeFeed, TFeedSummaryItem } from '@/lib/feed-summary'
import { toFeedTopic, toNote } from '@/lib/link'
import { formatPubkey } from '@/lib/pubkey'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import client from '@/services/client.service'
import feedTopicService from '@/services/feed-topic.service'
import threadService from '@/services/thread.service'
import { CalendarDays, EyeOff, Info } from 'lucide-react'
import { Event, kinds, nip19 } from 'nostr-tools'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore
} from 'react'
import { useTranslation } from 'react-i18next'
import ClickableCard from '@/components/ClickableCard'
import RichNotePreview from './RichNotePreview'

const FeedSummaryContext = createContext(false)
const MIN_TOPIC_PEOPLE = 2
const MIN_POPULAR_PEOPLE = 2
// Match the existing single-column centering breakpoint in index.css.
const WIDE_SCREEN = '(min-width: 1200px)'
function subscribeWideScreen(onChange: () => void) {
  const media = window.matchMedia(WIDE_SCREEN)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const getWideScreen = () => window.matchMedia(WIDE_SCREEN).matches

/** Scope summaries to the home feed, including its 24-hour view. */
export function FeedSummaryScope({ children }: { children: React.ReactNode }) {
  const { enableSingleColumnLayout, showFeedTopics, showFeedPopularNotes } = useUserPreferences()
  const { isSmallScreen } = useScreenSize()
  const active = usePageActive()
  const wide = useSyncExternalStore(subscribeWideScreen, getWideScreen)
  return (
    <FeedSummaryContext.Provider
      value={
        active &&
        enableSingleColumnLayout &&
        !isSmallScreen &&
        wide &&
        (showFeedTopics || showFeedPopularNotes)
      }
    >
      {children}
    </FeedSummaryContext.Provider>
  )
}

type TFeedSummaryProps = {
  items: readonly TFeedSummaryItem[]
  scopeKey: string
  isEventHidden?: (event: Event) => boolean
}
type TSummaryCache = {
  attempted: Set<string>
  resolved: Map<string, Event | undefined>
  listeners: Set<() => void>
}
type TSummaryStats = Pick<
  ReturnType<typeof summarizeFeed>,
  'notes' | 'people' | 'oldest' | 'newest'
>

export default function FeedSummary(props: TFeedSummaryProps) {
  const enabled = useContext(FeedSummaryContext)
  // Keep the lookup budget when the user visits a note or temporarily narrows the window.
  const cache = useMemo<TSummaryCache>(
    () => ({ attempted: new Set(), resolved: new Map(), listeners: new Set() }),
    [props.scopeKey]
  )
  return enabled ? <FeedSummaryPanel key={props.scopeKey} {...props} cache={cache} /> : null
}

function FeedSummaryPanel({
  items,
  isEventHidden,
  cache
}: TFeedSummaryProps & { cache: TSummaryCache }) {
  const { t, i18n } = useTranslation()
  const { push } = useSecondaryPage()
  const { showFeedTopics, updateShowFeedTopics, showFeedPopularNotes, updateShowFeedPopularNotes } =
    useUserPreferences()
  const { mutePubkeySet, mutedWords } = useMuteList()
  const { isEventDeleted } = useDeletedEvent()
  const { nsfwDisplayPolicy, hideContentMentioningMutedUsers } = useContentPolicy()
  const isAllowed = useCallback(
    (event: Event) =>
      !isEventHidden?.(event) &&
      !isEventDeleted(event) &&
      !mutePubkeySet.has(getEventAuthorPubkey(event)) &&
      !(hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) &&
      !(nsfwDisplayPolicy !== NSFW_DISPLAY_POLICY.SHOW && isNsfwEvent(event)) &&
      !mutedWords.some((word) => event.content.toLowerCase().includes(word.toLowerCase())),
    [
      isEventHidden,
      isEventDeleted,
      mutePubkeySet,
      mutedWords,
      hideContentMentioningMutedUsers,
      nsfwDisplayPolicy
    ]
  )
  const threadRevision = useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        showFeedPopularNotes ? threadService.listenChanges(onChange) : () => {},
      [showFeedPopularNotes]
    ),
    () => (showFeedPopularNotes ? threadService.getRevision() : 0)
  )
  const summary = useMemo(
    () =>
      summarizeFeed(
        items,
        isAllowed,
        showFeedPopularNotes
          ? (key, event) => threadService.getLoadedReplyCount(key, event?.id)
          : undefined
      ),
    [items, isAllowed, showFeedPopularNotes, threadRevision]
  )
  const topics = showFeedTopics
    ? summary.topics.filter((topic) => topic.people >= MIN_TOPIC_PEOPLE).slice(0, 5)
    : []
  const subscribe = useCallback(
    (onChange: () => void) => {
      cache.listeners.add(onChange)
      return () => {
        cache.listeners.delete(onChange)
      }
    },
    [cache]
  )
  const resolved = useSyncExternalStore(subscribe, () => cache.resolved)
  const candidates = showFeedPopularNotes
    ? summary.popularNotes
        .filter((note) => {
          if (note.people < MIN_POPULAR_PEOPLE && note.replyCount < 3) return false
          const event = note.event ?? resolved.get(note.key)
          if (event) {
            return (
              event.kind !== kinds.Repost && event.kind !== kinds.GenericRepost && isAllowed(event)
            )
          }
          // Completed misses and rejected targets must not occupy a display slot.
          if (resolved.has(note.key)) return false
          // Exhausted lookups must not hide already-loaded notes further down the ranking.
          return cache.attempted.has(note.key) || cache.attempted.size < 5
        })
        .slice(0, 3)
    : []
  // The budget is per feed/filter/refresh, rather than per ranking update.
  useEffect(() => {
    const missing = candidates.filter((note) => !note.event && !cache.attempted.has(note.key))
    const requests = missing.slice(0, Math.max(0, 5 - cache.attempted.size))
    for (const { key } of requests) cache.attempted.add(key)
    Promise.allSettled(
      requests.map(async ({ key }) => {
        const coordinate = key.match(/^(\d+):([0-9a-f]{64}):(.*)$/)
        // The client cache accepts coordinates, but network lookups require naddr.
        const id = coordinate
          ? nip19.naddrEncode({
              kind: Number(coordinate[1]),
              pubkey: coordinate[2],
              identifier: coordinate[3]
            })
          : key
        return [key, await client.fetchEvent(id)] as const
      })
    ).then((results) => {
      if (!results.length) return
      const next = new Map(cache.resolved)
      for (const [index, result] of results.entries()) {
        if (result.status === 'fulfilled') next.set(...result.value)
        else next.set(requests[index].key, undefined)
      }
      cache.resolved = next
      cache.listeners.forEach((onChange) => onChange())
    })
  }, [candidates.map((note) => (note.event ? '' : note.key)).join(',')])

  const popularNotes = candidates.flatMap((note) => {
    const event = note.event ?? resolved.get(note.key)
    return event &&
      event.kind !== kinds.Repost &&
      event.kind !== kinds.GenericRepost &&
      isAllowed(event)
      ? [{ ...note, event }]
      : []
  })
  const number = (value: number) => value.toLocaleString(i18n.resolvedLanguage)

  if (!topics.length && !popularNotes.length) return null

  return (
    <aside
      aria-label={t('Feed overview')}
      className="wide:block fixed end-[var(--removed-body-scroll-bar-size,0px)] top-0 hidden h-(--vh) w-[calc((100%-var(--removed-body-scroll-bar-size,0px)-640px)/2)] overflow-y-auto p-4 pb-24 rtl:end-0"
    >
      <div className="max-w-80 space-y-4">
        {topics.length > 0 && (
          <section
            className="bg-background overflow-hidden rounded-xl border"
            aria-label={t('Feed topics')}
          >
            <SectionHeading
              title={t('Feed topics')}
              stats={summary}
              onHide={() => updateShowFeedTopics(false)}
            />
            {topics.map((topic) => (
              <button
                key={topic.name}
                type="button"
                className="hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:ring-ring flex h-10 w-full items-center justify-between gap-3 px-4 text-start outline-hidden focus-visible:ring-2 focus-visible:ring-inset"
                title={t('Notes: {{notes}} · People: {{people}}', {
                  notes: number(topic.notes),
                  people: number(topic.people)
                })}
                aria-label={`#${topic.name} · ${t('Notes: {{notes}} · People: {{people}}', { notes: number(topic.notes), people: number(topic.people) })}`}
                onClick={() => push(toFeedTopic(feedTopicService.createSnapshot(topic)))}
              >
                <div dir="auto" className="truncate text-base">
                  #{topic.name}
                </div>
                <span className="text-muted-foreground -me-1 inline-flex h-6 w-6 shrink-0 items-center justify-center text-base tabular-nums">
                  {number(topic.notes)}
                </span>
              </button>
            ))}
          </section>
        )}
        {popularNotes.length > 0 && (
          <section
            className="bg-background overflow-hidden rounded-xl border"
            aria-label={t('Trending Notes')}
          >
            <SectionHeading
              title={t('Trending Notes')}
              stats={summary}
              onHide={() => updateShowFeedPopularNotes(false)}
            />
            <div className="divide-border/60 divide-y">
              {popularNotes.map((note) => (
                <PopularNote key={note.key} event={note.event} />
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}

function SectionHeading({
  title,
  stats,
  onHide
}: {
  title: string
  stats: TSummaryStats
  onHide: () => void
}) {
  const { t, i18n } = useTranslation()
  const formatTime = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleString(i18n.resolvedLanguage, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-2">
      <h2 className="min-w-0 truncate text-base font-semibold">{title}</h2>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t('Feed overview')}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -me-1 flex size-6 shrink-0 items-center justify-center rounded-full outline-hidden focus-visible:ring-2"
          >
            <Info className="size-4" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 overflow-hidden p-0">
          <div className="space-y-4 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t('Based on notes loaded in this feed')}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-muted-foreground text-xs">{t('Notes')}</dt>
                <dd className="mt-1 text-lg leading-none font-semibold tabular-nums">
                  {stats.notes.toLocaleString(i18n.resolvedLanguage)}
                </dd>
              </div>
              <div className="border-s ps-4">
                <dt className="text-muted-foreground text-xs">{t('Participants')}</dt>
                <dd className="mt-1 text-lg leading-none font-semibold tabular-nums">
                  {stats.people.toLocaleString(i18n.resolvedLanguage)}
                </dd>
              </div>
            </dl>
            {stats.oldest !== undefined && stats.newest !== undefined && (
              <div className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
                <CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <div>
                  <time dateTime={new Date(stats.oldest * 1000).toISOString()}>
                    {formatTime(stats.oldest)}
                  </time>
                  {' – '}
                  <time dateTime={new Date(stats.newest * 1000).toISOString()}>
                    {formatTime(stats.newest)}
                  </time>
                </div>
              </div>
            )}
          </div>
          <div className="border-t p-1.5">
            <Button
              variant="ghost-destructive"
              size="sm"
              className="h-9 w-full justify-start rounded-lg px-2.5 text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
              onClick={onHide}
            >
              <EyeOff className="size-4" aria-hidden="true" />
              {t('Hide this section')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function PopularNote({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const author = getEventAuthorPubkey(event)
  const { profile } = useFetchProfile(author)
  // Keep a text alternative for the read-only rich preview and keyboard navigation.
  const preview = useMemo(() => {
    if (event.kind === kinds.LongFormArticle) {
      return event.tags.find(([name]) => name === 'title')?.[1] || t('Article')
    }
    // Image URLs can omit an extension; use the event's own media metadata.
    const imageUrls = new Set<string>()
    for (const [name, ...values] of event.tags) {
      if (name === 'image' && values[0]) imageUrls.add(values[0])
      if (name !== 'imeta') continue
      const url = values
        .find((value) => value.startsWith('url '))
        ?.slice(4)
        .trim()
      const mime = values
        .find((value) => value.startsWith('m '))
        ?.slice(2)
        .trim()
        .toLowerCase()
      if (url && (mime?.startsWith('image/') || event.kind === ExtendedKind.PICTURE)) {
        imageUrls.add(url)
      }
    }
    let hasImage = false
    const text = parseContent(event.content, [
      EmbeddedEventParser,
      EmbeddedMentionParser,
      EmbeddedUrlParser,
      EmbeddedLegacyEventParser,
      EmbeddedLegacyMentionParser
    ])
      .map((node) => {
        if (node.type === 'event') return `[${t('Note')}]`
        if (node.type === 'mention') return `[${t('Mention')}]`
        if (
          node.type === 'image' ||
          node.type === 'images' ||
          ((node.type === 'url' || node.type === 'media') && imageUrls.has(node.data))
        ) {
          hasImage = true
          return `[${t('Image')}]`
        }
        if (node.type === 'media') return `[${t('Media')}]`
        return node.data
      })
      .join('')
      .trim()
    if (event.kind === ExtendedKind.PICTURE && !hasImage)
      return `[${t('Image')}]${text ? ` ${text}` : ''}`
    return text || t('Note')
  }, [event, t])
  return (
    <ClickableCard
      role="link"
      tabIndex={0}
      aria-label={`${profile?.username || formatPubkey(author)}: ${preview}`}
      className="hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:ring-ring block w-full cursor-pointer space-y-1.5 px-4 py-3 text-start outline-hidden focus-visible:ring-2 focus-visible:ring-inset"
      onClick={() => push(toNote(event))}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          push(toNote(event))
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <SimpleUserAvatar userId={author} size="tiny" />
        <span
          dir="auto"
          className="text-muted-foreground min-w-0 flex-1 truncate text-xs leading-4 font-medium"
        >
          {profile?.username || formatPubkey(author)}
        </span>
      </div>
      <RichNotePreview event={event} />
    </ClickableCard>
  )
}
