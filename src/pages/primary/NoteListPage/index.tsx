import { useSecondaryPage } from '@/PageManager'
import PostEditor from '@/components/PostEditor'
import RelayInfo from '@/components/RelayInfo'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { toSearch } from '@/lib/link'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
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
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import DomainFeed from './DomainFeed'
import FollowingFeed from './FollowingFeed'
import RelaysFeed from './RelaysFeed'

type THomeFeedTab = 'domain' | 'following'

const NoteListPage = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const { addRelayUrls, removeRelayUrls } = useCurrentRelays()
  const layoutRef = useRef<TPageRef>(null)
  const { pubkey, checkLogin } = useNostr()
  const { feedInfo, relayUrls, isReady } = useFeed()
  const [showRelayDetails, setShowRelayDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<THomeFeedTab>('domain')
  useImperativeHandle(ref, () => layoutRef.current)

  // Determine if we should show tabs (only for domain community feeds)
  const showTabs = useMemo(() => {
    return (feedInfo.feedType === 'nip05-domain' || feedInfo.feedType === 'nip05-domains') && pubkey
  }, [feedInfo.feedType, pubkey])

  const tabs = useMemo(() => {
    return [
      { value: 'domain', label: feedInfo.id || 'Community' },
      { value: 'following', label: 'Following' }
    ]
  }, [feedInfo.id])

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
  } else if (feedInfo.feedType === 'following') {
    content = <FollowingFeed />
  } else if (feedInfo.feedType === 'nip05-domain' || feedInfo.feedType === 'nip05-domains') {
    // When showing tabs, render based on active tab
    if (showTabs) {
      content = activeTab === 'domain' ? <DomainFeed /> : <FollowingFeed forceLoad />
    } else {
      // No tabs (not logged in), just show domain feed
      content = <DomainFeed />
    }
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
          showTabs={showTabs}
          activeTab={activeTab}
          tabs={tabs}
          onTabChange={(tab) => {
            setActiveTab(tab as THomeFeedTab)
            layoutRef.current?.scrollToTop('smooth')
          }}
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
  setShowRelayDetails,
  showTabs,
  activeTab,
  tabs,
  onTabChange
}: {
  layoutRef?: React.RefObject<TPageRef>
  showRelayDetails?: boolean
  setShowRelayDetails?: Dispatch<SetStateAction<boolean>>
  showTabs?: boolean
  activeTab?: string
  tabs?: { value: string; label: string }[]
  onTabChange?: (tab: string) => void
}) {
  const { isSmallScreen } = useScreenSize()
  const { feedInfo } = useFeed()
  const { t } = useTranslation()

  return (
    <div className="flex gap-1 items-center h-full justify-between">
      {showTabs && tabs && activeTab && onTabChange ? (
        <div className="flex gap-2 items-center justify-center flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={`px-6 py-1 text-sm font-semibold rounded-lg transition-all flex-1 max-w-[200px] ${
                activeTab === tab.value
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>
      ) : (
        <>
          {feedInfo.feedType === 'following' && (
            <div className="flex gap-2 items-center px-2">
              <div className="font-semibold">{t('Following')}</div>
            </div>
          )}
          {(feedInfo.feedType === 'relay' || feedInfo.feedType === 'relays') && (
            <div className="flex gap-2 items-center px-2">
              <div className="font-semibold">{t('Relay Feed')}</div>
            </div>
          )}
        </>
      )}

      <div className="shrink-0 flex gap-1 items-center">
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
