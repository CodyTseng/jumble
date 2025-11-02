import { fetchPubkeysFromDomain } from '@/lib/nip05'
import indexDb from '@/services/indexed-db.service'
import { TAwesomeNip05CommunityCollection, TNip05Community, TNip05DomainInfo } from '@/types'
import DataLoader from 'dataloader'
import FlexSearch from 'flexsearch'
import { LRUCache } from 'lru-cache'

const CACHE_EXPIRATION = 1000 * 60 * 60 * 24 // 24 hours

class Nip05CommunityService {
  static instance: Nip05CommunityService

  public static getInstance(): Nip05CommunityService {
    if (!Nip05CommunityService.instance) {
      Nip05CommunityService.instance = new Nip05CommunityService()
    }
    return Nip05CommunityService.instance
  }

  private awesomeCommunityCollections: Promise<TAwesomeNip05CommunityCollection[]> | null = null
  private communityMap = new Map<string, TNip05Community>()
  private domainInfoMap = new Map<string, TNip05DomainInfo>()
  private communityIndex = new FlexSearch.Index({
    tokenize: 'forward',
    encode: (str) =>
      str
        // eslint-disable-next-line no-control-regex
        .replace(/[^\x00-\x7F]/g, (match) => ` ${match} `)
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
  })

  private fetchCommunityDataloader = new DataLoader<string, TNip05Community | undefined>(
    async (domains) => {
      const results = await Promise.allSettled(domains.map((domain) => this._getCommunity(domain)))
      return results.map((res) => (res.status === 'fulfilled' ? res.value : undefined))
    },
    { maxBatchSize: 1 }
  )

  // Cache for member fetching to avoid repeated .well-known requests
  private memberFetchCache = new LRUCache<string, string[]>({
    max: 100,
    ttl: CACHE_EXPIRATION
  })

  /**
   * Search for communities by domain name, display name, or description
   */
  async search(query: string): Promise<TNip05Community[]> {
    if (!query) {
      // Return random communities if no query
      const arr = Array.from(this.communityMap.values())
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }

    const result = await this.communityIndex.searchAsync(query)
    return result
      .map((domain) => this.communityMap.get(domain as string))
      .filter(Boolean) as TNip05Community[]
  }

  /**
   * Get community data for a single domain
   */
  async getCommunity(domain: string): Promise<TNip05Community | undefined> {
    return this.fetchCommunityDataloader.load(domain)
  }

  /**
   * Get community data for multiple domains
   */
  async getCommunities(domains: string[]): Promise<(TNip05Community | undefined)[]> {
    if (domains.length === 0) {
      return []
    }
    const communities = await this.fetchCommunityDataloader.loadMany(domains)
    return communities.map((community) => (community instanceof Error ? undefined : community))
  }

  /**
   * Get all cached communities
   */
  async getAllCommunities(): Promise<TNip05Community[]> {
    return Array.from(this.communityMap.values())
  }

  /**
   * Fetch curated community collections from awesome-nostr-domains repo
   * Similar to awesome-nostr-relays but for NIP-05 domains
   */
  async getAwesomeCommunityCollections(): Promise<TAwesomeNip05CommunityCollection[]> {
    if (this.awesomeCommunityCollections) return this.awesomeCommunityCollections

    this.awesomeCommunityCollections = (async () => {
      try {
        // TODO: Update this URL when awesome-nostr-domains repo is created
        // For now, return a hardcoded list of popular Nostr domains
        const hardcodedCollections: TAwesomeNip05CommunityCollection[] = [
          {
            id: 'popular',
            name: 'Popular Communities',
            description: 'Well-known Nostr domain communities',
            category: 'Popular',
            domains: [
              'nostr.build',
              'nostrplebs.com',
              'stacker.news',
              'primal.net',
              'iris.to',
              'snort.social'
            ]
          },
          {
            id: 'bitcoin',
            name: 'Bitcoin Communities',
            description: 'Bitcoin and Lightning focused communities',
            category: 'Topic-Based',
            domains: ['bitcoin.org', 'lightning.network', 'btc.us']
          },
          {
            id: 'development',
            name: 'Developer Communities',
            description: 'Nostr protocol and app developers',
            category: 'Topic-Based',
            domains: ['nostr.com', 'nostr.dev']
          }
        ]

        return hardcodedCollections

        // Future implementation when repo exists:
        // const res = await fetch(
        //   'https://raw.githubusercontent.com/USERNAME/awesome-nostr-domains/master/dist/collections.json'
        // )
        // if (!res.ok) {
        //   throw new Error('Failed to fetch awesome community collections')
        // }
        // const data = (await res.json()) as { collections: TAwesomeNip05CommunityCollection[] }
        // return data.collections
      } catch (error) {
        console.error('Error fetching awesome community collections:', error)
        return []
      }
    })()

    return this.awesomeCommunityCollections
  }

  /**
   * Refresh community member list from domain's .well-known/nostr.json
   */
  async refreshCommunityMembers(domain: string): Promise<TNip05Community | undefined> {
    try {
      console.log('Refreshing members for domain:', domain)

      // Clear cache for this domain
      this.memberFetchCache.delete(domain)

      // Fetch members from .well-known/nostr.json
      const members = await fetchPubkeysFromDomain(domain)

      if (members.length === 0) {
        console.warn('No members found for domain:', domain)
        return undefined
      }

      // Get existing community data or create new
      const existingCommunity = await indexDb.getNip05Community(domain)
      const domainInfo = await this.getDomainInfo(domain)

      const community: TNip05Community = {
        id: domain,
        domain,
        name: existingCommunity?.name || domainInfo?.name || domain,
        description: existingCommunity?.description || domainInfo?.description,
        icon: existingCommunity?.icon || domainInfo?.icon,
        members,
        memberCount: members.length,
        lastUpdated: Date.now(),
        featured: existingCommunity?.featured || false,
        tags: existingCommunity?.tags || []
      }

      // Update cache and storage
      await this.addCommunity(community)

      return community
    } catch (error) {
      console.error('Error refreshing community members:', domain, error)
      return undefined
    }
  }

  /**
   * Get or fetch domain metadata info
   */
  async getDomainInfo(domain: string): Promise<TNip05DomainInfo | undefined> {
    const cached = this.domainInfoMap.get(domain)
    if (cached) {
      return cached
    }

    // Check IndexedDB
    const stored = await indexDb.getNip05DomainInfo(domain)
    if (stored && Date.now() - stored.lastChecked < CACHE_EXPIRATION) {
      this.domainInfoMap.set(domain, stored)
      return stored
    }

    // For now, create a basic domain info
    // In the future, could fetch from domain's metadata endpoint
    const domainInfo: TNip05DomainInfo = {
      domain,
      verified: true, // Will be verified when we fetch members
      lastChecked: Date.now()
    }

    this.domainInfoMap.set(domain, domainInfo)
    await indexDb.putNip05DomainInfo(domainInfo)

    return domainInfo
  }

  /**
   * Get community statistics
   */
  async getCommunityStats(domain: string): Promise<{
    memberCount: number
    lastUpdated: number
    isStale: boolean
  } | null> {
    const community = await this.getCommunity(domain)
    if (!community) {
      return null
    }

    const isStale = Date.now() - community.lastUpdated > CACHE_EXPIRATION

    return {
      memberCount: community.memberCount || 0,
      lastUpdated: community.lastUpdated,
      isStale
    }
  }

  /**
   * Get featured/curated communities
   */
  async getFeaturedCommunities(): Promise<TNip05Community[]> {
    const all = await this.getAllCommunities()
    return all.filter((c) => c.featured)
  }

  /**
   * Initialize service by loading cached communities from IndexedDB
   */
  async init(): Promise<void> {
    try {
      const stored = await indexDb.getAllNip05Communities()
      for (const community of stored) {
        this.communityMap.set(community.domain, community)
        await this.communityIndex.addAsync(
          community.domain,
          [community.domain, community.name ?? '', community.description ?? ''].join(' ')
        )
      }
      console.log(`Loaded ${stored.length} communities from cache`)
    } catch (error) {
      console.error('Error initializing NIP-05 community service:', error)
    }
  }

  /**
   * Private: Get community with caching and storage
   */
  private async _getCommunity(domain: string): Promise<TNip05Community | undefined> {
    // Check memory cache
    const cached = this.communityMap.get(domain)
    if (cached && Date.now() - cached.lastUpdated < CACHE_EXPIRATION) {
      return cached
    }

    // Check IndexedDB
    const stored = await indexDb.getNip05Community(domain)
    if (stored && Date.now() - stored.lastUpdated < CACHE_EXPIRATION) {
      this.communityMap.set(domain, stored)
      return stored
    }

    // Fetch fresh data
    return await this.refreshCommunityMembers(domain)
  }

  /**
   * Private: Add community to cache and storage
   */
  private async addCommunity(community: TNip05Community): Promise<TNip05Community> {
    this.communityMap.set(community.domain, community)

    await Promise.allSettled([
      this.communityIndex.addAsync(
        community.domain,
        [community.domain, community.name ?? '', community.description ?? ''].join(' ')
      ),
      indexDb.putNip05Community(community)
    ])

    return community
  }

  /**
   * Get members for a domain (with caching)
   */
  async getDomainMembers(domain: string): Promise<string[]> {
    console.log('[Nip05CommunityService] Getting members for domain:', domain)

    // Check cache first
    const cached = this.memberFetchCache.get(domain)
    if (cached) {
      console.log('[Nip05CommunityService] Found cached members:', cached.length)
      return cached
    }

    // Check if we have it in community data
    const community = await this.getCommunity(domain)
    if (community && Date.now() - community.lastUpdated < CACHE_EXPIRATION) {
      console.log('[Nip05CommunityService] Found community data with members:', community.members.length)
      this.memberFetchCache.set(domain, community.members)
      return community.members
    }

    // Fetch fresh
    console.log('[Nip05CommunityService] Fetching fresh members from .well-known/nostr.json')
    const members = await fetchPubkeysFromDomain(domain)
    console.log('[Nip05CommunityService] Fetched members:', members.length, members)
    this.memberFetchCache.set(domain, members)

    return members
  }
}

const instance = Nip05CommunityService.getInstance()
export default instance
