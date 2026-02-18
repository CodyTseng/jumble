import dayjs from 'dayjs'
import { Event, generateSecretKey, kinds, UnsignedEvent } from 'nostr-tools'
import * as nip44 from 'nostr-tools/nip44'

import { finalizeEvent, getEventHash } from 'nostr-tools/pure'

export type TRumor = UnsignedEvent & {
  id: string
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

  createGiftWrappedMessage(
    content: string,
    accountPubkey: string,
    encryptionPrivkey: Uint8Array,
    recipientPubkey: string,
    recipientEncryptionPubkey: string
  ): { giftWrap: Event; seal: Event; rumor: TRumor } {
    const rumorTemplate: UnsignedEvent = {
      created_at: dayjs().unix(),
      kind: kinds.PrivateDirectMessage,
      tags: [['p', recipientPubkey]],
      content,
      pubkey: accountPubkey
    }
    const rumor: TRumor = {
      ...rumorTemplate,
      id: getEventHash(rumorTemplate)
    }

    const seal = this.createSeal(rumor, encryptionPrivkey, recipientEncryptionPubkey)

    // Gift wrap encrypted to encryption pubkey, with both p-tags for discoverability
    const giftWrap = this.createGiftWrap(seal, recipientEncryptionPubkey, [
      ['p', recipientEncryptionPubkey],
      ['p', recipientPubkey]
    ])

    return { giftWrap, seal, rumor }
  }

  createGiftWrapForSelf(
    rumor: TRumor,
    encryptionPrivkey: Uint8Array,
    senderEncryptionPubkey: string,
    senderMainPubkey: string
  ): Event {
    const seal = this.createSeal(rumor, encryptionPrivkey, senderEncryptionPubkey)
    return this.createGiftWrap(seal, senderEncryptionPubkey, [
      ['p', senderEncryptionPubkey],
      ['p', senderMainPubkey]
    ])
  }

  private createSeal(
    rumor: TRumor,
    encryptionPrivkey: Uint8Array,
    recipientEncryptionPubkey: string
  ): Event {
    const conversationKey = nip44.v2.utils.getConversationKey(
      encryptionPrivkey,
      recipientEncryptionPubkey
    )
    const encrypted = nip44.v2.encrypt(JSON.stringify(rumor), conversationKey)

    return finalizeEvent(
      {
        kind: 13,
        content: encrypted,
        created_at: randomTimeUpTo2DaysInThePast(),
        tags: []
      },
      encryptionPrivkey
    ) as unknown as Event
  }

  /**
   * Custom gift wrap creation that supports multiple p-tags.
   * nostr-tools' createWrap only supports a single p-tag (the encryption recipient),
   * but NIP-4e requires an additional p-tag with the recipient's main pubkey
   * so that apps subscribing with #p=main_pubkey can discover the message.
   */
  private createGiftWrap(seal: Event, encryptionRecipientPubkey: string, tags: string[][]): Event {
    const randomKey = generateSecretKey()
    const conversationKey = nip44.v2.utils.getConversationKey(randomKey, encryptionRecipientPubkey)
    const content = nip44.v2.encrypt(JSON.stringify(seal), conversationKey)

    return finalizeEvent(
      {
        kind: 1059,
        content,
        created_at: randomTimeUpTo2DaysInThePast(),
        tags
      },
      randomKey
    ) as unknown as Event
  }

  unwrapGiftWrap(giftWrap: Event, recipientPrivkey: Uint8Array): TUnwrappedMessage | null {
    try {
      // Manually unwrap to log intermediate layers
      const giftWrapConvKey = nip44.v2.utils.getConversationKey(recipientPrivkey, giftWrap.pubkey)
      const sealJson = nip44.v2.decrypt(giftWrap.content, giftWrapConvKey)
      const seal: Event = JSON.parse(sealJson)

      const sealConvKey = nip44.v2.utils.getConversationKey(recipientPrivkey, seal.pubkey)
      const rumorJson = nip44.v2.decrypt(seal.content, sealConvKey)
      const rumor = JSON.parse(rumorJson)

      const recipientPubkey = this.getRecipientPubkeyFromGiftWrap(giftWrap)
      if (!recipientPubkey) {
        throw new Error('Recipient pubkey not found in gift wrap tags')
      }

      return {
        rumor,
        senderPubkey: rumor.pubkey,
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

/** NIP-59: created_at should be tweaked to thwart time-analysis deanonymization */
function randomTimeUpTo2DaysInThePast(): number {
  return Math.round(Date.now() / 1000 - Math.random() * 172800)
}

const instance = Nip17GiftWrapService.getInstance()
export default instance
