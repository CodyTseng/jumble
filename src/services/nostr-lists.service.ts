import { ExtendedKind } from '@/constants'
import { Event, nip19 } from 'nostr-tools'
import client from './client.service'

export interface NostrList {
  id: string
  name: string
  description?: string
  pubkeys: string[]
  event: Event
}

class NostrListsService {
  private listsCache = new Map<string, NostrList>()
  private userListsCache = new Map<string, NostrList[]>()

  /**
   * Fetch Nostr lists (kind 30000) for a specific user
   */
  async fetchUserLists(userPubkey: string): Promise<NostrList[]> {
    if (this.userListsCache.has(userPubkey)) {
      return this.userListsCache.get(userPubkey)!
    }

    try {
      const events = await client.fetchEvents([
        {
          kinds: [ExtendedKind.PEOPLE_LIST],
          authors: [userPubkey],
          limit: 50
        }
      ])

      const lists: NostrList[] = events.map(event => this.parseListEvent(event))
      this.userListsCache.set(userPubkey, lists)
      
      // Cache individual lists
      lists.forEach(list => {
        this.listsCache.set(list.id, list)
      })

      return lists
    } catch (error) {
      console.error('Failed to fetch user lists:', error)
      return []
    }
  }

  /**
   * Parse a kind 30000 event into a NostrList
   */
  parseListEvent(event: Event): NostrList {
    const nameTag = event.tags.find(tag => tag[0] === 'name')
    const descriptionTag = event.tags.find(tag => tag[0] === 'description')
    const dTag = event.tags.find(tag => tag[0] === 'd')
    
    // Extract pubkeys from 'p' tags
    const pubkeys = event.tags
      .filter(tag => tag[0] === 'p' && tag[1])
      .map(tag => tag[1])

    return {
      id: dTag?.[1] || event.id,
      name: nameTag?.[1] || 'Unnamed List',
      description: descriptionTag?.[1],
      pubkeys,
      event
    }
  }

  /**
   * Search lists by name
   */
  searchLists(query: string, userPubkey: string): NostrList[] {
    const userLists = this.userListsCache.get(userPubkey) || []
    const lowerQuery = query.toLowerCase()
    
    return userLists.filter(list => 
      list.name.toLowerCase().includes(lowerQuery) ||
      list.description?.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Get list by ID
   */
  getList(listId: string): NostrList | undefined {
    return this.listsCache.get(listId)
  }

  /**
   * Generate mention text for a list
   */
  generateListMention(list: NostrList): string {
    try {
      // Create naddr for the list
      const naddr = nip19.naddrEncode({
        identifier: list.id,
        pubkey: list.event.pubkey,
        kind: ExtendedKind.PEOPLE_LIST
      })
      return `nostr:${naddr}`
    } catch (error) {
      console.error('Failed to generate list mention:', error)
      return `@${list.name}`
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.listsCache.clear()
    this.userListsCache.clear()
  }
}

export default new NostrListsService()
