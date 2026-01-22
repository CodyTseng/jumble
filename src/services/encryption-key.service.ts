import { DEFAULT_DM_RELAYS, ExtendedKind } from '@/constants'
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
    if (!privkeyHex) return null

    const privkey = hexToBytes(privkeyHex)
    const pubkey = getPublicKey(privkey)
    return { privkey, pubkey }
  }

  generateEncryptionKey(accountPubkey: string): TEncryptionKeypair {
    const privkey = generateSecretKey()
    const pubkey = getPublicKey(privkey)
    storage.setEncryptionKeyPrivkey(accountPubkey, bytesToHex(privkey))
    return { privkey, pubkey }
  }

  getClientKeypair(accountPubkey: string): TEncryptionKeypair {
    let privkeyHex = storage.getClientKeyPrivkey(accountPubkey)
    if (!privkeyHex) {
      const privkey = generateSecretKey()
      privkeyHex = bytesToHex(privkey)
      storage.setClientKeyPrivkey(accountPubkey, privkeyHex)
    }
    const privkey = hexToBytes(privkeyHex)
    const pubkey = getPublicKey(privkey)
    return { privkey, pubkey }
  }

  async queryEncryptionKeyAnnouncement(pubkey: string): Promise<Event | null> {
    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    const events = await client.fetchEvents(relays, {
      kinds: [ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT],
      authors: [pubkey],
      limit: 1
    })
    return events[0] ?? null
  }

  async publishEncryptionKeyAnnouncement(
    signer: ISigner,
    accountPubkey: string
  ): Promise<Event | null> {
    const keypair = this.getEncryptionKeypair(accountPubkey)
    if (!keypair) return null

    const draftEvent = {
      kind: ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT,
      content: '',
      created_at: dayjs().unix(),
      tags: [['n', keypair.pubkey]]
    }

    const event = await signer.signEvent(draftEvent)
    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    await client.publishEvent(relays, event)
    return event
  }

  async publishClientKeyAnnouncement(
    signer: ISigner,
    accountPubkey: string,
    clientName: string = 'Jumble'
  ): Promise<Event | null> {
    const clientKeypair = this.getClientKeypair(accountPubkey)

    const draftEvent = {
      kind: ExtendedKind.CLIENT_KEY_ANNOUNCEMENT,
      content: '',
      created_at: dayjs().unix(),
      tags: [
        ['client', clientName],
        ['P', clientKeypair.pubkey]
      ]
    }

    const event = await signer.signEvent(draftEvent)
    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    await client.publishEvent(relays, event)
    return event
  }

  async exportKeyForTransfer(
    signer: ISigner,
    accountPubkey: string,
    recipientClientPubkey: string
  ): Promise<Event | null> {
    const encryptionKeypair = this.getEncryptionKeypair(accountPubkey)
    if (!encryptionKeypair || !signer.nip44Encrypt) return null

    // Get sender's client keypair for encryption
    const senderClientKeypair = this.getClientKeypair(accountPubkey)

    const encryptionPrivkeyHex = bytesToHex(encryptionKeypair.privkey)
    // Encrypt using sender's client privkey to recipient's client pubkey
    const encrypted = await signer.nip44Encrypt(
      senderClientKeypair.privkey,
      recipientClientPubkey,
      encryptionPrivkeyHex
    )

    const draftEvent = {
      kind: ExtendedKind.KEY_TRANSFER,
      content: encrypted,
      created_at: dayjs().unix(),
      tags: [
        ['P', senderClientKeypair.pubkey],  // Sender's client pubkey
        ['p', recipientClientPubkey]         // Recipient's client pubkey
      ]
    }

    const event = await signer.signEvent(draftEvent)
    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    await client.publishEvent(relays, event)
    return event
  }

  async importKeyFromTransfer(
    signer: ISigner,
    accountPubkey: string,
    transferEvent: Event
  ): Promise<boolean> {
    const clientKeypair = this.getClientKeypair(accountPubkey)
    if (!signer.nip44Decrypt) return false

    // Get sender's client pubkey from the P tag
    const senderClientPubkey = transferEvent.tags.find(tagNameEquals('P'))?.[1]
    if (!senderClientPubkey) return false

    try {
      const decrypted = await signer.nip44Decrypt(
        clientKeypair.privkey,
        senderClientPubkey,
        transferEvent.content
      )

      if (!/^[0-9a-fA-F]{64}$/.test(decrypted)) {
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
    const pTag = event.tags.find(tagNameEquals('P'))
    return pTag?.[1] ?? null
  }

  async subscribeToKeyTransfer(
    signer: ISigner,
    accountPubkey: string,
    onTransfer: (success: boolean) => void
  ): Promise<() => void> {
    const clientKeypair = this.getClientKeypair(accountPubkey)
    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)

    const sub = client.subscribe(
      relays,
      {
        kinds: [ExtendedKind.KEY_TRANSFER],
        '#p': [clientKeypair.pubkey],
        limit: 1
      },
      {
        onevent: async (event) => {
          const success = await this.importKeyFromTransfer(signer, accountPubkey, event)
          onTransfer(success)
          if (success) {
            sub.close()
          }
        }
      }
    )

    return () => sub.close()
  }

  async checkOtherDeviceClientKeys(accountPubkey: string): Promise<Event[]> {
    const relays = [...DEFAULT_DM_RELAYS, ...getDefaultRelayUrls()].slice(0, 6)
    const events = await client.fetchEvents(relays, {
      kinds: [ExtendedKind.CLIENT_KEY_ANNOUNCEMENT],
      authors: [accountPubkey]
    })
    return events
  }

  encryptWithNip44(privkey: Uint8Array, pubkey: string, plainText: string): string {
    const conversationKey = nip44.v2.utils.getConversationKey(privkey, pubkey)
    return nip44.v2.encrypt(plainText, conversationKey)
  }

  decryptWithNip44(privkey: Uint8Array, pubkey: string, cipherText: string): string {
    const conversationKey = nip44.v2.utils.getConversationKey(privkey, pubkey)
    return nip44.v2.decrypt(cipherText, conversationKey)
  }
}

const instance = EncryptionKeyService.getInstance()
export default instance
