import { cn } from '@/lib/utils'
import { TPinnedColumn, TFeedSubRequest } from '@/types'
import { X, Compass, Bell, UserRound, Search, Server, Bookmark, Highlighter, BookOpen, List, Users } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'
import Explore from '@/components/Explore'
import NotificationList from '@/components/NotificationList'
import Profile from '@/components/Profile'
import SearchResult from '@/components/SearchResult'
import Relay from '@/components/Relay'
import NormalFeed from '@/components/NormalFeed'
import BookmarkList from '@/components/BookmarkList'
import HighlightsList from '@/components/HighlightsList'
import ArticleList from '@/components/ArticleList'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '../ui/button'
import { usePageTheme } from '@/providers/PageThemeProvider'
import { useDeckView } from '@/providers/DeckViewProvider'
import { useCustomFeeds } from '@/providers/CustomFeedsProvider'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { DeepBrowsingProvider } from '@/providers/DeepBrowsingProvider'
import { BIG_RELAY_URLS, SEARCHABLE_RELAY_URLS, ExtendedKind } from '@/constants'
import { normalizeUrl, simplifyUrl } from '@/lib/url'
import { useTranslation } from 'react-i18next'
import { useFetchProfile, useFetchFollowings } from '@/hooks'
import Username from '../Username'
import { useNostr } from '@/providers/NostrProvider'
import { useLists } from '@/providers/ListsProvider'
import client from '@/services/client.service'

export default function DeckColumn({ column }: { column: TPinnedColumn }) {
  const { pageTheme } = usePageTheme()
  const { unpinColumn } = useDeckView()
  const { customFeeds } = useCustomFeeds()
  const { relaySets } = useFavoriteRelays()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  let content: React.ReactNode = null
  let titlebar: React.ReactNode = null

  switch (column.type) {
    case 'explore':
      titlebar = <ExploreTitlebar onClose={() => unpinColumn(column.id)} />
      content = <Explore />
      break
    case 'notifications':
      titlebar = <NotificationsTitlebar onClose={() => unpinColumn(column.id)} />
      content = <NotificationList isInDeckView={true} />
      break
    case 'profile':
      if (column.props?.pubkey) {
        titlebar = <ProfileTitlebar pubkey={column.props.pubkey} onClose={() => unpinColumn(column.id)} />
        content = <Profile id={column.props.pubkey} isInDeckView={true} />
      }
      break
    case 'search':
      if (column.props?.searchParams) {
        titlebar = <SearchTitlebar searchParams={column.props.searchParams} onClose={() => unpinColumn(column.id)} />
        content = <SearchResult searchParams={column.props.searchParams} isInDeckView={true} />
      }
      break
    case 'relay':
      if (column.props?.url) {
        const normalizedUrl = normalizeUrl(column.props.url)
        titlebar = <RelayTitlebar url={normalizedUrl} onClose={() => unpinColumn(column.id)} />
        content = <Relay url={normalizedUrl} isInDeckView={true} />
      }
      break
    case 'relays':
      if (column.props?.activeRelaySetId) {
        const relaySet = relaySets.find((s) => s.id === column.props.activeRelaySetId)
        if (relaySet) {
          titlebar = <RelaySetTitlebar name={relaySet.name} onClose={() => unpinColumn(column.id)} />
          content = (
            <NormalFeed
              subRequests={[{ urls: relaySet.relayUrls, filter: {} }]}
              showRelayCloseReason
              isInDeckView={true}
            />
          )
        }
      }
      break
    case 'custom':
      if (column.props?.customFeedId) {
        const customFeed = customFeeds.find((f) => f.id === column.props.customFeedId)
        if (customFeed) {
          titlebar = <CustomFeedTitlebar name={customFeed.name} onClose={() => unpinColumn(column.id)} />
          const { searchParams } = customFeed
          if (searchParams.type === 'notes') {
            content = (
              <NormalFeed
                subRequests={[
                  { urls: SEARCHABLE_RELAY_URLS, filter: { search: searchParams.search } }
                ]}
                showRelayCloseReason
                isInDeckView={true}
              />
            )
          } else if (searchParams.type === 'hashtag') {
            content = (
              <NormalFeed
                subRequests={[{ urls: BIG_RELAY_URLS, filter: { '#t': [searchParams.search] } }]}
                showRelayCloseReason
                isInDeckView={true}
              />
            )
          }
        }
      }
      break
    case 'bookmarks':
      titlebar = <BookmarksTitlebar onClose={() => unpinColumn(column.id)} />
      content = (
        <div className="px-4 pt-4">
          <BookmarkList />
        </div>
      )
      break
    case 'highlights':
      titlebar = <HighlightsTitlebar onClose={() => unpinColumn(column.id)} />
      content = (
        <div className="px-4 pt-4">
          <HighlightsList />
        </div>
      )
      break
    case 'reads':
      titlebar = <ReadsTitlebar onClose={() => unpinColumn(column.id)} />
      content = <ReadsContent />
      break
    case 'lists':
      titlebar = <ListsIndexTitlebar onClose={() => unpinColumn(column.id)} />
      content = <ListsIndexContent />
      break
    case 'list':
      if (column.props?.listId) {
        titlebar = <ListTitlebar listId={column.props.listId} title={column.props.title} onClose={() => unpinColumn(column.id)} />
        content = <ListContent listId={column.props.listId} />
      }
      break
  }

  if (!content) {
    return null
  }

  return (
    <div
      className={cn(
        'shadow-lg bg-background overflow-hidden flex flex-col',
        pageTheme === 'pure-black' && 'border border-neutral-900',
        pageTheme === 'white' && 'border border-border shadow-none'
      )}
      style={{ borderRadius: 'var(--card-radius, 8px)' }}
    >
      {titlebar && (
        <div className={cn(
          "sticky top-0 z-10 border-b bg-background h-12 flex items-center",
          pageTheme === 'pure-black' && 'border-neutral-900',
          pageTheme === 'white' && 'border-border'
        )}>
          {titlebar}
        </div>
      )}
      <DeepBrowsingProvider active={true} scrollAreaRef={scrollAreaRef}>
        <ScrollArea
          className="h-full overflow-auto"
          scrollBarClassName="z-50 pt-12"
          ref={scrollAreaRef}
        >
          {content}
          <div className="h-4" />
        </ScrollArea>
      </DeepBrowsingProvider>
    </div>
  )
}

// Titlebar components
function ExploreTitlebar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Compass className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {t('Explore')}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function NotificationsTitlebar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Bell className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {t('Notifications')}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function ProfileTitlebar({ pubkey, onClose }: { pubkey: string; onClose: () => void }) {
  const { profile } = useFetchProfile(pubkey)
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <UserRound className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          <Username userId={pubkey} />
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function SearchTitlebar({ searchParams, onClose }: { searchParams: any; onClose: () => void }) {
  const displayText = searchParams.input || searchParams.search || 'Search'
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Search className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {displayText}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function RelayTitlebar({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Server className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {simplifyUrl(url)}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function RelaySetTitlebar({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Server className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {name}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function CustomFeedTitlebar({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Search className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {name}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function BookmarksTitlebar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Bookmark className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {t('Bookmarks')}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function HighlightsTitlebar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Highlighter className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {t('Highlights')}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function ReadsTitlebar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {t('Reads')}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function ReadsContent() {
  const { pubkey } = useNostr()
  const { followings } = useFetchFollowings(pubkey)
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])

  useEffect(() => {
    if (!pubkey || !followings.length) {
      setSubRequests([])
      return
    }

    const init = async () => {
      const relayList = await client.fetchRelayList(pubkey)
      setSubRequests([
        {
          urls: relayList.read.concat(BIG_RELAY_URLS).slice(0, 8),
          filter: {
            authors: followings
          }
        }
      ])
    }

    init()
  }, [pubkey, followings])

  if (!pubkey || !followings.length) {
    return null
  }

  return <ArticleList subRequests={subRequests} />
}

function ListsIndexTitlebar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <List className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {t('Lists')}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function ListTitlebar({ listId, title, onClose }: { listId: string; title?: string; onClose: () => void }) {
  const { lists } = useLists()

  // If no title is provided, try to get it from the list
  const displayTitle = (() => {
    if (title) return title

    // Parse listId to get the d-tag
    const dTag = listId.includes(':') ? listId.split(':')[1] : listId
    const list = lists.find((l) => l.id === dTag)
    return list?.title || 'List'
  })()

  return (
    <div className="flex items-center justify-between gap-2 px-3 h-full w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Users className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {displayTitle}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function ListsIndexContent() {
  const { t } = useTranslation()
  const { lists, isLoading } = useLists()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 px-4">
        <div className="text-muted-foreground">{t('Loading lists...')}</div>
      </div>
    )
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
        <Users className="w-16 h-16 text-muted-foreground opacity-50" />
        <div className="text-muted-foreground text-center">{t('No lists yet')}</div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4">
      {/* Import the ListsIndexPage content here or create a reusable component */}
      <div className="text-muted-foreground">{t('Lists index view in deck')}</div>
    </div>
  )
}

function ListContent({ listId }: { listId: string }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { lists, isLoading: isLoadingMyLists } = useLists()
  const [externalList, setExternalList] = useState<any>(null)
  const [isLoadingExternal, setIsLoadingExternal] = useState(false)

  // Parse listId - could be "d-tag" or "pubkey:d-tag"
  const { ownerPubkey, dTag } = (() => {
    if (listId.includes(':')) {
      const [pk, tag] = listId.split(':')
      return { ownerPubkey: pk, dTag: tag }
    }
    return { ownerPubkey: pubkey, dTag: listId }
  })()

  const isOwnList = ownerPubkey === pubkey

  // Try to find in own lists first
  const ownList = lists.find((l) => l.id === dTag && l.event.pubkey === ownerPubkey)

  // Fetch external list if not found in own lists
  useEffect(() => {
    const fetchExternalList = async () => {
      if (isOwnList || ownList || !ownerPubkey || !dTag) {
        setExternalList(null)
        return
      }

      setIsLoadingExternal(true)
      try {
        const events = await client.fetchEvents(BIG_RELAY_URLS.slice(0, 5), {
          kinds: [ExtendedKind.STARTER_PACK],
          authors: [ownerPubkey],
          '#d': [dTag],
          limit: 1
        })

        if (events.length > 0) {
          const event = events[0]
          const parsedList = parseStarterPackEvent(event)
          setExternalList(parsedList)
        }
      } catch (error) {
        console.error('Failed to fetch external list:', error)
      } finally {
        setIsLoadingExternal(false)
      }
    }

    fetchExternalList()
  }, [ownerPubkey, dTag, isOwnList, ownList])

  const parseStarterPackEvent = (event: any) => {
    const dTag = event.tags.find((tag: any) => tag[0] === 'd')?.[1] || ''
    const title = event.tags.find((tag: any) => tag[0] === 'title')?.[1] || 'Untitled List'
    const description = event.tags.find((tag: any) => tag[0] === 'description')?.[1]
    const image = event.tags.find((tag: any) => tag[0] === 'image')?.[1]
    const pubkeys = event.tags.filter((tag: any) => tag[0] === 'p').map((tag: any) => tag[1])

    return {
      id: dTag,
      title,
      description,
      image,
      pubkeys,
      event
    }
  }

  const list = ownList || externalList
  const isLoading = isLoadingMyLists || isLoadingExternal

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('Loading list...')}</div>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Users className="w-16 h-16 text-muted-foreground opacity-50" />
        <div className="text-muted-foreground">{t('List not found')}</div>
      </div>
    )
  }

  const validPubkeys = Array.isArray(list.pubkeys) ? list.pubkeys.filter((pk: string) => pk && typeof pk === 'string' && pk.length > 0) : []

  if (validPubkeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Users className="w-16 h-16 text-muted-foreground opacity-50" />
        <div className="text-muted-foreground">{t('No members in this list')}</div>
      </div>
    )
  }

  return (
    <NormalFeed
      subRequests={[
        {
          urls: BIG_RELAY_URLS,
          filter: {
            authors: validPubkeys,
            kinds: [1, 6]
          }
        }
      ]}
      showRelayCloseReason
      isInDeckView={true}
    />
  )
}
