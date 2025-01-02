import NoteList from '@/components/NoteList'
import { BIG_RELAY_URLS } from '@/constants'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import FeedButton from './FeedButton'
import SearchButton from './SearchButton'

export default function NoteListPage() {
  const { t } = useTranslation()
  const layoutRef = useRef<{ scrollToTop: () => void }>(null)
  const { feedType } = useFeed()
  const { relayUrls, temporaryRelayUrls } = useRelaySettings()
  const { pubkey, relayList, followings } = useNostr()
  const urls = useMemo(() => {
    return feedType === 'following'
      ? relayList?.read.length
        ? relayList.read.slice(0, 4)
        : BIG_RELAY_URLS
      : temporaryRelayUrls.length > 0
        ? temporaryRelayUrls
        : relayUrls
  }, [feedType, relayUrls, relayList, temporaryRelayUrls])

  useEffect(() => {
    if (layoutRef.current) {
      layoutRef.current.scrollToTop()
    }
  }, [JSON.stringify(relayUrls), feedType])

  return (
    <PrimaryPageLayout
      pageName="home"
      ref={layoutRef}
      titlebar={<NoteListPageTitlebar />}
      displayScrollToTopButton
    >
      {!!urls.length && (feedType === 'relays' || (relayList && followings)) ? (
        <NoteList
          relayUrls={urls}
          filter={
            feedType === 'following'
              ? {
                  authors:
                    pubkey && !followings?.includes(pubkey)
                      ? [...(followings ?? []), pubkey]
                      : (followings ?? [])
                }
              : {}
          }
        />
      ) : (
        <div className="text-center text-sm text-muted-foreground">{t('loading...')}</div>
      )}
    </PrimaryPageLayout>
  )
}

function NoteListPageTitlebar() {
  return (
    <div className="flex gap-1 items-center h-full justify-between">
      <FeedButton />
      <SearchButton />
    </div>
  )
}
