import { getProfileFromEvent } from '@/lib/event-metadata'
import { BoundedMap } from '@/lib/bounded-map'
import { proxyFetch } from '@/lib/proxy-fetch'
import { userIdToPubkey } from '@/lib/pubkey'
import { TProfile } from '@/types'
import DataLoader from 'dataloader'
import { NostrEvent } from 'nostr-tools'
import client from './client.service'

const SERVICE_URL = 'https://fayan.jumble.social'

class FayanService {
  static instance: FayanService

  private userPercentileDataLoader = new DataLoader<string, number | null>(
    async (pubkeys) => {
      try {
        const res = await proxyFetch(`${SERVICE_URL}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pubkeys })
        })
        if (!res.ok) {
          return new Array(pubkeys.length).fill(null)
        }
        const data = JSON.parse(res.body)
        return pubkeys.map((pubkey) => data[pubkey]?.percentile ?? 0)
      } catch {
        return new Array(pubkeys.length).fill(null)
      }
    },
    {
      maxBatchSize: 50,
      cacheKeyFn: (userId) => {
        return userIdToPubkey(userId)
      },
      cacheMap: new BoundedMap<string, Promise<number | null>>({ maxSize: 5_000 })
    }
  )
  private searchResultCache = new BoundedMap<string, TProfile[]>({ maxSize: 100 })

  constructor() {
    if (!FayanService.instance) {
      FayanService.instance = this
    }
    return FayanService.instance
  }

  // null means server error
  async fetchUserPercentile(userId: string): Promise<number | null> {
    return await this.userPercentileDataLoader.load(userId)
  }

  async searchUsers(query: string, limit = 20, offset = 0) {
    const cache = this.searchResultCache.get(query)
    if (cache) {
      if (offset + limit <= cache.length) {
        console.log('FayanService searchUsers returning from cache')
        return cache.slice(offset, offset + limit)
      }
    }
    try {
      const url = new URL('/search', SERVICE_URL)
      url.searchParams.append('q', query)
      url.searchParams.append('limit', limit.toString())
      if (offset > 0) {
        url.searchParams.append('offset', offset.toString())
      }

      const res = await proxyFetch(url.toString())
      if (!res.ok) {
        return []
      }
      const data = JSON.parse(res.body) as { event: NostrEvent; percentile: number }[]
      const profiles: TProfile[] = []
      data.forEach(({ event, percentile }) => {
        const profile = getProfileFromEvent(event)
        profiles.push(profile)
        this.userPercentileDataLoader.prime(profile.pubkey, percentile)
        client.updateProfileEventCache(event)
      })

      // Cache the results
      const existingCache = this.searchResultCache.get(query) || []
      if (offset === 0) {
        this.searchResultCache.set(query, profiles)
      } else if (offset <= existingCache.length) {
        const newCache = existingCache.slice(0, offset).concat(profiles)
        this.searchResultCache.set(query, newCache)
      }

      return profiles
    } catch {
      return []
    }
  }
}

const instance = new FayanService()
export default instance
