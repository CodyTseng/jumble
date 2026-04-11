import { usePrimaryPage } from '@/PageManager'
import FollowingFeed from '@/components/FollowingFeed'
import LoginDialog from '@/components/LoginDialog'
import MeDrawer from '@/components/MeDrawer'
import RelayInfo from '@/components/RelayInfo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TPageRef } from '@/types'
import { LONG_PRESS_THRESHOLD } from '@/constants'
import { Info, LogIn, Search, Sparkles, UserRound } from 'lucide-react'
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
import PinnedFeed from './PinnedFeed'
import RelaysFeed from './RelaysFeed'

const NoteListPage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  const { addRelayUrls, removeRelayUrls } = useCurrentRelays()
  const layoutRef = useRef<TPageRef>(null)
  const { pubkey } = useNostr()
  const { feedInfo, relayUrls, isReady, switchFeed } = useFeed()
  const [showRelayDetails, setShowRelayDetails] = useState(false)
  const [meDrawerOpen, setMeDrawerOpen] = useState(false)

  useImperativeHandle(ref, () => layoutRef.current as TPageRef)

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
    content = (
      <div className="pt-3 text-center text-sm text-muted-foreground">{t('loading...')}</div>
    )
  } else if (!feedInfo) {
    content = <WelcomeGuide />
  } else if (feedInfo.feedType === 'following' && !pubkey) {
    switchFeed(null)
    return null
  } else if (feedInfo.feedType === 'pinned' && !pubkey) {
    switchFeed(null)
    return null
  } else if (feedInfo.feedType === 'following') {
    content = <FollowingFeed />
  } else if (feedInfo.feedType === 'pinned') {
    content = <PinnedFeed />
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
    <>
      <PrimaryPageLayout
        pageName="home"
        ref={layoutRef}
        titlebar={
          <NoteListPageTitlebar
            layoutRef={layoutRef}
            showRelayDetails={showRelayDetails}
            setShowRelayDetails={
              feedInfo?.feedType === 'relay' && !!feedInfo.id ? setShowRelayDetails : undefined
            }
            setMeDrawerOpen={setMeDrawerOpen}
          />
        }
        displayScrollToTopButton
      >
        {content}
      </PrimaryPageLayout>
      <MeDrawer open={meDrawerOpen} setOpen={setMeDrawerOpen} />
    </>
  )
})
NoteListPage.displayName = 'NoteListPage'
export default NoteListPage

function NoteListPageTitlebar({
  layoutRef,
  showRelayDetails,
  setShowRelayDetails,
  setMeDrawerOpen
}: {
  layoutRef?: React.RefObject<TPageRef>
  showRelayDetails?: boolean
  setShowRelayDetails?: Dispatch<SetStateAction<boolean>>
  setMeDrawerOpen?: Dispatch<SetStateAction<boolean>>
}) {
  const { isSmallScreen } = useScreenSize()
  const { pubkey, profile } = useNostr()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)

  const handlePointerDown = () => {
    longPressedRef.current = false
    pressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true
      setLoginDialogOpen(true)
      pressTimerRef.current = null
    }, LONG_PRESS_THRESHOLD)
  }

  const handlePointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleClick = () => {
    if (!longPressedRef.current && !loginDialogOpen) {
      if (pubkey) {
        setMeDrawerOpen?.(true)
      } else {
        setLoginDialogOpen(true)
      }
    }
  }

  if (isSmallScreen) {
    return (
      <>
      <div className="grid h-full grid-cols-[48px_1fr_48px] items-center">
        <div className="flex justify-center">
          <button
            className="flex size-8 items-center justify-center rounded-full"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onClick={handleClick}
          >
            {pubkey ? (
              profile ? (
                <SimpleUserAvatar userId={pubkey} ignorePolicy className="size-7" />
              ) : (
                <Skeleton className="size-7 rounded-full" />
              )
            ) : (
              <UserRound className="size-5" />
            )}
          </button>
        </div>
        <div className="flex justify-center">
          <FeedButton className="max-w-fit" compact />
        </div>
        <div className="flex justify-end">
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
              className={showRelayDetails ? 'bg-muted/40' : ''}
            >
              <Info />
            </Button>
          )}
        </div>
      </div>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
      </>
    )
  }

  return (
    <div className="flex h-full items-center justify-between gap-1">
      <FeedButton className="w-0 max-w-fit flex-1" />
      <div className="flex shrink-0 items-center gap-1">
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
            className={showRelayDetails ? 'bg-muted/40' : ''}
          >
            <Info />
          </Button>
        )}
      </div>
    </div>
  )
}

function WelcomeGuide() {
  const { t } = useTranslation()
  const { navigate } = usePrimaryPage()
  const { checkLogin } = useNostr()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4 text-center">
      <div className="space-y-2">
        <div className="flex w-full items-center justify-center gap-2">
          <Sparkles className="text-yellow-400" />
          <h2 className="text-2xl font-bold">{t('Welcome to Jumble')}</h2>
          <Sparkles className="text-yellow-400" />
        </div>
        <p className="max-w-md text-muted-foreground">
          {t(
            'Jumble is a client focused on browsing relays. Get started by exploring interesting relays or login to view your following feed.'
          )}
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <Button size="lg" className="w-full" onClick={() => navigate('search')}>
          <Search className="size-5" />
          {t('Explore')}
        </Button>

        <Button size="lg" className="w-full" variant="outline" onClick={() => checkLogin()}>
          <LogIn className="size-5" />
          {t('Login')}
        </Button>
      </div>
    </div>
  )
}
