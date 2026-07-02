import { ENCRYPTION_KEY_RETENTION_MS, ExtendedKind, MAX_RETIRED_ENCRYPTION_KEYS } from '@/constants'
import { getConversationKey } from '@/lib/crypto'
import { getDefaultRelayUrls } from '@/lib/relay'
import { tagNameEquals } from '@/lib/tag'
import { ISigner, TEncryptionKeypair } from '@/types'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import dayjs from 'dayjs'
import { Event, generateSecretKey, getPublicKey } from 'nostr-tools'
import * as nip44 from 'nostr-tools/nip44'
import client from './client.service'
import storage from './local-storage.service'

class EncryptionKeyService {
  static instance: EncryptionKeyService

  private constructor() {}

  static getInstance(): EncryptionKeyService {
    if (!EncryptionKeyService.instance) {
      EncryptionKeyService.instance = new EncryptionKeyService()
    }
    return EncryptionKeyService.instance
  }

  hasEncryptionKey(accountPubkey: string): boolean {
    return !!storage.getEncryptionKeyPrivkey(accountPubkey)
  }

  getEncryptionKeypair(accountPubkey: string): TEncryptionKeypair | null {
    const privkeyHex = storage.getEncryptionKeyPrivkey(accountPubkey)
    return privkeyHex ? this.hexToKeypair(privkeyHex) : null
  }

  private hexToKeypair(privkeyHex: string): TEncryptionKeypair {
    const privkey = hexToBytes(privkeyHex)
    return { privkey, pubkey: getPublicKey(privkey) }
  }

  /**
   * Retires the current encryption key instead of dropping it outright: the old
   * private key is moved into a kept-around list (bounded by age and count) so
   * messages still encrypted to it — by contacts who haven't learned the new key
   * yet — can keep being decrypted during the grace period. Then it clears the
   * current key so a fresh one can take its place.
   */
  removeEncryptionKey(accountPubkey: string): void {
    const privkeyHex = storage.getEncryptionKeyPrivkey(accountPubkey)
    if (privkeyHex) {
      storage.addRetiredEncryptionKeyPrivkey(accountPubkey, privkeyHex, dayjs().valueOf())
    }
    storage.removeEncryptionKeyPrivkey(accountPubkey)
    this.pruneRetiredKeys(accountPubkey)
  }

  /**
   * Returns the still-valid retired encryption keypairs, pruning (in place) any
   * that have exceeded the retention age or the count cap. Used as decryption
   * fallbacks when the current key fails to unwrap a gift wrap.
   */
  getValidRetiredKeypairs(accountPubkey: string): TEncryptionKeypair[] {
    return this.pruneRetiredKeys(accountPubkey).map((k) => this.hexToKeypair(k.privkey))
  }

  // Storage keeps retired keys newest-first (see addRetiredEncryptionKeyPrivkey),
  // so dropping expired entries and capping the count needs no re-sort. Only
  // persists when something was actually pruned.
  private pruneRetiredKeys(accountPubkey: string): { privkey: string; retiredAt: number }[] {
    const now = dayjs().valueOf()
    const stored = storage.getRetiredEncryptionKeyPrivkeys(accountPubkey)
    const kept = stored
      .filter((k) => now - k.retiredAt < ENCRYPTION_KEY_RETENTION_MS)
      .slice(0, MAX_RETIRED_ENCRYPTION_KEYS)
    if (kept.length !== stored.length) {
      storage.setRetiredEncryptionKeyPrivkeys(accountPubkey, kept)
    }
    return kept
  }

  generateEncryptionKey(accountPubkey: string): TEncryptionKeypair {
    const privkey = generateSecretKey()
    const pubkey = getPublicKey(privkey)
    storage.setEncryptionKeyPrivkey(accountPubkey, bytesToHex(privkey))
    return { privkey, pubkey }
  }

  generateClientKeypair(): TEncryptionKeypair {
    const privkey = generateSecretKey()
    return { privkey, pubkey: getPublicKey(privkey) }
  }

  async queryEncryptionKeyAnnouncement(pubkey: string): Promise<Event | null> {
    const { relays } = await this.getRelays(pubkey)
    const [networkEvents, cached] = await Promise.all([
      client.fetchEvents(relays, {
        kinds: [ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT],
        authors: [pubkey],
        limit: 1
      }),
      // The local cache reflects what THIS device last published or knew. Right
      // after a local key reset the freshly published announcement lives here even
      // before it propagates to the queried relays, so we merge it in and keep the
      // newest. This stops a lagging network read from making this device look
      // out-of-date against its own new key (which would wrongly disable answering
      // sync requests), while a genuinely newer announcement from another device
      // still wins by created_at.
      client.fetchEncryptionKeyAnnouncementEvent(pubkey, false).catch(() => null)
    ])
    const candidates = [networkEvents[0], cached].filter(Boolean) as Event[]
    if (candidates.length === 0) return null
    return candidates.reduce((newest, e) => (e.created_at > newest.created_at ? e : newest))
  }

  async publishEncryptionKeyAnnouncement(
    signer: ISigner,
    accountPubkey: string
  ): Promise<Event | null> {
    const { dmRelays, relays } = await this.getRelays(accountPubkey)
    if (dmRelays.length === 0) {
      throw new Error('You should set up at least one DM relay before announcing encryption key')
    }

    const keypair = this.getEncryptionKeypair(accountPubkey)
    if (!keypair) return null

    const draftEvent = {
      kind: ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT,
      content: '',
      created_at: dayjs().unix(),
      tags: [['n', keypair.pubkey]]
    }

    const event = await signer.signEvent(draftEvent)
    await client.publishEvent(relays, event)
    await client.updateEncryptionKeyAnnouncementCache(event)
    return event
  }

  async publishClientKeyAnnouncement(
    signer: ISigner,
    accountPubkey: string,
    clientKeypair: TEncryptionKeypair
  ): Promise<Event | null> {
    const { relays } = await this.getRelays(accountPubkey)

    // Intentionally no 'client' tag here: it would leak the OS/browser of the
    // requesting device. The verification code (see getVerificationCode) is
    // used instead to let the user confirm the request.
    const draftEvent = {
      kind: ExtendedKind.CLIENT_KEY_ANNOUNCEMENT,
      content: '',
      created_at: dayjs().unix(),
      tags: [
        ['pubkey', clientKeypair.pubkey], // coop uses 'pubkey' tag
        ['P', clientKeypair.pubkey] // NIP defines 'P' tag
      ]
    }

    const event = await signer.signEvent(draftEvent)
    storage.addProcessedSyncRequestId(event.id)
    await client.publishEvent(relays, event)
    return event
  }

  async exportKeyForTransfer(
    signer: ISigner,
    accountPubkey: string,
    recipientClientPubkey: string
  ): Promise<Event | null> {
    const { relays } = await this.getRelays(accountPubkey)
    const encryptionKeypair = this.getEncryptionKeypair(accountPubkey)
    if (!encryptionKeypair) return null

    const senderClientKeypair = this.generateClientKeypair()

    const encryptionPrivkeyHex = bytesToHex(encryptionKeypair.privkey)
    // Encrypt using sender's client privkey to recipient's client pubkey
    const encrypted = this.encryptWithNip44(
      senderClientKeypair.privkey,
      recipientClientPubkey,
      encryptionPrivkeyHex
    )

    const draftEvent = {
      kind: ExtendedKind.KEY_TRANSFER,
      content: encrypted,
      created_at: dayjs().unix(),
      tags: [
        ['P', senderClientKeypair.pubkey], // Sender's client pubkey
        ['p', recipientClientPubkey] // Recipient's client pubkey
      ]
    }

    const event = await signer.signEvent(draftEvent)
    await client.publishEvent(relays, event)
    return event
  }

  async importKeyFromTransfer(
    accountPubkey: string,
    transferEvent: Event,
    clientKeypair: TEncryptionKeypair,
    expectedPubkey?: string
  ): Promise<boolean> {
    // Get sender's client pubkey from the P tag
    const senderClientPubkey = transferEvent.tags.find(tagNameEquals('P'))?.[1]
    if (!senderClientPubkey) return false

    try {
      const decrypted = this.decryptWithNip44(
        clientKeypair.privkey,
        senderClientPubkey,
        transferEvent.content
      )

      if (!/^[0-9a-fA-F]{64}$/.test(decrypted)) {
        return false
      }

      // Defense in depth: only accept a transferred key whose pubkey matches the
      // account's currently announced encryption pubkey. This rejects stale keys
      // as well as garbage a third party may have planted at our client pubkey.
      if (expectedPubkey && getPublicKey(hexToBytes(decrypted)) !== expectedPubkey) {
        return false
      }

      storage.setEncryptionKeyPrivkey(accountPubkey, decrypted)
      return true
    } catch {
      return false
    }
  }

  async initializeEncryption(signer: ISigner, accountPubkey: string): Promise<TEncryptionKeypair> {
    let keypair = this.getEncryptionKeypair(accountPubkey)
    if (keypair) return keypair

    const existingAnnouncement = await this.queryEncryptionKeyAnnouncement(accountPubkey)
    if (existingAnnouncement) {
      throw new Error('EXISTING_KEY_ANNOUNCEMENT')
    }

    keypair = this.generateEncryptionKey(accountPubkey)
    await this.publishEncryptionKeyAnnouncement(signer, accountPubkey)
    return keypair
  }

  getEncryptionPubkeyFromEvent(event: Event): string | null {
    const nTag = event.tags.find(tagNameEquals('n'))
    return nTag?.[1] ?? null
  }

  getClientPubkeyFromEvent(event: Event): string | null {
    // NIP defines 'P' tag, coop uses 'pubkey' tag
    const tag = event.tags.find(tagNameEquals('P')) ?? event.tags.find(tagNameEquals('pubkey'))
    return tag?.[1] ?? null
  }

  /**
   * Derive a human-comparable verification code from a client pubkey.
   * The client pubkey is uniformly random, so its leading hex digits are
   * already uniformly random and no hashing is needed. Both devices derive
   * the same code from the same client pubkey; the user compares them to
   * confirm the sync request belongs to the device they are holding.
   */
  getVerificationCode(clientPubkey: string): string {
    const code = clientPubkey.slice(0, 8).toUpperCase()
    return `${code.slice(0, 4)} ${code.slice(4)}`
  }

  async subscribeToKeyTransfer(
    accountPubkey: string,
    clientKeypair: TEncryptionKeypair,
    onTransfer: () => void
  ): Promise<() => void> {
    const { relays } = await this.getRelays(accountPubkey)

    // The currently announced encryption pubkey, used to reject stale or planted
    // transfers (see importKeyFromTransfer). May be null if the announcement can't
    // be fetched, in which case we fall back to accepting any well-formed key.
    const announcement = await this.queryEncryptionKeyAnnouncement(accountPubkey)
    const expectedPubkey = announcement
      ? (this.getEncryptionPubkeyFromEvent(announcement) ?? undefined)
      : undefined

    // No `limit: 0` here: also pull already-stored transfers so a key that arrived
    // while this device was offline or briefly disconnected can still be recovered,
    // not just ones that stream in live after subscribing.
    const sub = client.subscribe(
      relays,
      {
        kinds: [ExtendedKind.KEY_TRANSFER],
        '#p': [clientKeypair.pubkey]
      },
      {
        onevent: async (event) => {
          const success = await this.importKeyFromTransfer(
            accountPubkey,
            event,
            clientKeypair,
            expectedPubkey
          )
          // Silently skip failures: a third party can plant garbage transfers at
          // our public client pubkey, and stored old-round transfers won't match
          // the expected key. Keep waiting for a valid one instead of erroring out.
          if (success) {
            onTransfer()
            sub.close()
          }
        }
      }
    )

    return () => sub.close()
  }

  async checkOtherDeviceClientKeys(accountPubkey: string): Promise<Event[]> {
    const { relays } = await this.getRelays(accountPubkey)
    const events = await client.fetchEvents(relays, {
      kinds: [ExtendedKind.CLIENT_KEY_ANNOUNCEMENT],
      authors: [accountPubkey]
    })
    return events
  }

  encryptWithNip44(privkey: Uint8Array, pubkey: string, plainText: string): string {
    const conversationKey = getConversationKey(privkey, pubkey)
    return nip44.v2.encrypt(plainText, conversationKey)
  }

  decryptWithNip44(privkey: Uint8Array, pubkey: string, cipherText: string): string {
    const conversationKey = getConversationKey(privkey, pubkey)
    return nip44.v2.decrypt(cipherText, conversationKey)
  }

  private async getRelays(accountPubkey: string) {
    const [dmRelays, relayList] = await Promise.all([
      client.fetchDmRelays(accountPubkey),
      client.fetchRelayList(accountPubkey)
    ])
    const writeRelays = relayList.write.slice(0, 5)
    // These are non-private setup events (key announcements, sync requests, key
    // transfers). Always include the big default relays so a flaky or
    // misconfigured DM/write relay set can't strand the sync handshake.
    const relays = Array.from(new Set([...dmRelays, ...writeRelays, ...getDefaultRelayUrls()]))

    return {
      dmRelays,
      writeRelays,
      relays
    }
  }
}

const instance = EncryptionKeyService.getInstance()
export default instance
