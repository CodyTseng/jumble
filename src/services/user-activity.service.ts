import { LRUCache } from 'lru-cache'

const CACHE_EXPIRATION = 1000 * 60 * 60 // 1 hour
const BATCH_DELAY = 100 // ms to wait before batching requests

export type TUserActivity = {
  pubkey: string
  noteCount: number
  followerCount: number
  lastFetched: number
}

class UserActivityService {
  static instance: UserActivityService

  public static getInstance(): UserActivityService {
    if (!UserActivityService.instance) {
      UserActivityService.instance = new UserActivityService()
    }
    return UserActivityService.instance
  }

  private activityCache = new LRUCache<string, TUserActivity>({
    max: 500,
    ttl: CACHE_EXPIRATION
  })

  private pendingBatch: Set<string> = new Set()
  private batchTimeout: NodeJS.Timeout | null = null
  private pendingPromises = new Map<
    string,
    { resolve: (value: TUserActivity | null) => void; reject: (error: Error) => void }[]
  >()

  /**
   * Get user activity stats for a single pubkey
   */
  async getUserActivity(pubkey: string): Promise<TUserActivity | null> {
    // Check cache first
    const cached = this.activityCache.get(pubkey)
    if (cached) {
      return cached
    }

    // Add to pending batch
    return new Promise((resolve, reject) => {
      if (!this.pendingPromises.has(pubkey)) {
        this.pendingPromises.set(pubkey, [])
      }
      this.pendingPromises.get(pubkey)!.push({ resolve, reject })

      this.pendingBatch.add(pubkey)

      // Schedule batch fetch
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout)
      }

      this.batchTimeout = setTimeout(() => {
        this.executeBatch()
      }, BATCH_DELAY)
    })
  }

  /**
   * Get user activity stats for multiple pubkeys
   */
  async getUserActivities(pubkeys: string[]): Promise<(TUserActivity | null)[]> {
    const results = await Promise.allSettled(pubkeys.map((pubkey) => this.getUserActivity(pubkey)))
    return results.map((res) => (res.status === 'fulfilled' ? res.value : null))
  }

  /**
   * Execute batched fetch from nostr.band API
   */
  private async executeBatch(): Promise<void> {
    if (this.pendingBatch.size === 0) return

    const pubkeys = Array.from(this.pendingBatch)
    this.pendingBatch.clear()
    this.batchTimeout = null

    try {
      // Fetch from nostr.band API
      const results = await Promise.allSettled(
        pubkeys.map((pubkey) => this.fetchUserActivityFromAPI(pubkey))
      )

      results.forEach((result, index) => {
        const pubkey = pubkeys[index]
        const promises = this.pendingPromises.get(pubkey) || []

        if (result.status === 'fulfilled' && result.value) {
          // Cache the result
          this.activityCache.set(pubkey, result.value)

          // Resolve all promises for this pubkey
          promises.forEach((p) => p.resolve(result.value))
        } else {
          // Resolve with null if fetch failed
          promises.forEach((p) => p.resolve(null))
        }

        this.pendingPromises.delete(pubkey)
      })
    } catch (error) {
      console.error('Error executing batch fetch:', error)

      // Reject all pending promises
      pubkeys.forEach((pubkey) => {
        const promises = this.pendingPromises.get(pubkey) || []
        promises.forEach((p) =>
          p.reject(error instanceof Error ? error : new Error('Unknown error'))
        )
        this.pendingPromises.delete(pubkey)
      })
    }
  }

  /**
   * Fetch user activity from nostr.band API
   */
  private async fetchUserActivityFromAPI(pubkey: string): Promise<TUserActivity | null> {
    try {
      const url = `https://api.nostr.band/v0/stats/profile/${pubkey}`
      console.log('[UserActivityService] Fetching from API:', url)
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(`[UserActivityService] Failed to fetch activity for ${pubkey}: ${response.statusText}`)
        return null
      }

      const data = await response.json()
      console.log('[UserActivityService] API response for', pubkey, ':', data)

      // Extract relevant stats from nostr.band response
      // The stats are nested under the pubkey: data.stats[pubkey]
      const stats = data.stats?.[pubkey] || {}
      console.log('[UserActivityService] Extracted stats for', pubkey, ':', stats)

      const activity = {
        pubkey,
        noteCount: stats.pub_note_count || stats.note_count || 0,
        followerCount: stats.followers_pubkey_count || 0,
        lastFetched: Date.now()
      }

      console.log('[UserActivityService] Parsed activity:', activity)
      return activity
    } catch (error) {
      console.error(`[UserActivityService] Error fetching activity for ${pubkey}:`, error)
      return null
    }
  }

  /**
   * Get top active members from a list of pubkeys
   */
  async getTopActiveMembers(
    pubkeys: string[],
    limit: number = 10
  ): Promise<TUserActivity[]> {
    console.log('[UserActivityService] getTopActiveMembers called with', pubkeys.length, 'pubkeys')
    const activities = await this.getUserActivities(pubkeys)
    console.log('[UserActivityService] Got activities:', activities.length, activities)

    const filtered = activities.filter(
      (activity): activity is TUserActivity => activity !== null && activity.noteCount > 0
    )
    console.log('[UserActivityService] Filtered activities (noteCount > 0):', filtered.length, filtered)

    const sorted = filtered.sort((a, b) => b.noteCount - a.noteCount)
    console.log('[UserActivityService] Sorted activities:', sorted)

    const result = sorted.slice(0, limit)
    console.log('[UserActivityService] Top', limit, 'members:', result)

    return result
  }

  /**
   * Clear cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.activityCache.clear()
  }
}

const instance = UserActivityService.getInstance()
export default instance
