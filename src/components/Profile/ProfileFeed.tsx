import KindFilter from '@/components/KindFilter'
import NoteList, { TNoteListRef } from '@/components/NoteList'
import ArticleList, { TArticleListRef } from '@/components/ArticleList'
import Tabs from '@/components/Tabs'
import { BIG_RELAY_URLS, MAX_PINNED_NOTES } from '@/constants'
import { generateBech32IdFromETag } from '@/lib/tag'
import { isTouchDevice } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useReadsVisibility } from '@/providers/ReadsVisibilityProvider'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { TFeedSubRequest, TNoteListMode } from '@/types'
import { NostrEvent, kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshButton } from '../RefreshButton'

export default function ProfileFeed({
  pubkey,
  topSpace = 0,
  isInDeckView = false
}: {
  pubkey: string
  topSpace?: number
  isInDeckView?: boolean
}) {
  const { pubkey: myPubkey, pinListEvent: myPinListEvent } = useNostr()
  const { showKinds } = useKindFilter()
  const { hideReadsInProfiles } = useReadsVisibility()
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(showKinds)
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])
  const [pinnedEventIds, setPinnedEventIds] = useState<string[]>([])
  const tabs = useMemo(() => {
    const _tabs = [
      { value: 'posts', label: 'Notes' },
      { value: 'postsAndReplies', label: 'Replies' },
      { value: 'highlights', label: 'Highlights' }
    ]

    if (!hideReadsInProfiles) {
      _tabs.push({ value: 'reads', label: 'Reads' })
    }

    if (myPubkey && myPubkey !== pubkey) {
      _tabs.push({ value: 'you', label: 'YouTabName' })
    }

    return _tabs
  }, [myPubkey, pubkey, hideReadsInProfiles])
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)
  const articleListRef = useRef<TArticleListRef>(null)

  useEffect(() => {
    // If user is on reads tab and it gets hidden, switch to posts
    if (listMode === 'reads' && hideReadsInProfiles) {
      setListMode('posts')
    }
  }, [hideReadsInProfiles, listMode])

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
      if (listMode === 'you') {
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
            urls: myRelayList.write.concat(BIG_RELAY_URLS).slice(0, 5),
            filter: {
              authors: [myPubkey],
              '#p': [pubkey]
            }
          },
          {
            urls: relayList.write.concat(BIG_RELAY_URLS).slice(0, 5),
            filter: {
              authors: [pubkey],
              '#p': [myPubkey]
            }
          }
        ])
        return
      }

      const relayList = await client.fetchRelayList(pubkey)
      setSubRequests([
        {
          urls: relayList.write.concat(BIG_RELAY_URLS).slice(0, 8),
          filter: {
            authors: [pubkey]
          }
        }
      ])
    }
    init()
  }, [pubkey, listMode])

  const handleListModeChange = (mode: TNoteListMode) => {
    setListMode(mode)
    noteListRef.current?.scrollToTop('smooth')
    articleListRef.current?.scrollToTop('smooth')
  }

  const handleShowKindsChange = (newShowKinds: number[]) => {
    setTemporaryShowKinds(newShowKinds)
    noteListRef.current?.scrollToTop('instant')
  }

  return (
    <>
      <Tabs
        value={listMode}
        tabs={tabs}
        onTabChange={(listMode) => {
          handleListModeChange(listMode as TNoteListMode)
        }}
        threshold={Math.max(800, topSpace)}
        options={
          <>
            {!supportTouch && listMode !== 'reads' && listMode !== 'highlights' && <RefreshButton onClick={() => noteListRef.current?.refresh()} />}
            {!supportTouch && listMode === 'reads' && <RefreshButton onClick={() => articleListRef.current?.refresh()} />}
            {!supportTouch && listMode === 'highlights' && <RefreshButton onClick={() => noteListRef.current?.refresh()} />}
            {listMode !== 'reads' && listMode !== 'highlights' && <KindFilter showKinds={temporaryShowKinds} onShowKindsChange={handleShowKindsChange} />}
          </>
        }
        isInDeckView={isInDeckView}
      />
      {listMode === 'reads' ? (
        <ArticleList
          ref={articleListRef}
          subRequests={subRequests}
        />
      ) : listMode === 'highlights' ? (
        <NoteList
          ref={noteListRef}
          subRequests={subRequests}
          showKinds={[kinds.Highlights]}
          hideReplies={false}
          filterMutedNotes={false}
          pinnedEventIds={[]}
        />
      ) : (
        <NoteList
          ref={noteListRef}
          subRequests={subRequests}
          showKinds={temporaryShowKinds}
          hideReplies={listMode === 'posts'}
          filterMutedNotes={false}
          pinnedEventIds={listMode === 'you' ? [] : pinnedEventIds}
        />
      )}
    </>
  )
}
