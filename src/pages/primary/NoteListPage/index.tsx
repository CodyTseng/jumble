import NoteList from '@/components/NoteList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { useEffect, useRef } from 'react'
import RelaySettingsButton from './RelaySettingsButton'
import SearchButton from './SearchButton'

export default function NoteListPage() {
  const layoutRef = useRef<{ scrollToTop: () => void }>(null)
  const { relayUrls } = useRelaySettings()
  const relayUrlsString = JSON.stringify(relayUrls)
  useEffect(() => {
    if (layoutRef.current) {
      layoutRef.current.scrollToTop()
    }
  }, [relayUrlsString])

  return (
    <PrimaryPageLayout pageName="home" ref={layoutRef} titlebar={<NoteListPageTitlebar />}>
      {!!relayUrls.length && <NoteList relayUrls={relayUrls} />}
    </PrimaryPageLayout>
  )
}

function NoteListPageTitlebar() {
  return (
    <div className="flex gap-1 items-center h-full justify-between">
      <RelaySettingsButton />
      <SearchButton />
    </div>
  )
}
