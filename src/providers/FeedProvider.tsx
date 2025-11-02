import { DEFAULT_FAVORITE_RELAYS } from '@/constants'
import { getRelaySetFromEvent } from '@/lib/event-metadata'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import { TFeedInfo, TFeedType } from '@/types'
import { kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useFavoriteRelays } from './FavoriteRelaysProvider'
import { useNip05Communities } from './Nip05CommunitiesProvider'
import { useNostr } from './NostrProvider'

type TFeedContext = {
  feedInfo: TFeedInfo
  relayUrls: string[]
  isReady: boolean
  switchFeed: (
    feedType: TFeedType,
    options?: {
      activeRelaySetId?: string
      pubkey?: string
      relay?: string | null
      activeCommunitySetId?: string
      domain?: string | null
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
  const { pubkey, isInitialized, profile } = useNostr()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const { communitySets } = useNip05Communities()
  const [relayUrls, setRelayUrls] = useState<string[]>([])
  const [isReady, setIsReady] = useState(false)
  const [feedInfo, setFeedInfo] = useState<TFeedInfo>({
    feedType: 'relay',
    id: DEFAULT_FAVORITE_RELAYS[0]
  })
  const feedInfoRef = useRef<TFeedInfo>(feedInfo)

  useEffect(() => {
    const init = async () => {
      if (!isInitialized) {
        return
      }

      let feedInfo: TFeedInfo = {
        feedType: 'relay',
        id: favoriteRelays[0] ?? DEFAULT_FAVORITE_RELAYS[0]
      }

      // If user has NIP-05, default to their community feed
      if (pubkey && profile?.nip05) {
        const nip05Parts = profile.nip05.split('@')
        if (nip05Parts.length === 2) {
          const domain = nip05Parts[1].toLowerCase().trim()
          if (domain) {
            feedInfo = {
              feedType: 'nip05-domain',
              id: domain
            }
          }
        }
      }

      // Check for stored feed preference (user's manual selection overrides default)
      if (pubkey) {
        const storedFeedInfo = storage.getFeedInfo(pubkey)
        if (storedFeedInfo) {
          feedInfo = storedFeedInfo
        }
      }

      if (feedInfo.feedType === 'relays') {
        return await switchFeed('relays', { activeRelaySetId: feedInfo.id })
      }

      if (feedInfo.feedType === 'relay') {
        return await switchFeed('relay', { relay: feedInfo.id })
      }

      if (feedInfo.feedType === 'nip05-domains') {
        return await switchFeed('nip05-domains', { activeCommunitySetId: feedInfo.id })
      }

      if (feedInfo.feedType === 'nip05-domain') {
        return await switchFeed('nip05-domain', { domain: feedInfo.id })
      }

      // update following feed if pubkey changes
      if (feedInfo.feedType === 'following' && pubkey) {
        return await switchFeed('following', { pubkey })
      }
    }

    init()
  }, [pubkey, isInitialized, profile?.nip05, favoriteRelays])

  const switchFeed = async (
    feedType: TFeedType,
    options: {
      activeRelaySetId?: string | null
      pubkey?: string | null
      relay?: string | null
      activeCommunitySetId?: string | null
      domain?: string | null
    } = {}
  ) => {
    setIsReady(false)
    if (feedType === 'relay') {
      const normalizedUrl = normalizeUrl(options.relay ?? '')
      if (!normalizedUrl || !isWebsocketUrl(normalizedUrl)) {
        setIsReady(true)
        return
      }

      const newFeedInfo = { feedType, id: normalizedUrl }
      setFeedInfo(newFeedInfo)
      feedInfoRef.current = newFeedInfo
      setRelayUrls([normalizedUrl])
      storage.setFeedInfo(newFeedInfo, pubkey)
      setIsReady(true)
      return
    }
    if (feedType === 'relays') {
      const relaySetId = options.activeRelaySetId ?? (relaySets.length > 0 ? relaySets[0].id : null)
      if (!relaySetId || !pubkey) {
        setIsReady(true)
        return
      }

      let relaySet =
        relaySets.find((set) => set.id === relaySetId) ??
        (relaySets.length > 0 ? relaySets[0] : null)
      if (!relaySet) {
        const storedRelaySetEvent = await indexedDb.getReplaceableEvent(
          pubkey,
          kinds.Relaysets,
          relaySetId
        )
        if (storedRelaySetEvent) {
          relaySet = getRelaySetFromEvent(storedRelaySetEvent)
        }
      }
      if (relaySet) {
        const newFeedInfo = { feedType, id: relaySet.id }
        setFeedInfo(newFeedInfo)
        feedInfoRef.current = newFeedInfo
        setRelayUrls(relaySet.relayUrls)
        storage.setFeedInfo(newFeedInfo, pubkey)
        setIsReady(true)
      }
      setIsReady(true)
      return
    }
    if (feedType === 'following') {
      if (!options.pubkey) {
        setIsReady(true)
        return
      }
      const newFeedInfo = { feedType }
      setFeedInfo(newFeedInfo)
      feedInfoRef.current = newFeedInfo
      storage.setFeedInfo(newFeedInfo, pubkey)

      setRelayUrls([])
      setIsReady(true)
      return
    }
    if (feedType === 'nip05-domain') {
      const domain = (options.domain ?? '').toLowerCase().trim()
      if (!domain) {
        setIsReady(true)
        return
      }

      const newFeedInfo = { feedType, id: domain }
      setFeedInfo(newFeedInfo)
      feedInfoRef.current = newFeedInfo
      storage.setFeedInfo(newFeedInfo, pubkey)

      // For domain feeds, we set relayUrls to empty and let the feed consumer
      // handle fetching members and their relays
      setRelayUrls([])
      setIsReady(true)
      return
    }
    if (feedType === 'nip05-domains') {
      const communitySetId =
        options.activeCommunitySetId ?? (communitySets.length > 0 ? communitySets[0].id : null)
      if (!communitySetId) {
        setIsReady(true)
        return
      }

      let communitySet =
        communitySets.find((set) => set.id === communitySetId) ??
        (communitySets.length > 0 ? communitySets[0] : null)
      if (!communitySet) {
        const storedCommunitySet = await indexedDb.getNip05CommunitySet(communitySetId)
        if (storedCommunitySet) {
          communitySet = storedCommunitySet
        }
      }
      if (communitySet) {
        const newFeedInfo = { feedType, id: communitySet.id }
        setFeedInfo(newFeedInfo)
        feedInfoRef.current = newFeedInfo
        storage.setFeedInfo(newFeedInfo, pubkey)

        // For domain sets, we set relayUrls to empty and let the feed consumer
        // handle fetching members and their relays
        setRelayUrls([])
        setIsReady(true)
      }
      setIsReady(true)
      return
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
