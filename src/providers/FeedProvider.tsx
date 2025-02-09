import { BIG_RELAY_URLS } from '@/constants'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import client from '@/services/client.service'
import storage from '@/services/storage.service'
import { TFeedType } from '@/types'
import { Filter } from 'nostr-tools'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useFollowList } from './FollowListProvider'
import { useNostr } from './NostrProvider'
import { useRelaySets } from './RelaySetsProvider'

type TFeedContext = {
  feedType: TFeedType
  relayUrls: string[]
  temporaryRelayUrls: string[]
  filter: Filter
  isReady: boolean
  activeRelaySetId: string | null
  switchFeed: (
    feedType: TFeedType,
    options?: { activeRelaySetId?: string; pubkey?: string }
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
  const { pubkey, getRelayList } = useNostr()
  const { getFollowings } = useFollowList()
  const { relaySets } = useRelaySets()
  const feedTypeRef = useRef<TFeedType>(storage.getFeedType())
  const [feedType, setFeedType] = useState<TFeedType>(feedTypeRef.current)
  const [relayUrls, setRelayUrls] = useState<string[]>([])
  const [temporaryRelayUrls, setTemporaryRelayUrls] = useState<string[]>([])
  const [filter, setFilter] = useState<Filter>({})
  const [isReady, setIsReady] = useState(false)
  const [activeRelaySetId, setActiveRelaySetId] = useState<string | null>(
    storage.getActiveRelaySetId()
  )

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
          .filter((url) => isWebsocketUrl(url))
        if (temporaryRelayUrls.length) {
          return await switchFeed('temporary', { temporaryRelayUrls })
        }

        if (feedTypeRef.current === 'relays') {
          return await switchFeed('relays', { activeRelaySetId })
        }
      }

      if (feedTypeRef.current === 'following' && pubkey) {
        return await switchFeed('following', { pubkey })
      }
    }

    init()
  }, [pubkey])

  const switchFeed = async (
    feedType: TFeedType,
    options: {
      activeRelaySetId?: string | null
      temporaryRelayUrls?: string[] | null
      pubkey?: string | null
    } = {}
  ) => {
    setIsReady(false)
    if (feedType === 'relays') {
      const relaySetId = options.activeRelaySetId ?? (relaySets.length > 0 ? relaySets[0].id : null)
      if (!relaySetId) {
        return setIsReady(true)
      }

      const relaySet =
        relaySets.find((set) => set.id === options.activeRelaySetId) ??
        (relaySets.length > 0 ? relaySets[0] : null)
      if (relaySet) {
        feedTypeRef.current = feedType
        setFeedType(feedType)
        setRelayUrls(relaySet.relayUrls)
        setActiveRelaySetId(relaySet.id)
        setFilter({})
        storage.setActiveRelaySetId(relaySet.id)
        storage.setFeedType(feedType)
        client.setCurrentRelayUrls(relaySet.relayUrls)
      }
      return setIsReady(true)
    }
    if (feedType === 'following') {
      if (!options.pubkey) {
        return setIsReady(true)
      }
      feedTypeRef.current = feedType
      setFeedType(feedType)
      setActiveRelaySetId(null)
      const [relayList, followings] = await Promise.all([
        getRelayList(options.pubkey),
        getFollowings(options.pubkey)
      ])
      setRelayUrls(relayList.read.concat(BIG_RELAY_URLS).slice(0, 4))
      setFilter({
        authors: followings.includes(options.pubkey) ? followings : [...followings, options.pubkey]
      })
      storage.setFeedType(feedType)
      return setIsReady(true)
    }
    if (feedType === 'temporary') {
      const urls = options.temporaryRelayUrls ?? temporaryRelayUrls
      if (!urls.length) {
        return setIsReady(true)
      }

      feedTypeRef.current = feedType
      setFeedType(feedType)
      setTemporaryRelayUrls(urls)
      setRelayUrls(urls)
      setActiveRelaySetId(null)
      setFilter({})
      client.setCurrentRelayUrls(urls)
      return setIsReady(true)
    }
    setIsReady(true)
  }

  return (
    <FeedContext.Provider
      value={{
        feedType,
        relayUrls,
        temporaryRelayUrls,
        filter,
        isReady,
        activeRelaySetId,
        switchFeed
      }}
    >
      {children}
    </FeedContext.Provider>
  )
}
