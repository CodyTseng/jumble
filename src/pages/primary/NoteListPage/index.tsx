import { usePrimaryPage } from '@/PageManager'
import FollowingFeed from '@/components/FollowingFeed'
import RelayInfo from '@/components/RelayInfo'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { TPageRef } from '@/types'
import { Info, LogIn, Search, Sparkles } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
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

  const showInfoToggle = feedInfo?.feedType === 'relay' && !!feedInfo.id
  const infoToggle = showInfoToggle ? (
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
  ) : null

  return (
    <PrimaryPageLayout
      pageName="home"
      ref={layoutRef}
      titlebar={
        <div className="flex h-full items-center justify-between gap-1">
          <FeedButton className="w-0 max-w-fit flex-1" />
          <div className="flex shrink-0 items-center gap-1">{infoToggle}</div>
        </div>
      }
      title={<FeedButton className="max-w-full" compact />}
      controls={infoToggle}
      displayScrollToTopButton
    >
      {content}
    </PrimaryPageLayout>
  )
})
NoteListPage.displayName = 'NoteListPage'
export default NoteListPage

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
