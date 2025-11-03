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

      console.log('[FeedProvider] Initializing feed', {
        pubkey,
        nip05: profile?.nip05,
        isInitialized
      })

      let feedInfo: TFeedInfo = {
        feedType: 'relay',
        id: favoriteRelays[0] ?? DEFAULT_FAVORITE_RELAYS[0]
      }

      // Track NIP-05 changes
      let nip05Changed = false
      let currentDomain: string | null = null

      // If user has NIP-05, check if it's new or changed
      if (pubkey && profile?.nip05) {
        const nip05Parts = profile.nip05.split('@')
        console.log('[FeedProvider] NIP-05 parts:', nip05Parts)
        if (nip05Parts.length === 2) {
          const domain = nip05Parts[1].toLowerCase().trim()
          console.log('[FeedProvider] Extracted domain:', domain)
          if (domain) {
            currentDomain = domain
            const lastKnownNip05 = storage.getLastKnownNip05(pubkey)
            console.log('[FeedProvider] Last known NIP-05:', lastKnownNip05, 'Current:', profile.nip05)

            // Check if NIP-05 is new or has changed
            if (!lastKnownNip05 || lastKnownNip05 !== profile.nip05) {
              console.log('[FeedProvider] NIP-05 is new or changed, switching to community feed')
              nip05Changed = true
              feedInfo = {
                feedType: 'nip05-domain',
                id: domain
              }
              // Update the stored NIP-05
              storage.setLastKnownNip05(pubkey, profile.nip05)
            }
          }
        }
      } else if (pubkey) {
        // User doesn't have NIP-05 anymore (or never had one)
        const lastKnownNip05 = storage.getLastKnownNip05(pubkey)
        if (lastKnownNip05) {
          console.log('[FeedProvider] NIP-05 was removed')
          storage.setLastKnownNip05(pubkey, null)
          nip05Changed = true
        }
        console.log('[FeedProvider] No NIP-05 found, using relay feed')
      }

      // Check for stored feed preference (only if NIP-05 hasn't changed)
      if (pubkey && !nip05Changed) {
        const storedFeedInfo = storage.getFeedInfo(pubkey)
        if (storedFeedInfo) {
          console.log('[FeedProvider] Found stored feed preference:', storedFeedInfo)
          feedInfo = storedFeedInfo
        } else {
          console.log('[FeedProvider] No stored feed preference, using default:', feedInfo)
        }
      } else if (nip05Changed) {
        console.log('[FeedProvider] NIP-05 changed, using new community feed:', feedInfo)
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
      console.log('[FeedProvider] Switching to nip05-domain feed:', domain)
      if (!domain) {
        console.log('[FeedProvider] No domain provided, aborting')
        setIsReady(true)
        return
      }

      const newFeedInfo = { feedType, id: domain }
      console.log('[FeedProvider] Setting feedInfo:', newFeedInfo)
      setFeedInfo(newFeedInfo)
      feedInfoRef.current = newFeedInfo
      storage.setFeedInfo(newFeedInfo, pubkey)

      // For domain feeds, we set relayUrls to empty and let the feed consumer
      // handle fetching members and their relays
      setRelayUrls([])
      setIsReady(true)
      console.log('[FeedProvider] Domain feed ready')
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
