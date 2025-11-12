import { sortEventsDesc } from '@/lib/event'
import { isValidPubkey } from '@/lib/pubkey'
import client from '@/services/client.service'
import DataLoader from 'dataloader'
import { Filter } from 'nostr-tools'

/**
 * NIP-43: Relay Access Metadata and Requests
 * https://github.com/nostr-protocol/nips/blob/master/43.md
 */
class RelayMembershipService {
  private static instance: RelayMembershipService
  private membershipListCache: Map<string, Promise<Set<string>>> = new Map()
  private membershipListDataLoader = new DataLoader<
    { url: string; pubkey: string },
    Set<string>,
    string
  >(
    async (params) => {
      return Promise.all(params.map(({ url, pubkey }) => this.fetchMembershipList(url, pubkey)))
    },
    { cacheKeyFn: (key) => key.url, cacheMap: this.membershipListCache }
  )

  public static getInstance(): RelayMembershipService {
    if (!RelayMembershipService.instance) {
      RelayMembershipService.instance = new RelayMembershipService()
    }
    return RelayMembershipService.instance
  }

  /**
   * Check if a user is a member of a relay that supports NIP-43
   * @param relayUrl The relay URL
   * @param userPubkey The user's public key
   * @param relayPubkey The relay's public key from NIP-11
   * @returns Membership status
   */
  async checkMembership(
    relayUrl: string,
    userPubkey: string,
    relayPubkey?: string
  ): Promise<boolean> {
    if (!relayPubkey) {
      return false
    }

    const memberSet = await this.membershipListDataLoader.load({
      url: relayUrl,
      pubkey: relayPubkey
    })

    return memberSet.has(userPubkey)
  }

  private async fetchMembershipList(relayUrl: string, relayPubkey: string): Promise<Set<string>> {
    try {
      const filter: Filter = {
        kinds: [13534],
        authors: [relayPubkey],
        limit: 1
      }

      const events = await client.fetchEvents([relayUrl], filter)

      if (events.length === 0) {
        return new Set()
      }

      const membershipEvent = sortEventsDesc(events)[0]
      const members = membershipEvent.tags
        .filter((tag) => tag[0] === 'member' && isValidPubkey(tag[1]))
        .map((tag) => tag[1])

      return new Set(members)
    } catch (error) {
      console.error('Error checking relay membership:', error)
      return new Set()
    }
  }

  /**
   * Request an invite code from a relay (kind 28935)
   * @param relayUrl The relay URL
   * @param relayPubkey The relay's public key from NIP-11
   * @returns Invite code or null
   */
  async requestInviteCode(relayUrl: string, relayPubkey: string): Promise<string | null> {
    try {
      const filter: Filter = {
        kinds: [28935],
        authors: [relayPubkey],
        limit: 1
      }

      const events = await client.fetchEvents([relayUrl], filter)

      if (events.length === 0) {
        return null
      }

      const inviteEvent = events[0]
      const claimTag = inviteEvent.tags.find((tag) => tag[0] === 'claim')
      return claimTag?.[1] ?? null
    } catch (error) {
      console.error('Error requesting invite code:', error)
      return null
    }
  }

  async addNewMember(relayUrl: string, newMemberPubkey: string) {
    const cache = await this.membershipListCache.get(relayUrl)
    if (cache) {
      cache.add(newMemberPubkey)
    }
  }

  async removeMember(relayUrl: string, memberPubkey: string) {
    const cache = await this.membershipListCache.get(relayUrl)
    if (cache) {
      cache.delete(memberPubkey)
    }
  }
}

const instance = RelayMembershipService.getInstance()
export default instance
