import { DEFAULT_DM_RELAYS, ExtendedKind } from '@/constants'
import { getDefaultRelayUrls } from '@/lib/relay'
import { normalizeUrl } from '@/lib/url'
import { ISigner } from '@/types'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import client from './client.service'
import encryptionKeyService from './encryption-key.service'

class DmRelayService {
  static instance: DmRelayService

  private dmRelaysCache = new Map<string, string[]>()

  private constructor() {}

  static getInstance(): DmRelayService {
    if (!DmRelayService.instance) {
      DmRelayService.instance = new DmRelayService()
    }
    return DmRelayService.instance
  }

  getDefaultDmRelays(): string[] {
    return [...DEFAULT_DM_RELAYS]
  }

  async getDmRelays(pubkey: string): Promise<string[]> {
    const cached = this.dmRelaysCache.get(pubkey)
    if (cached) return cached

    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    const events = await client.fetchEvents(relays, {
      kinds: [ExtendedKind.DM_RELAYS],
      authors: [pubkey],
      limit: 1
    })

    if (events.length === 0) {
      return this.getDefaultDmRelays()
    }

    const dmRelays = this.extractRelaysFromEvent(events[0])
    if (dmRelays.length > 0) {
      this.dmRelaysCache.set(pubkey, dmRelays)
    }
    return dmRelays.length > 0 ? dmRelays : this.getDefaultDmRelays()
  }

  async hasDmRelays(pubkey: string): Promise<boolean> {
    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    const events = await client.fetchEvents(relays, {
      kinds: [ExtendedKind.DM_RELAYS],
      authors: [pubkey],
      limit: 1
    })
    return events.length > 0
  }

  async publishDmRelays(signer: ISigner, relayUrls: string[]): Promise<Event> {
    const normalizedUrls = relayUrls
      .map((url) => normalizeUrl(url))
      .filter((url) => url !== '')

    const tags = normalizedUrls.map((url) => ['relay', url])

    const draftEvent = {
      kind: ExtendedKind.DM_RELAYS,
      content: '',
      created_at: dayjs().unix(),
      tags
    }

    const event = await signer.signEvent(draftEvent)
    const publishRelays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    await client.publishEvent(publishRelays, event)

    const pubkey = await signer.getPublicKey()
    this.dmRelaysCache.set(pubkey, normalizedUrls)

    return event
  }

  async checkDmSupport(pubkey: string): Promise<{ hasDmRelays: boolean; hasEncryptionKey: boolean }> {
    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    const events = await client.fetchEvents(relays, [
      {
        kinds: [ExtendedKind.DM_RELAYS],
        authors: [pubkey],
        limit: 1
      },
      {
        kinds: [ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT],
        authors: [pubkey],
        limit: 1
      }
    ])

    const hasDmRelays = events.some((e) => e.kind === ExtendedKind.DM_RELAYS)
    const hasEncryptionKey = events.some((e) => e.kind === ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT)

    return { hasDmRelays, hasEncryptionKey }
  }

  async getRecipientEncryptionPubkey(pubkey: string): Promise<string | null> {
    const announcement = await encryptionKeyService.queryEncryptionKeyAnnouncement(pubkey)
    if (!announcement) return null
    return encryptionKeyService.getEncryptionPubkeyFromEvent(announcement)
  }

  private extractRelaysFromEvent(event: Event): string[] {
    return event.tags
      .filter((tag) => tag[0] === 'relay' && tag[1])
      .map((tag) => normalizeUrl(tag[1]))
      .filter((url) => url !== '')
  }

  clearCache(pubkey?: string) {
    if (pubkey) {
      this.dmRelaysCache.delete(pubkey)
    } else {
      this.dmRelaysCache.clear()
    }
  }
}

const instance = DmRelayService.getInstance()
export default instance
