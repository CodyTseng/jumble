import BookmarkList from '@/components/BookmarkList'
import NoteList from '@/components/NoteList'
import PostEditor from '@/components/PostEditor'
import SaveRelayDropdownMenu from '@/components/SaveRelayDropdownMenu'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TPageRef } from '@/types'
import { PencilLine } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FeedButton from './FeedButton'
import SearchButton from './SearchButton'

const NoteListPage = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const layoutRef = useRef<TPageRef>(null)
  const { pubkey, checkLogin } = useNostr()
  const { feedInfo, relayUrls, isReady, filter } = useFeed()
  useImperativeHandle(ref, () => layoutRef.current)

  useEffect(() => {
    if (layoutRef.current) {
      layoutRef.current.scrollToTop()
    }
  }, [JSON.stringify(relayUrls), feedInfo])

  let content = <div className="text-center text-sm text-muted-foreground">{t('loading...')}</div>
  if (feedInfo.feedType === 'following' && !pubkey) {
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
  } else if (isReady) {
    content = (
      <NoteList
        relayUrls={relayUrls}
        filter={filter}
        needCheckAlgoRelay={feedInfo.feedType !== 'following'}
        isMainFeed
      />
    )
  }

  return (
    <PrimaryPageLayout
      pageName="home"
      ref={layoutRef}
      titlebar={
        <NoteListPageTitlebar
          temporaryRelayUrls={feedInfo.feedType === 'temporary' ? relayUrls : []}
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

function NoteListPageTitlebar({ temporaryRelayUrls = [] }: { temporaryRelayUrls?: string[] }) {
  const { isSmallScreen } = useScreenSize()

  return (
    <div className="flex gap-1 items-center h-full justify-between">
      <FeedButton className="flex-1 max-w-fit w-0" />
      <div className="shrink-0 flex gap-1 items-center">
        {temporaryRelayUrls.length > 0 && (
          <SaveRelayDropdownMenu urls={temporaryRelayUrls} atTitlebar />
        )}
        <SearchButton />
        {isSmallScreen && <PostButton />}
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
