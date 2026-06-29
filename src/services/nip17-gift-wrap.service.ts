import { getConversationKey } from '@/lib/crypto'
import { ISigner } from '@/types'
import { Event, generateSecretKey, kinds, UnsignedEvent } from 'nostr-tools'
import * as nip44 from 'nostr-tools/nip44'

import { finalizeEvent, getEventHash, getPublicKey, verifyEvent } from 'nostr-tools/pure'

export type TRumor = UnsignedEvent & {
  id: string
}

export type TUnwrappedMessage = {
  rumor: TRumor
  senderPubkey: string
  senderEncryptionPubkey: string
  recipientPubkey: string
  giftWrapId: string
  giftWrapCreatedAt: number
  // true: NIP-59 seal signed by the sender's identity key (current format, carries
  // the encryption pubkey in an `n` tag). false: legacy seal signed by the
  // encryption key (seal.pubkey IS the encryption pubkey).
  sealSignedByIdentity: boolean
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

  /**
   * Builds one rumor and wraps it in BOTH the current (identity-signed, `n`-tagged)
   * and legacy (encryption-key-signed) formats, for the recipient and for the
   * sender's own devices. This is the migration-period dual-send: new clients read
   * the identity-signed wrap, clients still on the old code read the legacy wrap.
   *
   * Both formats wrap the **same** rumor, so they share the same `rumor.id` — the
   * receiver dedupes by id and only ever stores/shows one message. Each format's
   * `index 0` is the current format.
   */
  /**
   * Builds the unsigned rumor (kind 14/15/7) and computes its id. Pure and
   * synchronous — needs no signer, encryption key or any network lookup — so the
   * caller can persist and display the message before the (failure-prone) signing
   * and publishing steps. `wrapRumor` later turns this same rumor into gift wraps;
   * both share the rumor id, which is the message's stable identity.
   */
  buildRumor(
    content: string,
    accountPubkey: string,
    recipientPubkey: string,
    createdAt: number,
    extraTags?: string[][],
    kind?: number
  ): TRumor {
    const rumorTemplate: UnsignedEvent = {
      created_at: createdAt,
      kind: kind ?? kinds.PrivateDirectMessage,
      tags: [['p', recipientPubkey], ...(extraTags ?? [])],
      content,
      pubkey: accountPubkey
    }
    return {
      ...rumorTemplate,
      id: getEventHash(rumorTemplate)
    }
  }

  /**
   * Wraps an already-built rumor in BOTH the current (identity-signed, `n`-tagged)
   * and legacy (encryption-key-signed) formats, for the recipient and for the
   * sender's own devices. This is the migration-period dual-send: new clients read
   * the identity-signed wrap, clients still on the old code read the legacy wrap.
   *
   * Both formats wrap the **same** rumor, so they share the same `rumor.id` — the
   * receiver dedupes by id and only ever stores/shows one message. Each format's
   * `index 0` is the current format.
   */
  async wrapRumor(
    rumor: TRumor,
    signer: ISigner,
    encryptionPrivkey: Uint8Array,
    recipientPubkey: string,
    recipientEncryptionPubkey: string
  ): Promise<{ recipientGiftWraps: Event[]; selfGiftWraps: Event[] }> {
    const senderEncryptionPubkey = getPublicKey(encryptionPrivkey)

    // Recipient copies: encrypted to the recipient's encryption pubkey, with both
    // p-tags (encryption + main) for discoverability.
    const recipientTags = [
      ['p', recipientEncryptionPubkey],
      ['p', recipientPubkey]
    ]
    const recipientSeal = await this.createSeal(
      rumor,
      signer,
      encryptionPrivkey,
      recipientEncryptionPubkey
    )
    const recipientLegacySeal = this.createLegacySeal(
      rumor,
      encryptionPrivkey,
      recipientEncryptionPubkey
    )

    // Self copies: encrypted to the sender's own encryption pubkey so other devices
    // can sync outgoing messages.
    const selfTags = [
      ['p', senderEncryptionPubkey],
      ['p', rumor.pubkey]
    ]
    const selfSeal = await this.createSeal(rumor, signer, encryptionPrivkey, senderEncryptionPubkey)
    const selfLegacySeal = this.createLegacySeal(rumor, encryptionPrivkey, senderEncryptionPubkey)

    return {
      recipientGiftWraps: [
        this.createGiftWrap(recipientSeal, recipientEncryptionPubkey, recipientTags),
        this.createGiftWrap(recipientLegacySeal, recipientEncryptionPubkey, recipientTags)
      ],
      selfGiftWraps: [
        this.createGiftWrap(selfSeal, senderEncryptionPubkey, selfTags),
        this.createGiftWrap(selfLegacySeal, senderEncryptionPubkey, selfTags)
      ]
    }
  }

  /** Builds a rumor and wraps it in one step. Used where the rumor doesn't need
   * to be persisted ahead of signing (e.g. reactions). */
  async createDualGiftWraps(
    content: string,
    accountPubkey: string,
    signer: ISigner,
    encryptionPrivkey: Uint8Array,
    recipientPubkey: string,
    recipientEncryptionPubkey: string,
    createdAt: number,
    extraTags?: string[][],
    kind?: number
  ): Promise<{ rumor: TRumor; recipientGiftWraps: Event[]; selfGiftWraps: Event[] }> {
    const rumor = this.buildRumor(content, accountPubkey, recipientPubkey, createdAt, extraTags, kind)
    const wraps = await this.wrapRumor(
      rumor,
      signer,
      encryptionPrivkey,
      recipientPubkey,
      recipientEncryptionPubkey
    )
    return { rumor, ...wraps }
  }

  /**
   * NIP-59 seal (kind 13). Signed by the sender's **identity** key (via the signer)
   * so seal.pubkey === rumor.pubkey, which lets the recipient authenticate the
   * sender from the seal alone. The NIP-44 payload still uses the dedicated
   * encryption keypair (encryptionPrivkey ↔ recipientEncryptionPubkey), and the
   * sender's encryption pubkey is carried in an `n` tag so the recipient can derive
   * the conversation key without an extra Kind 10044 lookup.
   */
  private async createSeal(
    rumor: TRumor,
    signer: ISigner,
    encryptionPrivkey: Uint8Array,
    recipientEncryptionPubkey: string
  ): Promise<Event> {
    const conversationKey = getConversationKey(encryptionPrivkey, recipientEncryptionPubkey)
    const encrypted = nip44.v2.encrypt(JSON.stringify(rumor), conversationKey)

    return (await signer.signEvent({
      kind: kinds.Seal,
      content: encrypted,
      created_at: rumor.created_at,
      tags: [['n', getPublicKey(encryptionPrivkey)]]
    })) as Event
  }

  /**
   * Legacy NIP-59 seal: signed by the sender's **encryption** key (so seal.pubkey IS
   * the encryption pubkey, no `n` tag). Kept only for the dual-send migration window
   * so clients still on the old code can decrypt. Remove once legacy clients are gone.
   */
  private createLegacySeal(
    rumor: TRumor,
    encryptionPrivkey: Uint8Array,
    recipientEncryptionPubkey: string
  ): Event {
    const conversationKey = getConversationKey(encryptionPrivkey, recipientEncryptionPubkey)
    const encrypted = nip44.v2.encrypt(JSON.stringify(rumor), conversationKey)

    return finalizeEvent(
      {
        kind: kinds.Seal,
        content: encrypted,
        created_at: rumor.created_at,
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
        kind: kinds.GiftWrap,
        content,
        created_at: randomTimeUpTo2DaysInThePast(),
        tags
      },
      randomKey
    ) as unknown as Event
  }

  /**
   * Tries to unwrap a gift wrap with each candidate private key in turn (current
   * key first, then retired keys kept during the rotation grace period), returning
   * the first success. Lets a recipient still decrypt messages a contact encrypted
   * to an older encryption key it hasn't learned was rotated.
   */
  unwrapGiftWrapWithKeys(
    giftWrap: Event,
    recipientPrivkeys: Uint8Array[]
  ): TUnwrappedMessage | null {
    for (const privkey of recipientPrivkeys) {
      const unwrapped = this.unwrapGiftWrap(giftWrap, privkey)
      if (unwrapped) return unwrapped
    }
    return null
  }

  /**
   * Unwraps a gift wrap with a single private key. Returns null on any failure
   * (wrong key, malformed payload, bad signature) — failure is expected and
   * silent because callers try multiple keys and most gift wraps in a batch are
   * not addressed to this key.
   */
  unwrapGiftWrap(giftWrap: Event, recipientPrivkey: Uint8Array): TUnwrappedMessage | null {
    try {
      const giftWrapConvKey = nip44.v2.utils.getConversationKey(recipientPrivkey, giftWrap.pubkey)
      const sealJson = nip44.v2.decrypt(giftWrap.content, giftWrapConvKey)
      const seal: Event = JSON.parse(sealJson)
      if (!verifyEvent(seal)) {
        throw new Error('Invalid seal signature')
      }

      // Current format: seal is identity-signed and carries the sender's encryption
      // pubkey in an `n` tag. Legacy format: seal is encryption-key-signed, so
      // seal.pubkey IS the encryption pubkey.
      const nTag = seal.tags.find((t) => t[0] === 'n')?.[1]
      const sealSignedByIdentity = !!nTag
      const senderEncryptionPubkey = nTag ?? seal.pubkey

      const sealConvKey = getConversationKey(recipientPrivkey, senderEncryptionPubkey)
      const rumorJson = nip44.v2.decrypt(seal.content, sealConvKey)
      const rumor = JSON.parse(rumorJson)

      // Self-authenticating: the identity signature plus the pubkey match prove
      // the rumor was vouched for by rumor.pubkey itself. Reject otherwise.
      if (sealSignedByIdentity && rumor.pubkey !== seal.pubkey) {
        throw new Error('Rumor pubkey does not match seal pubkey')
      }

      const recipientPubkey = this.getRecipientPubkeyFromGiftWrap(giftWrap)
      if (!recipientPubkey) {
        throw new Error('Recipient pubkey not found in gift wrap tags')
      }

      return {
        rumor,
        senderPubkey: rumor.pubkey,
        senderEncryptionPubkey,
        recipientPubkey,
        giftWrapId: giftWrap.id,
        giftWrapCreatedAt: giftWrap.created_at,
        sealSignedByIdentity
      }
    } catch {
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
