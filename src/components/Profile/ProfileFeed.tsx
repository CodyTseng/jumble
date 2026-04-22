import FeedTabsCustomizeDialog from '@/components/FeedTabsCustomizeDialog'
import KindFilter from '@/components/KindFilter'
import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import { MAX_PINNED_NOTES } from '@/constants'
import { getDefaultRelayUrls, getSearchRelayUrls } from '@/lib/relay'
import { generateBech32IdFromETag } from '@/lib/tag'
import { isTouchDevice } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import client from '@/services/client.service'
import relayInfoService from '@/services/relay-info.service'
import { TFeedSubRequest, TFeedTabConfig } from '@/types'
import { NostrEvent } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshButton } from '../RefreshButton'

const YOU_TAB: TFeedTabConfig = { id: 'you', label: 'YouTabName' }

export default function ProfileFeed({ pubkey, search = '' }: { pubkey: string; search?: string }) {
  const { pubkey: myPubkey, pinListEvent: myPinListEvent } = useNostr()
  const { getShowKinds } = useKindFilter()
  const { feedTabs } = useUserPreferences()
  const feedId = `profile-${pubkey}`
  const feedShowKinds = useMemo(() => getShowKinds(feedId), [getShowKinds, feedId])
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(feedShowKinds)

  const visibleTabs = useMemo(() => {
    const base = feedTabs.filter((tab) => !tab.hidden && tab.builtin !== '24h')
    if (myPubkey && myPubkey !== pubkey) {
      return [...base, YOU_TAB]
    }
    return base
  }, [feedTabs, myPubkey, pubkey])

  const [selectedTabId, setSelectedTabId] = useState<string | undefined>()
  const selectedTab: TFeedTabConfig = selectedTabId
    ? (visibleTabs.find((tab) => tab.id === selectedTabId) ?? visibleTabs[0])
    : visibleTabs[0]

  useEffect(() => {
    if (selectedTab && selectedTab.id !== selectedTabId) {
      setSelectedTabId(selectedTab.id)
    }
  }, [selectedTab, selectedTabId])

  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])
  const [pinnedEventIds, setPinnedEventIds] = useState<string[]>([])
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)

  const isYouMode = selectedTab?.id === 'you'
  const tabHasFixedKinds = !!selectedTab?.kinds
  const effectiveShowKinds = selectedTab?.kinds ?? temporaryShowKinds
  const hideReplies = selectedTab?.hideReplies ?? false

  useEffect(() => {
    const initPinnedEventIds = async () => {
      let evt: NostrEvent | null = null
      if (pubkey === myPubkey) {
        evt = myPinListEvent
      } else {
        evt = await client.fetchPinListEvent(pubkey)
      }
      const hexIdSet = new Set<string>()
      const ids =
        (evt?.tags
          .filter((tag) => tag[0] === 'e')
          .reverse()
          .slice(0, MAX_PINNED_NOTES)
          .map((tag) => {
            const [, hexId, relay, _pubkey] = tag
            if (!hexId || hexIdSet.has(hexId) || (_pubkey && _pubkey !== pubkey)) {
              return undefined
            }

            const id = generateBech32IdFromETag(['e', hexId, relay ?? '', pubkey])
            if (id) {
              hexIdSet.add(hexId)
            }
            return id
          })
          .filter(Boolean) as string[]) ?? []
      setPinnedEventIds(ids)
    }
    initPinnedEventIds()
  }, [pubkey, myPubkey, myPinListEvent])

  useEffect(() => {
    const init = async () => {
      if (isYouMode) {
        if (!myPubkey) {
          setSubRequests([])
          return
        }

        const [relayList, myRelayList] = await Promise.all([
          client.fetchRelayList(pubkey),
          client.fetchRelayList(myPubkey)
        ])

        setSubRequests([
          {
            urls: myRelayList.write.concat(getDefaultRelayUrls()).slice(0, 5),
            filter: {
              authors: [myPubkey],
              '#p': [pubkey]
            }
          },
          {
            urls: relayList.write.concat(getDefaultRelayUrls()).slice(0, 5),
            filter: {
              authors: [pubkey],
              '#p': [myPubkey]
            }
          }
        ])
        return
      }

      const relayList = await client.fetchRelayList(pubkey)

      if (search) {
        const writeRelays = relayList.write.slice(0, 8)
        const relayInfos = await relayInfoService.getRelayInfos(writeRelays)
        const searchableRelays = writeRelays.filter((_, index) =>
          relayInfos[index]?.supported_nips?.includes(50)
        )
        setSubRequests([
          {
            urls: searchableRelays.concat(getSearchRelayUrls()).slice(0, 8),
            filter: { authors: [pubkey], search }
          }
        ])
      } else {
        setSubRequests([
          {
            urls: relayList.write.concat(getDefaultRelayUrls()).slice(0, 8),
            filter: {
              authors: [pubkey]
            }
          }
        ])
      }
    }
    init()
  }, [pubkey, isYouMode, search])

  const handleListModeChange = (mode: string) => {
    setSelectedTabId(mode)
    noteListRef.current?.scrollToTop('smooth')
  }

  const handleShowKindsChange = (newShowKinds: number[]) => {
    setTemporaryShowKinds(newShowKinds)
    noteListRef.current?.scrollToTop('instant')
  }

  return (
    <>
      <Tabs
        value={selectedTab?.id ?? ''}
        tabs={visibleTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
        onTabChange={handleListModeChange}
        onCustomize={() => setCustomizeOpen(true)}
        options={
          <>
            {!supportTouch && <RefreshButton onClick={() => noteListRef.current?.refresh()} />}
            {!tabHasFixedKinds && (
              <KindFilter
                feedId={feedId}
                showKinds={temporaryShowKinds}
                onShowKindsChange={handleShowKindsChange}
              />
            )}
          </>
        }
      />
      <NoteList
        ref={noteListRef}
        subRequests={subRequests}
        showKinds={effectiveShowKinds}
        hideReplies={hideReplies}
        filterMutedNotes={false}
        pinnedEventIds={isYouMode || tabHasFixedKinds || !!search ? [] : pinnedEventIds}
        showNewNotesDirectly={myPubkey === pubkey}
      />
      <FeedTabsCustomizeDialog open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </>
  )
}
