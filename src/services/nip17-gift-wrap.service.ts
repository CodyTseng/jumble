import { DM_TIME_RANDOMIZATION_SECONDS, ExtendedKind } from '@/constants'
import dayjs from 'dayjs'
import { Event, finalizeEvent, generateSecretKey } from 'nostr-tools'
import * as nip44 from 'nostr-tools/nip44'

export type TRumor = {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
}

export type TUnwrappedMessage = {
  rumor: TRumor
  senderPubkey: string
  recipientPubkey: string
  giftWrapId: string
  giftWrapCreatedAt: number
}

class Nip17GiftWrapService {
  static instance: Nip17GiftWrapService

  private constructor() {}

  static getInstance(): Nip17GiftWrapService {
    if (!Nip17GiftWrapService.instance) {
      Nip17GiftWrapService.instance = new Nip17GiftWrapService()
    }
    return Nip17GiftWrapService.instance
  }

  createRumor(
    content: string,
    recipientPubkey: string,
    senderPubkey: string,
    kind: number = ExtendedKind.RUMOR_CHAT
  ): TRumor {
    const rumor: TRumor = {
      id: '',
      pubkey: senderPubkey,
      created_at: dayjs().unix(),
      kind,
      tags: [['p', recipientPubkey]],
      content
    }

    const rumorWithId = this.calculateRumorId(rumor)
    return rumorWithId
  }

  private calculateRumorId(rumor: TRumor): TRumor {
    const serialized = JSON.stringify([
      0,
      rumor.pubkey,
      rumor.created_at,
      rumor.kind,
      rumor.tags,
      rumor.content
    ])
    const encoder = new TextEncoder()
    const data = encoder.encode(serialized)

    return crypto.subtle.digest('SHA-256', data).then((hashBuffer) => {
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      return { ...rumor, id: hashHex }
    }) as unknown as TRumor
  }

  async createRumorWithId(
    content: string,
    recipientPubkey: string,
    senderPubkey: string,
    kind: number = ExtendedKind.RUMOR_CHAT
  ): Promise<TRumor> {
    const rumor: TRumor = {
      id: '',
      pubkey: senderPubkey,
      created_at: dayjs().unix(),
      kind,
      tags: [['p', recipientPubkey]],
      content
    }

    const serialized = JSON.stringify([
      0,
      rumor.pubkey,
      rumor.created_at,
      rumor.kind,
      rumor.tags,
      rumor.content
    ])
    const encoder = new TextEncoder()
    const data = encoder.encode(serialized)

    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    return { ...rumor, id: hashHex }
  }

  private getRandomTimeOffset(): number {
    return Math.floor(Math.random() * DM_TIME_RANDOMIZATION_SECONDS)
  }

  createSeal(rumor: TRumor, senderPrivkey: Uint8Array, recipientPubkey: string): Event {
    const rumorJson = JSON.stringify(rumor)
    const conversationKey = nip44.v2.utils.getConversationKey(senderPrivkey, recipientPubkey)
    const encryptedRumor = nip44.v2.encrypt(rumorJson, conversationKey)

    const randomOffset = this.getRandomTimeOffset()
    const sealDraft = {
      kind: ExtendedKind.SEAL,
      content: encryptedRumor,
      created_at: dayjs().unix() - randomOffset,
      tags: []
    }

    return finalizeEvent(sealDraft, senderPrivkey)
  }

  createGiftWrap(seal: Event, recipientPubkey: string): Event {
    const ephemeralPrivkey = generateSecretKey()

    const sealJson = JSON.stringify(seal)
    const conversationKey = nip44.v2.utils.getConversationKey(ephemeralPrivkey, recipientPubkey)
    const encryptedSeal = nip44.v2.encrypt(sealJson, conversationKey)

    const randomOffset = this.getRandomTimeOffset()
    const giftWrapDraft = {
      kind: ExtendedKind.GIFT_WRAP,
      content: encryptedSeal,
      created_at: dayjs().unix() - randomOffset,
      tags: [['p', recipientPubkey]]
    }

    return finalizeEvent(giftWrapDraft, ephemeralPrivkey)
  }

  async createGiftWrappedMessage(
    content: string,
    senderPrivkey: Uint8Array,
    senderPubkey: string,
    recipientPubkey: string,
    recipientEncryptionPubkey: string
  ): Promise<{ giftWrap: Event; rumor: TRumor }> {
    const rumor = await this.createRumorWithId(content, recipientPubkey, senderPubkey)
    const seal = this.createSeal(rumor, senderPrivkey, recipientEncryptionPubkey)
    const giftWrap = this.createGiftWrap(seal, recipientEncryptionPubkey)

    return { giftWrap, rumor }
  }

  async createGiftWrapForSelf(
    rumor: TRumor,
    senderPrivkey: Uint8Array,
    senderEncryptionPubkey: string
  ): Promise<Event> {
    const seal = this.createSeal(rumor, senderPrivkey, senderEncryptionPubkey)
    return this.createGiftWrap(seal, senderEncryptionPubkey)
  }

  unwrapGiftWrap(giftWrap: Event, recipientPrivkey: Uint8Array): TUnwrappedMessage | null {
    try {
      const giftWrapPubkey = giftWrap.pubkey
      const conversationKey = nip44.v2.utils.getConversationKey(
        recipientPrivkey,
        giftWrapPubkey
      )
      const decryptedSealJson = nip44.v2.decrypt(giftWrap.content, conversationKey)
      const seal: Event = JSON.parse(decryptedSealJson)

      if (seal.kind !== ExtendedKind.SEAL) {
        return null
      }

      const sealConversationKey = nip44.v2.utils.getConversationKey(
        recipientPrivkey,
        seal.pubkey
      )
      const decryptedRumorJson = nip44.v2.decrypt(seal.content, sealConversationKey)
      const rumor: TRumor = JSON.parse(decryptedRumorJson)

      const recipientTag = giftWrap.tags.find((t) => t[0] === 'p')
      const recipientPubkey = recipientTag?.[1] ?? ''

      return {
        rumor,
        senderPubkey: rumor.pubkey,  // Use rumor.pubkey (identity key), not seal.pubkey (encryption key)
        recipientPubkey,
        giftWrapId: giftWrap.id,
        giftWrapCreatedAt: giftWrap.created_at
      }
    } catch (error) {
      console.error('Failed to unwrap gift wrap:', error)
      return null
    }
  }

  getRecipientPubkeyFromGiftWrap(giftWrap: Event): string | null {
    const pTag = giftWrap.tags.find((t) => t[0] === 'p')
    return pTag?.[1] ?? null
  }
}

const instance = Nip17GiftWrapService.getInstance()
export default instance
