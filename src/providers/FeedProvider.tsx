import { DEFAULT_FAVORITE_RELAYS } from '@/constants'
import { checkAlgoRelay } from '@/lib/relay'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import relayInfoService from '@/services/relay-info.service'
import { TFeedInfo, TFeedType } from '@/types'
import { Filter } from 'nostr-tools'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useFavoriteRelays } from './FavoriteRelaysProvider'
import { useNostr } from './NostrProvider'

type TFeedContext = {
  feedInfo: TFeedInfo
  relayUrls: string[]
  temporaryRelayUrls: string[]
  filter: Filter
  isReady: boolean
  switchFeed: (
    feedType: TFeedType,
    options?: { activeRelaySetId?: string; pubkey?: string; relay?: string | null }
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
  const isFirstRenderRef = useRef(true)
  const { pubkey, isInitialized } = useNostr()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const [relayUrls, setRelayUrls] = useState<string[]>([])
  const [temporaryRelayUrls, setTemporaryRelayUrls] = useState<string[]>([])
  const [filter, setFilter] = useState<Filter>({})
  const [isReady, setIsReady] = useState(false)
  const [feedInfo, setFeedInfo] = useState<TFeedInfo>({
    feedType: 'relay',
    id: DEFAULT_FAVORITE_RELAYS[0]
  })
  const feedInfoRef = useRef<TFeedInfo>(feedInfo)

  useEffect(() => {
    const init = async () => {
      const isFirstRender = isFirstRenderRef.current
      isFirstRenderRef.current = false
      if (isFirstRender) {
        // temporary relay urls from query params
        const searchParams = new URLSearchParams(window.location.search)
        const temporaryRelayUrls = searchParams
          .getAll('r')
          .map((url) => normalizeUrl(url))
          .filter((url) => url && isWebsocketUrl(url))
        if (temporaryRelayUrls.length) {
          return await switchFeed('temporary', { temporaryRelayUrls })
        }
      }

      if (feedInfoRef.current.feedType === 'temporary') {
        return
      }

      if (!isInitialized) {
        return
      }

      let feedInfo: TFeedInfo = {
        feedType: 'relay',
        id: favoriteRelays[0] ?? DEFAULT_FAVORITE_RELAYS[0]
      }
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

      // update following feed if pubkey changes
      if (feedInfo.feedType === 'following' && pubkey) {
        return await switchFeed('following', { pubkey })
      }

      if (feedInfo.feedType === 'bookmarks' && pubkey) {
        return await switchFeed('bookmarks', { pubkey })
      }
    }

    init()
  }, [pubkey, isInitialized])

  const switchFeed = async (
    feedType: TFeedType,
    options: {
      activeRelaySetId?: string | null
      temporaryRelayUrls?: string[] | null
      pubkey?: string | null
      relay?: string | null
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
      setFilter({})
      storage.setFeedInfo(newFeedInfo, pubkey)
      setIsReady(true)

      const relayInfo = await relayInfoService.getRelayInfo(normalizedUrl)
      client.setCurrentRelayUrls(checkAlgoRelay(relayInfo) ? [] : [normalizedUrl])
      return
    }
    if (feedType === 'relays') {
      const relaySetId = options.activeRelaySetId ?? (relaySets.length > 0 ? relaySets[0].id : null)
      if (!relaySetId) {
        setIsReady(true)
        return
      }

      const relaySet =
        relaySets.find((set) => set.id === options.activeRelaySetId) ??
        (relaySets.length > 0 ? relaySets[0] : null)
      if (relaySet) {
        const newFeedInfo = { feedType, id: relaySet.id }
        setFeedInfo(newFeedInfo)
        feedInfoRef.current = newFeedInfo
        setRelayUrls(relaySet.relayUrls)
        setFilter({})
        storage.setFeedInfo(newFeedInfo, pubkey)
        setIsReady(true)

        const relayInfos = await relayInfoService.getRelayInfos(relaySet.relayUrls)
        client.setCurrentRelayUrls(
          relaySet.relayUrls.filter((_, i) => !relayInfos[i] || !checkAlgoRelay(relayInfos[i]))
        )
      }
      setIsReady(true)
      return
    }
    if (feedType === 'following') {
      if (!options.pubkey) {
        return setIsReady(true)
      }
      const newFeedInfo = { feedType }
      setFeedInfo(newFeedInfo)
      feedInfoRef.current = newFeedInfo
      storage.setFeedInfo(newFeedInfo, pubkey)

      const followings = await client.fetchFollowings(options.pubkey, true)
      setRelayUrls([])
      setFilter({
        authors: followings.includes(options.pubkey) ? followings : [...followings, options.pubkey]
      })
      return setIsReady(true)
    }
    if (feedType === 'bookmarks') {
      if (!options.pubkey) {
        return setIsReady(true)
      }

      const newFeedInfo = { feedType }
      setFeedInfo(newFeedInfo)
      feedInfoRef.current = newFeedInfo
      storage.setFeedInfo(newFeedInfo, pubkey)

      setRelayUrls([])
      setFilter({})
      return setIsReady(true)
    }
    if (feedType === 'temporary') {
      const urls = options.temporaryRelayUrls ?? temporaryRelayUrls
      if (!urls.length) {
        return setIsReady(true)
      }

      const newFeedInfo = { feedType }
      setFeedInfo(newFeedInfo)
      feedInfoRef.current = newFeedInfo
      setTemporaryRelayUrls(urls)
      setRelayUrls(urls)
      setFilter({})
      setIsReady(true)

      const relayInfos = await relayInfoService.getRelayInfos(urls)
      client.setCurrentRelayUrls(
        urls.filter((_, i) => !relayInfos[i] || !checkAlgoRelay(relayInfos[i]))
      )
      return
    }
    setIsReady(true)
  }

  return (
    <FeedContext.Provider
      value={{
        feedInfo,
        relayUrls,
        temporaryRelayUrls,
        filter,
        isReady,
        switchFeed
      }}
    >
      {children}
    </FeedContext.Provider>
  )
}
