import { IS_COMMUNITY_MODE, COMMUNITY_RELAY_SETS, COMMUNITY_RELAYS } from '@/constants'
import { getRelaySetFromEvent } from '@/lib/event-metadata'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import { TFeedInfo, TFeedType, TRelaySet } from '@/types'
import { kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useFavoriteRelays } from './FavoriteRelaysProvider'
import { useNostr } from './NostrProvider'

type TFeedContext = {
  feedInfo: TFeedInfo
  relayUrls: string[]
  isReady: boolean
  switchFeed: (
    feedType: TFeedType | null,
    options?: {
      activeRelaySetId?: string
      followSetId?: string
      pubkey?: string
      relay?: string | null
    }
  ) => Promise<void>
}

const FeedContext = createContext<TFeedContext | undefined>(undefined)

export const useFeed = () => {
  const context = useContext(FeedContext)
  if (!context) {
    throw new Error('useFeed must be used within a FeedProvider')
  }
  return context
}

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { pubkey, isInitialized } = useNostr()
  const { relaySets } = useFavoriteRelays()
  const [relayUrls, setRelayUrls] = useState<string[]>([])
  const [isReady, setIsReady] = useState(false)
  const [feedInfo, setFeedInfo] = useState<TFeedInfo>(null)
  const feedInfoRef = useRef<TFeedInfo>(feedInfo)

  const activePubkey = useRef(pubkey)
  activePubkey.current = pubkey
  const requestId = useRef(0)

  useEffect(() => {
    if (!isInitialized) return

    const saved = pubkey ? storage.getFeedInfo(pubkey) : null
    if (saved) {
      void switchFeed(
        saved.feedType,
        { activeRelaySetId: saved.id, followSetId: saved.id, relay: saved.id, pubkey },
        true
      )
      return
    }

    const currentType = feedInfoRef.current?.feedType
    if (currentType === 'relay' || currentType === 'relays') {
      // A shared relay feed can stay open when the new account has no preference.
      requestId.current++
      setIsReady(true)
      return
    }

    if (IS_COMMUNITY_MODE) {
      if (COMMUNITY_RELAY_SETS.length) {
        void switchFeed('relays', { activeRelaySetId: COMMUNITY_RELAY_SETS[0].id }, true)
      } else {
        void switchFeed('relay', { relay: COMMUNITY_RELAYS[0] }, true)
      }
    } else {
      const personalType = currentType === 'pinned' ? 'pinned' : 'following'
      void switchFeed(pubkey ? personalType : null, { pubkey }, true)
    }
  }, [pubkey, isInitialized])

  const switchFeed = async (
    feedType: TFeedType | null,
    options: {
      activeRelaySetId?: string
      followSetId?: string
      pubkey?: string | null
      relay?: string | null
    } = {},
    restoring = false
  ) => {
    if (activePubkey.current !== pubkey) return
    const request = ++requestId.current
    setIsReady(false)
    let nextFeed: TFeedInfo = null
    let nextRelays: string[] = []

    if (feedType === 'relay') {
      const url = normalizeUrl(options.relay ?? '')
      if (url && isWebsocketUrl(url)) {
        nextFeed = { feedType, id: url }
        nextRelays = [url]
      }
    } else if (feedType === 'relays') {
      const id = options.activeRelaySetId
      const available = IS_COMMUNITY_MODE
        ? COMMUNITY_RELAY_SETS
        : relaySets.filter((set) => set.aTag[1]?.startsWith(`${kinds.Relaysets}:${pubkey}:`))
      let relaySet: TRelaySet | undefined = available.find((set) => set.id === id)
      if (!relaySet && id && pubkey && !IS_COMMUNITY_MODE) {
        try {
          const stored = await indexedDb.getReplaceableEvent(pubkey, kinds.Relaysets, id)
          if (stored) relaySet = getRelaySetFromEvent(stored)
        } catch (error) {
          console.warn('Could not restore relay set', error)
        }
      }
      relaySet ??= restoring && id ? undefined : available[0]
      if (relaySet) {
        nextFeed = { feedType, id: relaySet.id }
        nextRelays = relaySet.relayUrls
      }
    } else if (pubkey && options.pubkey === pubkey) {
      if (feedType === 'following' || feedType === 'pinned') {
        nextFeed = { feedType }
      } else if (
        feedType === 'follow-set' &&
        !IS_COMMUNITY_MODE &&
        options.followSetId?.startsWith(`${kinds.Followsets}:${pubkey}:`)
      ) {
        nextFeed = { feedType, id: options.followSetId }
      }
    }

    if (request !== requestId.current || activePubkey.current !== pubkey) return
    if (restoring && !nextFeed && pubkey && !IS_COMMUNITY_MODE) {
      nextFeed = { feedType: 'following' }
    }
    if (nextFeed || restoring || !feedType) {
      setFeedInfo(nextFeed)
      feedInfoRef.current = nextFeed
      setRelayUrls(nextRelays)
      if (nextFeed && !restoring) storage.setFeedInfo(nextFeed, pubkey)
    }
    setIsReady(true)
  }

  return (
    <FeedContext.Provider
      value={{
        feedInfo,
        relayUrls,
        isReady,
        switchFeed
      }}
    >
      {children}
    </FeedContext.Provider>
  )
}
