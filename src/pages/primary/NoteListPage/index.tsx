import { useSecondaryPage } from '@/PageManager'
import BookmarkList from '@/components/BookmarkList'
import HighlightsList from '@/components/HighlightsList'
import NormalFeed from '@/components/NormalFeed'
import PostEditor from '@/components/PostEditor'
import RelayInfo from '@/components/RelayInfo'
import PinButton from '@/components/PinButton'
import { Button } from '@/components/ui/button'
import { BIG_RELAY_URLS, SEARCHABLE_RELAY_URLS } from '@/constants'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { toSearch } from '@/lib/link'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { useCustomFeeds } from '@/providers/CustomFeedsProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TPageRef } from '@/types'
import { Info, PencilLine, Search } from 'lucide-react'
import {
  Dispatch,
  forwardRef,
  SetStateAction,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import FeedButton from './FeedButton'
import FollowingFeed from './FollowingFeed'
import RelaysFeed from './RelaysFeed'

const NoteListPage = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const { addRelayUrls, removeRelayUrls } = useCurrentRelays()
  const layoutRef = useRef<TPageRef>(null)
  const { pubkey, checkLogin } = useNostr()
  const { feedInfo, relayUrls, isReady } = useFeed()
  const { customFeeds } = useCustomFeeds()
  const [showRelayDetails, setShowRelayDetails] = useState(false)
  useImperativeHandle(ref, () => layoutRef.current)

  useEffect(() => {
    if (layoutRef.current) {
      layoutRef.current.scrollToTop('instant')
    }
  }, [JSON.stringify(relayUrls), feedInfo])

  useEffect(() => {
    if (relayUrls.length) {
      addRelayUrls(relayUrls)
      return () => {
        removeRelayUrls(relayUrls)
      }
    }
  }, [relayUrls])

  let content: React.ReactNode = null
  if (!isReady) {
    content = <div className="text-center text-sm text-muted-foreground">{t('loading...')}</div>
  } else if (feedInfo.feedType === 'following' && !pubkey) {
    content = (
      <div className="flex justify-center w-full">
        <Button size="lg" onClick={() => checkLogin()}>
          {t('Please login to view following feed')}
        </Button>
      </div>
    )
  } else if (feedInfo.feedType === 'bookmarks') {
    if (!pubkey) {
      content = (
        <div className="flex justify-center w-full">
          <Button size="lg" onClick={() => checkLogin()}>
            {t('Please login to view bookmarks')}
          </Button>
        </div>
      )
    } else {
      content = <BookmarkList />
    }
  } else if (feedInfo.feedType === 'highlights') {
    if (!pubkey) {
      content = (
        <div className="flex justify-center w-full">
          <Button size="lg" onClick={() => checkLogin()}>
            {t('Please login to view highlights')}
          </Button>
        </div>
      )
    } else {
      content = <HighlightsList />
    }
  } else if (feedInfo.feedType === 'custom') {
    const customFeed = customFeeds.find((f) => f.id === feedInfo.id)
    if (!customFeed) {
      content = (
        <div className="text-center text-sm text-muted-foreground">
          {t('Custom feed not found')}
        </div>
      )
    } else {
      // Render the feed based on search params
      const { searchParams } = customFeed
      if (searchParams.type === 'notes') {
        content = (
          <NormalFeed
            subRequests={[{ urls: SEARCHABLE_RELAY_URLS, filter: { search: searchParams.search } }]}
            showRelayCloseReason
          />
        )
      } else if (searchParams.type === 'hashtag') {
        content = (
          <NormalFeed
            subRequests={[{ urls: BIG_RELAY_URLS, filter: { '#t': [searchParams.search] } }]}
            showRelayCloseReason
          />
        )
      }
    }
  } else if (feedInfo.feedType === 'following') {
    content = <FollowingFeed />
  } else {
    content = (
      <>
        {showRelayDetails && feedInfo.feedType === 'relay' && !!feedInfo.id && (
          <RelayInfo url={feedInfo.id!} className="mb-2 pt-3" />
        )}
        <RelaysFeed />
      </>
    )
  }

  return (
    <PrimaryPageLayout
      pageName="home"
      ref={layoutRef}
      titlebar={
        <NoteListPageTitlebar
          layoutRef={layoutRef}
          showRelayDetails={showRelayDetails}
          setShowRelayDetails={
            feedInfo.feedType === 'relay' && !!feedInfo.id ? setShowRelayDetails : undefined
          }
        />
      }
      displayScrollToTopButton
    >
      {content}
    </PrimaryPageLayout>
  )
})
NoteListPage.displayName = 'NoteListPage'
export default NoteListPage

function NoteListPageTitlebar({
  layoutRef,
  showRelayDetails,
  setShowRelayDetails
}: {
  layoutRef?: React.RefObject<TPageRef>
  showRelayDetails?: boolean
  setShowRelayDetails?: Dispatch<SetStateAction<boolean>>
}) {
  const { isSmallScreen } = useScreenSize()
  const { feedInfo } = useFeed()
  const { customFeeds } = useCustomFeeds()

  // Determine pin button based on feed type
  let pinButton: React.ReactNode = null

  if (feedInfo.feedType === 'bookmarks') {
    pinButton = <PinButton column={{ type: 'bookmarks' }} size="titlebar-icon" />
  } else if (feedInfo.feedType === 'highlights') {
    pinButton = <PinButton column={{ type: 'highlights' }} size="titlebar-icon" />
  } else if (feedInfo.feedType === 'relay' && feedInfo.id) {
    pinButton = <PinButton column={{ type: 'relay', props: { url: feedInfo.id } }} size="titlebar-icon" />
  } else if (feedInfo.feedType === 'relays' && feedInfo.id) {
    pinButton = <PinButton column={{ type: 'relays', props: { activeRelaySetId: feedInfo.id } }} size="titlebar-icon" />
  } else if (feedInfo.feedType === 'custom' && feedInfo.id) {
    const customFeed = customFeeds.find((f) => f.id === feedInfo.id)
    if (customFeed) {
      pinButton = <PinButton column={{ type: 'custom', props: { customFeedId: feedInfo.id } }} size="titlebar-icon" />
    }
  }

  return (
    <div className="flex gap-1 items-center h-full justify-between">
      <FeedButton className="flex-1 max-w-fit w-0" />
      <div className="shrink-0 flex gap-1 items-center">
        {pinButton}
        {setShowRelayDetails && (
          <Button
            variant="ghost"
            size="titlebar-icon"
            onClick={(e) => {
              e.stopPropagation()
              setShowRelayDetails((show) => !show)

              if (!showRelayDetails) {
                layoutRef?.current?.scrollToTop('smooth')
              }
            }}
            className={showRelayDetails ? 'bg-accent/50' : ''}
          >
            <Info />
          </Button>
        )}
        {isSmallScreen && (
          <>
            <SearchButton />
            <PostButton />
          </>
        )}
      </div>
    </div>
  )
}

function PostButton() {
  const { checkLogin } = useNostr()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="titlebar-icon"
        onClick={(e) => {
          e.stopPropagation()
          checkLogin(() => {
            setOpen(true)
          })
        }}
      >
        <PencilLine />
      </Button>
      <PostEditor open={open} setOpen={setOpen} />
    </>
  )
}

function SearchButton() {
  const { push } = useSecondaryPage()

  return (
    <Button variant="ghost" size="titlebar-icon" onClick={() => push(toSearch())}>
      <Search />
    </Button>
  )
}
