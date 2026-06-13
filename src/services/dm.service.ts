import { DM_TIME_RANDOMIZATION_SECONDS, ExtendedKind } from '@/constants'
import { isValidPubkey } from '@/lib/pubkey'
import { tagNameEquals } from '@/lib/tag'
import { TDmConversation, TDmMessage, TEncryptionKeypair } from '@/types'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import client from './client.service'
import cryptoFileService from './crypto-file.service'
import encryptionKeyService from './encryption-key.service'
import indexedDb from './indexed-db.service'
import storage from './local-storage.service'
import nip17GiftWrapService, { TUnwrappedMessage } from './nip17-gift-wrap.service'

class DmService {
  static instance: DmService

  private currentAccountPubkey: string | null = null
  private currentEncryptionKeypair: TEncryptionKeypair | null = null
  // Rotated-out encryption keys still within the grace period, tried as decryption
  // fallbacks so messages encrypted to an old key aren't lost after a key rotation.
  private retiredEncryptionKeypairs: TEncryptionKeypair[] = []
  private isInitialized = false
  private isInitializing = false
  private relaySubscription: { close: () => void } | null = null
  private messageListeners = new Set<(message: TDmMessage) => void>()
  private reactionListeners = new Set<(reaction: TDmMessage) => void>()
  private dataChangedListeners = new Set<() => void>()
  private loadingListeners = new Set<(loading: boolean) => void>()
  private sendingStatuses = new Map<string, 'sending' | 'sent' | 'failed'>()
  private sendingStatusListeners = new Set<() => void>()
  private pendingPublishData = new Map<
    string,
    { recipientGiftWraps: Event[]; selfGiftWraps: Event[]; recipientDmRelays: string[] }
  >()
  private syncRequestListeners = new Set<(event: Event) => void>()
  private encryptionKeyChangedListeners = new Set<(newPubkey: string) => void>()
  private activeConversationKey: string | null = null

  private constructor() {}

  static getInstance(): DmService {
    if (!DmService.instance) {
      DmService.instance = new DmService()
    }
    return DmService.instance
  }

  async init(accountPubkey: string, encryptionKeypair: TEncryptionKeypair): Promise<void> {
    if (this.isInitializing) return
    if (this.isInitialized && this.currentAccountPubkey === accountPubkey) return

    if (this.currentAccountPubkey && this.currentAccountPubkey !== accountPubkey) {
      this.destroy()
    }

    this.isInitializing = true
    this.emitLoadingChanged()
    this.currentAccountPubkey = accountPubkey
    this.currentEncryptionKeypair = encryptionKeypair
    this.retiredEncryptionKeypairs = encryptionKeyService.getValidRetiredKeypairs(accountPubkey)

    try {
      let since = storage.getDmLastSyncedAt(accountPubkey)
      if (since && !(await indexedDb.hasDmMessages())) {
        storage.clearDmSyncState(accountPubkey)
        since = 0
      }
      await this.initMessages(accountPubkey, encryptionKeypair, since || undefined)
      storage.setDmLastSyncedAt(accountPubkey, Math.floor(Date.now() / 1000))
      this.emitDataChanged()
      this.startRelaySubscription(accountPubkey, encryptionKeypair)
      this.isInitialized = true
    } finally {
      this.isInitializing = false
      this.emitLoadingChanged()
    }
  }

  async reinit(): Promise<void> {
    if (!this.currentAccountPubkey || !this.currentEncryptionKeypair) return

    const pubkey = this.currentAccountPubkey
    const keypair = this.currentEncryptionKeypair

    if (this.relaySubscription) {
      this.relaySubscription.close()
      this.relaySubscription = null
    }
    this.isInitialized = false
    this.isInitializing = false

    await this.init(pubkey, keypair)
  }

  resetEncryption(): void {
    if (this.relaySubscription) {
      this.relaySubscription.close()
      this.relaySubscription = null
    }
    this.currentEncryptionKeypair = null
    this.retiredEncryptionKeypairs = []
    this.isInitialized = false
    this.isInitializing = false
  }

  /**
   * Unwraps a gift wrap, trying the current encryption key first and then any
   * retired keys still within the grace period. This lets us decrypt messages a
   * contact encrypted to an older key it hasn't yet learned was rotated.
   */
  private tryUnwrap(giftWrap: Event) {
    const privkeys = [
      ...(this.currentEncryptionKeypair ? [this.currentEncryptionKeypair.privkey] : []),
      ...this.retiredEncryptionKeypairs.map((k) => k.privkey)
    ]
    return nip17GiftWrapService.unwrapGiftWrapWithKeys(giftWrap, privkeys)
  }

  destroy(): void {
    this.resetEncryption()
    this.messageListeners.clear()
    this.reactionListeners.clear()
    this.dataChangedListeners.clear()
    this.loadingListeners.clear()
    this.sendingStatuses.clear()
    this.sendingStatusListeners.clear()
    this.syncRequestListeners.clear()
    this.encryptionKeyChangedListeners.clear()
    this.activeConversationKey = null
    this.currentAccountPubkey = null
  }

  onNewMessage(listener: (message: TDmMessage) => void): () => void {
    this.messageListeners.add(listener)
    return () => {
      this.messageListeners.delete(listener)
    }
  }

  onDataChanged(listener: () => void): () => void {
    this.dataChangedListeners.add(listener)
    return () => {
      this.dataChangedListeners.delete(listener)
    }
  }

  getIsLoading(): boolean {
    return this.isInitializing
  }

  onLoadingChanged(listener: (loading: boolean) => void): () => void {
    this.loadingListeners.add(listener)
    return () => {
      this.loadingListeners.delete(listener)
    }
  }

  private emitLoadingChanged(): void {
    for (const listener of this.loadingListeners) {
      listener(this.isInitializing)
    }
  }

  getSendingStatus(messageId: string): 'sending' | 'sent' | 'failed' | undefined {
    return this.sendingStatuses.get(messageId)
  }

  async resendMessage(messageId: string): Promise<void> {
    const data = this.pendingPublishData.get(messageId)
    if (!data) return

    this.sendingStatuses.set(messageId, 'sending')
    this.emitSendingStatusChanged()

    try {
      const accountPubkey = this.currentAccountPubkey
      const myDmRelays = accountPubkey ? await client.fetchDmRelays(accountPubkey) : []
      await Promise.all([
        this.publishGiftWraps(data.recipientDmRelays, data.recipientGiftWraps, true),
        myDmRelays.length > 0
          ? this.publishGiftWraps(myDmRelays, data.selfGiftWraps, false)
          : Promise.resolve()
      ])

      this.sendingStatuses.set(messageId, 'sent')
      this.pendingPublishData.delete(messageId)
      this.emitSendingStatusChanged()

      setTimeout(() => {
        this.sendingStatuses.delete(messageId)
        this.emitSendingStatusChanged()
      }, 3000)
    } catch {
      this.sendingStatuses.set(messageId, 'failed')
      this.emitSendingStatusChanged()
    }
  }

  /**
   * Publishes a set of dual-format gift wraps to a relay set. Index 0 is the current
   * (identity-signed) format; index 1+ are legacy compatibility copies. When
   * `requirePrimary` is true, a failure of the current-format wrap is rethrown (so the
   * message is marked failed); legacy-format failures are only logged.
   */
  private async publishGiftWraps(
    relays: string[],
    giftWraps: Event[],
    requirePrimary: boolean
  ): Promise<void> {
    const results = await Promise.allSettled(
      giftWraps.map((giftWrap) => client.publishEvent(relays, giftWrap))
    )
    results.forEach((result, i) => {
      if (result.status !== 'rejected') return
      if (i === 0 && requirePrimary) {
        throw result.reason
      }
      console.warn(`[DM] gift wrap publish failed (${i === 0 ? 'current' : 'legacy'}):`, result.reason)
    })
  }

  onSendingStatusChanged(listener: () => void): () => void {
    this.sendingStatusListeners.add(listener)
    return () => {
      this.sendingStatusListeners.delete(listener)
    }
  }

  private emitNewMessage(message: TDmMessage): void {
    for (const listener of this.messageListeners) {
      listener(message)
    }
    this.emitDataChanged()
  }

  onNewReaction(listener: (reaction: TDmMessage) => void): () => void {
    this.reactionListeners.add(listener)
    return () => {
      this.reactionListeners.delete(listener)
    }
  }

  private emitNewReaction(reaction: TDmMessage): void {
    for (const listener of this.reactionListeners) {
      listener(reaction)
    }
  }

  private emitDataChanged(): void {
    for (const listener of this.dataChangedListeners) {
      listener()
    }
  }

  private emitSendingStatusChanged(): void {
    for (const listener of this.sendingStatusListeners) {
      listener()
    }
  }

  onSyncRequest(listener: (event: Event) => void): () => void {
    this.syncRequestListeners.add(listener)
    return () => {
      this.syncRequestListeners.delete(listener)
    }
  }

  private emitSyncRequest(event: Event): void {
    for (const listener of this.syncRequestListeners) {
      listener(event)
    }
  }

  onEncryptionKeyChanged(listener: (newPubkey: string) => void): () => void {
    this.encryptionKeyChangedListeners.add(listener)
    return () => {
      this.encryptionKeyChangedListeners.delete(listener)
    }
  }

  private emitEncryptionKeyChanged(newPubkey: string): void {
    for (const listener of this.encryptionKeyChangedListeners) {
      listener(newPubkey)
    }
  }

  markSyncRequestProcessed(eventId: string): void {
    storage.addProcessedSyncRequestId(eventId)
  }

  async importMessages(accountPubkey: string, rumors: Event[]): Promise<number> {
    let importedCount = 0

    for (const rumor of rumors) {
      const recipientPubkey = rumor.tags.find((t) => t[0] === 'p')?.[1]
      if (!recipientPubkey) continue

      const isFromMe = rumor.pubkey === accountPubkey
      const otherPubkey = isFromMe ? recipientPubkey : rumor.pubkey
      const participantsKey = this.getParticipantsKey(rumor.pubkey, recipientPubkey)

      const replyTag = rumor.tags.find((t) => t[0] === 'e')
      const replyToId = replyTag?.[1]

      const message: TDmMessage = {
        id: rumor.id,
        participantsKey,
        senderPubkey: rumor.pubkey,
        content: rumor.content,
        createdAt: rumor.created_at,
        originalEvent: rumor,
        decryptedRumor: rumor,
        ...(replyToId ? { replyTo: { id: replyToId, content: '', senderPubkey: '' } } : {})
      }

      await this.saveMessage(message)
      if (rumor.kind !== kinds.Reaction) {
        await this.updateConversation(accountPubkey, otherPubkey, message)
      }
      importedCount++
    }

    this.emitDataChanged()
    return importedCount
  }

  async checkDmSupport(
    pubkey: string,
    skipCache = false
  ): Promise<{ hasDmRelays: boolean; hasEncryptionKey: boolean; encryptionPubkey: string | null }> {
    const [dmRelaysEvent, encryptionKeyEvent] = await Promise.all([
      client.fetchDmRelaysEvent(pubkey, true, skipCache),
      client.fetchEncryptionKeyAnnouncementEvent(pubkey, true, skipCache)
    ])

    // A Kind 10050 event can exist while listing zero relays (e.g. the user
    // removed them all). Treat that as "no DM relays" so setup gates on it
    // rather than letting messaging proceed against an empty relay set.
    const hasDmRelays =
      !!dmRelaysEvent && dmRelaysEvent.tags.some((tag) => tag[0] === 'relay' && !!tag[1])

    let encryptionPubkey = encryptionKeyEvent
      ? encryptionKeyService.getEncryptionPubkeyFromEvent(encryptionKeyEvent)
      : null
    let hasEncryptionKey = !!encryptionKeyEvent

    // Fallback: if we've received messages from them, we already know their encryption pubkey
    if (!hasEncryptionKey && this.currentAccountPubkey) {
      const conversation = await this.getConversation(this.currentAccountPubkey, pubkey)
      if (conversation?.encryptionPubkey) {
        hasEncryptionKey = true
        encryptionPubkey = conversation.encryptionPubkey
      } else if (conversation && this.currentEncryptionKeypair) {
        // Try to extract encryption pubkey by fetching a gift wrap from relays
        const extracted = await this.extractEncryptionPubkeyFromRelays(
          this.currentAccountPubkey,
          pubkey,
          this.currentEncryptionKeypair
        )
        if (extracted) {
          hasEncryptionKey = true
          encryptionPubkey = extracted
        }
      }
    }

    return {
      hasDmRelays,
      hasEncryptionKey,
      encryptionPubkey
    }
  }

  async getRecipientEncryptionPubkey(pubkey: string): Promise<string | null> {
    const event = await client.fetchEncryptionKeyAnnouncementEvent(pubkey)
    if (event) {
      const recipient = event.tags.find(tagNameEquals('n'))?.[1]
      if (recipient && isValidPubkey(recipient)) return recipient
    }
    // Fallback: encryption pubkey learned from previously *verified* received messages.
    // updateConversation() / rebuildConversationsFromMessages() refuse to write this
    // field unless the source message passed verification, so the cache cannot be
    // poisoned by impersonation attempts.
    if (this.currentAccountPubkey) {
      const conversation = await this.getConversation(this.currentAccountPubkey, pubkey)
      if (conversation?.encryptionPubkey) return conversation.encryptionPubkey
    }
    return null
  }

  /**
   * Canonical (authoritative) source for a pubkey's current DM encryption key.
   * Used only by the verification pipeline — never falls back to
   * `conversation.encryptionPubkey`, because that fallback is what an impersonator
   * would otherwise be able to poison.
   *
   * `skipCache=true` forces a relay re-fetch even if a Kind 10044 is already
   * cached — necessary when verifying messages encrypted with a freshly rotated
   * key that the cache hasn't observed yet.
   */
  async getCanonicalEncryptionPubkey(pubkey: string, skipCache = false): Promise<string | null> {
    const event = await client.fetchEncryptionKeyAnnouncementEvent(pubkey, true, skipCache)
    if (!event) return null
    const n = encryptionKeyService.getEncryptionPubkeyFromEvent(event)
    return n && isValidPubkey(n) ? n : null
  }

  /**
   * One-shot verification at ingestion time. Result is persisted on the message and
   * never re-evaluated (per design — see docs/dm-feature.md / plan).
   *
   * - For own messages: the sender encryption pubkey must match the current
   *   encryption pubkey we are using right now. (A message we just sent ourselves is
   *   verified by construction; a self-copy received from another device verifies the
   *   same way.)
   * - For peer messages with an identity-signed seal (current format): the seal
   *   signature and rumor.pubkey === seal.pubkey were already checked in unwrap, so
   *   the message is trusted with no relay round-trip.
   * - For peer messages with a legacy encryption-key-signed seal: seal.pubkey must
   *   match rumor.pubkey's published Kind 10044 encryption pubkey. If the cached Kind
   *   10044 disagrees, force-refetch once — the sender may have rotated their key
   *   after our last cache update. Persistent mismatches degrade to `false` (the
   *   message is still readable; the UI just flags it).
   *
   * Per-batch dedupe of relay fetches is handled inside `client.fetchReplaceableEvent`
   * by its DataLoader, so no extra caching layer is needed here.
   */
  async determineVerification(
    unwrapped: TUnwrappedMessage,
    accountPubkey: string,
    myEncryptionPubkey: string
  ): Promise<boolean> {
    const { rumor, senderEncryptionPubkey, sealSignedByIdentity } = unwrapped

    // Identity-signed seals are self-authenticating: unwrapGiftWrap already verified
    // seal.sig and rumor.pubkey === seal.pubkey, so no Kind 10044 round-trip needed.
    if (sealSignedByIdentity) {
      return true
    }

    if (rumor.pubkey === accountPubkey) {
      return senderEncryptionPubkey === myEncryptionPubkey
    }

    // Legacy encryption-key-signed seal: bind seal.pubkey to the sender's identity by
    // cross-checking against the published Kind 10044. First trust the cache if present.
    let canonical = await this.getCanonicalEncryptionPubkey(rumor.pubkey)
    if (canonical && senderEncryptionPubkey === canonical) return true

    // Cache disagrees. Could be a key rotation we haven't observed yet — force a
    // relay re-fetch before deciding. (An impersonator's seal.pubkey still won't
    // match the legitimate refreshed value, so this is safe.)
    canonical = await this.getCanonicalEncryptionPubkey(rumor.pubkey, true)
    return !!canonical && senderEncryptionPubkey === canonical
  }

  async subscribeRecipientEncryptionKey(
    recipientPubkey: string,
    onChanged?: (newPubkey: string) => void
  ) {
    const relays = await client.fetchDmRelays(recipientPubkey)

    return client.subscribe(
      relays,
      {
        kinds: [ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT],
        authors: [recipientPubkey],
        limit: 0
      },
      {
        onevent: async (event) => {
          await client.updateEncryptionKeyAnnouncementCache(event)
          const newPubkey = encryptionKeyService.getEncryptionPubkeyFromEvent(event)
          if (newPubkey) {
            onChanged?.(newPubkey)
          }
        }
      }
    )
  }

  async initMessages(accountPubkey: string, encryptionKeypair: TEncryptionKeypair, since?: number) {
    const myDmRelays = await client.fetchDmRelays(accountPubkey)
    if (myDmRelays.length === 0) {
      return
    }

    const BATCH_LIMIT = 1000

    // Forward sync: fetch new messages since last sync
    if (since) {
      let _since = since - DM_TIME_RANDOMIZATION_SECONDS
      while (true) {
        const events = await client.fetchEvents(myDmRelays, {
          kinds: [ExtendedKind.GIFT_WRAP],
          '#p': [accountPubkey],
          since: _since,
          limit: BATCH_LIMIT
        })
        if (events.length === 0) break

        // events already sorted desc and trimmed by fetchEvents
        _since = events[0].created_at + 1

        await this.processGiftWrapBatch(accountPubkey, encryptionKeypair, events)
      }
    }

    // Backward sync: paginate through historical messages
    let backwardCursor = storage.getDmBackwardCursor(accountPubkey)
    if (backwardCursor === 0) return // all history already fetched

    while (true) {
      const filter: Filter = {
        kinds: [ExtendedKind.GIFT_WRAP],
        '#p': [accountPubkey],
        limit: BATCH_LIMIT
      }
      if (backwardCursor && backwardCursor > 0) {
        filter.until = backwardCursor
      }

      const events = await client.fetchEvents(myDmRelays, filter)
      if (events.length === 0) {
        storage.setDmBackwardCursor(accountPubkey, 0)
        break
      }

      await this.processGiftWrapBatch(accountPubkey, encryptionKeypair, events)
      this.emitDataChanged()

      // events already sorted desc by fetchEvents, oldest is last
      const newCursor = events[events.length - 1].created_at - 1
      if (newCursor >= (backwardCursor ?? Infinity)) {
        storage.setDmBackwardCursor(accountPubkey, 0)
        break
      }
      backwardCursor = newCursor
      storage.setDmBackwardCursor(accountPubkey, backwardCursor)
    }
  }

  private async processGiftWrapBatch(
    accountPubkey: string,
    encryptionKeypair: TEncryptionKeypair,
    events: Event[]
  ) {
    const messages: TDmMessage[] = []
    const encryptionPubkeyMap = new Map<string, string>()
    let unwrapFailCount = 0
    let parseFailCount = 0

    for (const giftWrap of events) {
      const unwrapped = this.tryUnwrap(giftWrap)
      if (!unwrapped) {
        unwrapFailCount++
        continue
      }

      const verified = await this.determineVerification(
        unwrapped,
        accountPubkey,
        encryptionKeypair.pubkey
      )

      const message = this.createMessageFromUnwrapped(
        accountPubkey,
        encryptionKeypair.pubkey,
        unwrapped,
        giftWrap,
        verified
      )
      if (message) {
        await this.resolveReplyTo(message)
        await this.saveMessage(message)
        messages.push(message)

        const fromMe = this.isFromMe(
          unwrapped.senderPubkey,
          accountPubkey,
          encryptionKeypair.pubkey
        )
        // Only verified messages contribute to the conversation.encryptionPubkey cache;
        // otherwise an impersonator could poison the cache and reroute future sends.
        if (!fromMe && unwrapped.senderEncryptionPubkey && verified) {
          encryptionPubkeyMap.set(unwrapped.senderPubkey, unwrapped.senderEncryptionPubkey)
        }
      } else {
        parseFailCount++
      }
    }

    const sentCount = messages.filter((m) => m.senderPubkey === accountPubkey).length
    const receivedCount = messages.length - sentCount
    console.log(
      `[DM sync] batch: ${events.length} events, ${messages.length} messages (${sentCount} sent, ${receivedCount} received), ${unwrapFailCount} unwrap failed, ${parseFailCount} parse failed`
    )

    await this.rebuildConversationsFromMessages(accountPubkey, messages, encryptionPubkeyMap)
  }

  async sendMessage(
    accountPubkey: string,
    recipientPubkey: string,
    content: string,
    replyTo?: { id: string; content: string; senderPubkey: string },
    additionalTags?: string[][]
  ): Promise<TDmMessage | null> {
    const keypair =
      this.currentEncryptionKeypair ?? encryptionKeyService.getEncryptionKeypair(accountPubkey)
    if (!keypair) {
      throw new Error('Encryption keypair not available')
    }

    const recipientEncryptionPubkey = await this.getRecipientEncryptionPubkey(recipientPubkey)
    if (!recipientEncryptionPubkey) {
      throw new Error('Recipient does not have encryption key published')
    }

    const recipientDmRelays = await client.fetchDmRelays(recipientPubkey)

    const signer = client.signer
    if (!signer) {
      throw new Error('Signer not available')
    }

    const replyRelayHint = recipientDmRelays[0] ?? ''
    const replyTags = replyTo ? [['e', replyTo.id, replyRelayHint]] : []
    const extraTags = [...replyTags, ...(additionalTags ?? [])]
    const { rumor, recipientGiftWraps, selfGiftWraps } =
      await nip17GiftWrapService.createDualGiftWraps(
        content,
        accountPubkey,
        signer,
        keypair.privkey,
        recipientPubkey,
        recipientEncryptionPubkey,
        extraTags
      )

    const participantsKey = this.getParticipantsKey(accountPubkey, recipientPubkey)
    const message: TDmMessage = {
      id: rumor.id,
      participantsKey,
      senderPubkey: accountPubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      originalEvent: selfGiftWraps[0],
      decryptedRumor: rumor as unknown as Event,
      ...(replyTo ? { replyTo } : {})
    }

    // Save and show immediately (optimistic UI)
    await this.saveMessage(message)
    await this.updateConversation(accountPubkey, recipientPubkey, message)
    this.pendingPublishData.set(message.id, { recipientGiftWraps, selfGiftWraps, recipientDmRelays })
    this.sendingStatuses.set(message.id, 'sending')
    this.emitNewMessage(message)

    try {
      const myDmRelays = await client.fetchDmRelays(accountPubkey)
      await Promise.all([
        this.publishGiftWraps(recipientDmRelays, recipientGiftWraps, true),
        this.publishGiftWraps(myDmRelays, selfGiftWraps, false)
      ])

      this.sendingStatuses.set(message.id, 'sent')
      this.pendingPublishData.delete(message.id)
      this.emitSendingStatusChanged()

      setTimeout(() => {
        this.sendingStatuses.delete(message.id)
        this.emitSendingStatusChanged()
      }, 3000)
    } catch (error) {
      this.sendingStatuses.set(message.id, 'failed')
      this.emitSendingStatusChanged()
      throw error
    }

    return message
  }

  async sendFileMessage(
    accountPubkey: string,
    recipientPubkey: string,
    fileUrl: string,
    mimeType: string,
    encryptionKey: Uint8Array,
    encryptionNonce: Uint8Array,
    originalHash: string,
    dim?: string,
    size?: number,
    thumbHash?: string
  ): Promise<TDmMessage | null> {
    const keypair =
      this.currentEncryptionKeypair ?? encryptionKeyService.getEncryptionKeypair(accountPubkey)
    if (!keypair) {
      throw new Error('Encryption keypair not available')
    }

    const recipientEncryptionPubkey = await this.getRecipientEncryptionPubkey(recipientPubkey)
    if (!recipientEncryptionPubkey) {
      throw new Error('Recipient does not have encryption key published')
    }

    const recipientDmRelays = await client.fetchDmRelays(recipientPubkey)

    const hexKey = cryptoFileService.bytesToHex(encryptionKey)
    const hexNonce = cryptoFileService.bytesToHex(encryptionNonce)

    const fileTags: string[][] = [
      ['file-type', mimeType],
      ['encryption-algorithm', 'aes-gcm'],
      ['decryption-key', hexKey],
      ['decryption-nonce', hexNonce],
      ['ox', originalHash]
    ]
    if (dim) {
      fileTags.push(['dim', dim])
    }
    if (size !== undefined) {
      fileTags.push(['size', String(size)])
    }
    if (thumbHash) {
      fileTags.push(['thumbhash', thumbHash])
    }

    const signer = client.signer
    if (!signer) {
      throw new Error('Signer not available')
    }

    const { rumor, recipientGiftWraps, selfGiftWraps } =
      await nip17GiftWrapService.createDualGiftWraps(
        fileUrl,
        accountPubkey,
        signer,
        keypair.privkey,
        recipientPubkey,
        recipientEncryptionPubkey,
        fileTags,
        ExtendedKind.RUMOR_FILE
      )

    const participantsKey = this.getParticipantsKey(accountPubkey, recipientPubkey)
    const message: TDmMessage = {
      id: rumor.id,
      participantsKey,
      senderPubkey: accountPubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      originalEvent: selfGiftWraps[0],
      decryptedRumor: rumor as unknown as Event
    }

    await this.saveMessage(message)
    await this.updateConversation(accountPubkey, recipientPubkey, message)
    this.pendingPublishData.set(message.id, { recipientGiftWraps, selfGiftWraps, recipientDmRelays })
    this.sendingStatuses.set(message.id, 'sending')
    this.emitNewMessage(message)

    try {
      const myDmRelays = await client.fetchDmRelays(accountPubkey)
      await Promise.all([
        this.publishGiftWraps(recipientDmRelays, recipientGiftWraps, true),
        this.publishGiftWraps(myDmRelays, selfGiftWraps, false)
      ])

      this.sendingStatuses.set(message.id, 'sent')
      this.pendingPublishData.delete(message.id)
      this.emitSendingStatusChanged()

      setTimeout(() => {
        this.sendingStatuses.delete(message.id)
        this.emitSendingStatusChanged()
      }, 3000)
    } catch (error) {
      this.sendingStatuses.set(message.id, 'failed')
      this.emitSendingStatusChanged()
      throw error
    }

    return message
  }

  async sendReaction(
    accountPubkey: string,
    recipientPubkey: string,
    messageId: string,
    emoji: string,
    emojiTag?: string[]
  ): Promise<TDmMessage | null> {
    const keypair =
      this.currentEncryptionKeypair ?? encryptionKeyService.getEncryptionKeypair(accountPubkey)
    if (!keypair) {
      throw new Error('Encryption keypair not available')
    }

    const recipientEncryptionPubkey = await this.getRecipientEncryptionPubkey(recipientPubkey)
    if (!recipientEncryptionPubkey) {
      throw new Error('Recipient does not have encryption key published')
    }

    const recipientDmRelays = await client.fetchDmRelays(recipientPubkey)
    const relayHint = recipientDmRelays[0] ?? ''

    const signer = client.signer
    if (!signer) {
      throw new Error('Signer not available')
    }

    const extraTags: string[][] = [['e', messageId, relayHint]]
    if (emojiTag) {
      extraTags.push(emojiTag)
    }

    const { rumor, recipientGiftWraps, selfGiftWraps } =
      await nip17GiftWrapService.createDualGiftWraps(
        emoji,
        accountPubkey,
        signer,
        keypair.privkey,
        recipientPubkey,
        recipientEncryptionPubkey,
        extraTags,
        kinds.Reaction
      )

    const participantsKey = this.getParticipantsKey(accountPubkey, recipientPubkey)
    const message: TDmMessage = {
      id: rumor.id,
      participantsKey,
      senderPubkey: accountPubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      originalEvent: selfGiftWraps[0],
      decryptedRumor: rumor as unknown as Event
    }

    await this.saveMessage(message)
    this.emitNewReaction(message)

    const myDmRelays = await client.fetchDmRelays(accountPubkey)
    await Promise.all([
      this.publishGiftWraps(recipientDmRelays, recipientGiftWraps, false),
      this.publishGiftWraps(myDmRelays, selfGiftWraps, false)
    ])

    return message
  }

  private async startRelaySubscription(
    accountPubkey: string,
    encryptionKeypair: TEncryptionKeypair
  ): Promise<void> {
    const myDmRelays = await client.fetchDmRelays(accountPubkey)

    const myClientKeypair = encryptionKeyService.getClientKeypair(accountPubkey)
    const fiveMinutesAgo = dayjs().subtract(5, 'minute').unix()
    const now = dayjs().unix()

    // Before we agree to answer other devices' key-sync requests, make sure the
    // encryption key this device holds is the one currently announced. A newer
    // key may have been announced while this device was offline, and the live
    // ENCRYPTION_KEY_ANNOUNCEMENT filter below only catches announcements
    // published from now on, so we query the existing one once here. If our
    // local key is stale, answering a sync request would hand the requesting
    // device an outdated key, so we skip sync-request handling entirely and
    // surface the change so this device re-syncs first.
    const announcement = await encryptionKeyService.queryEncryptionKeyAnnouncement(accountPubkey)
    const announcedPubkey = announcement
      ? encryptionKeyService.getEncryptionPubkeyFromEvent(announcement)
      : null
    const isEncryptionKeyUpToDate = !announcedPubkey || announcedPubkey === encryptionKeypair.pubkey

    const filters: Filter[] = [
      {
        kinds: [ExtendedKind.GIFT_WRAP],
        '#p': [accountPubkey],
        limit: 0
      },
      {
        kinds: [ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT],
        authors: [accountPubkey],
        limit: 0
      }
    ]
    if (isEncryptionKeyUpToDate) {
      filters.push({
        kinds: [ExtendedKind.CLIENT_KEY_ANNOUNCEMENT],
        authors: [accountPubkey],
        since: fiveMinutesAgo,
        limit: 1
      })
    }

    const sub = client.subscribe(
      myDmRelays,
      filters,
      {
        onevent: async (event) => {
          if (event.kind === ExtendedKind.CLIENT_KEY_ANNOUNCEMENT) {
            const clientPubkey = encryptionKeyService.getClientPubkeyFromEvent(event)
            if (!clientPubkey || clientPubkey === myClientKeypair.pubkey) return
            if (storage.getProcessedSyncRequestIds().includes(event.id)) return
            this.emitSyncRequest(event)
            return
          }

          if (event.kind === ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT) {
            const newPubkey = encryptionKeyService.getEncryptionPubkeyFromEvent(event)
            if (!newPubkey || newPubkey === encryptionKeypair.pubkey || event.created_at < now) {
              return
            }
            this.emitEncryptionKeyChanged(newPubkey)
            return
          }

          // GIFT_WRAP handling
          const giftWrap = event
          const unwrapped = this.tryUnwrap(giftWrap)
          if (!unwrapped) return

          const verified = await this.determineVerification(
            unwrapped,
            accountPubkey,
            encryptionKeypair.pubkey
          )

          const message = this.createMessageFromUnwrapped(
            accountPubkey,
            encryptionKeypair.pubkey,
            unwrapped,
            giftWrap,
            verified
          )
          if (message) {
            const isReaction = unwrapped.rumor.kind === kinds.Reaction
            if (!isReaction) {
              await this.resolveReplyTo(message)
            }
            await this.saveMessage(message)

            if (isReaction) {
              this.emitNewReaction(message)
            } else {
              const fromMe = this.isFromMe(
                unwrapped.senderPubkey,
                accountPubkey,
                encryptionKeypair.pubkey
              )
              const otherPubkey = fromMe
                ? unwrapped.rumor.tags.find((t) => t[0] === 'p')?.[1]
                : unwrapped.senderPubkey
              // Only propagate seal.pubkey into the conversation cache when the message
              // verified. An impersonator can otherwise reroute future sends.
              const otherEncryptionPubkey =
                fromMe || !verified ? undefined : unwrapped.senderEncryptionPubkey
              if (otherPubkey) {
                await this.updateConversation(
                  accountPubkey,
                  otherPubkey,
                  message,
                  otherEncryptionPubkey
                )
              }

              this.emitNewMessage(message)
            }
          }
        }
      }
    )

    this.relaySubscription = { close: () => sub.close() }

    // Emit after the subscription is in place so that, if a listener tears the
    // encryption down to re-sync, it closes the subscription we just created.
    if (!isEncryptionKeyUpToDate && announcedPubkey) {
      this.emitEncryptionKeyChanged(announcedPubkey)
    }
  }

  async deleteConversation(accountPubkey: string, otherPubkey: string): Promise<void> {
    const key = this.getConversationKey(accountPubkey, otherPubkey)
    const existing = await indexedDb.getDmConversation(key)
    if (!existing) return
    const deletedAt = Math.floor(Date.now() / 1000)
    await indexedDb.putDmConversation({
      ...existing,
      deleted: true,
      deletedAt,
      unreadCount: 0,
      hasReplied: false
    })
    this.emitDataChanged()
  }

  async getConversations(accountPubkey: string): Promise<TDmConversation[]> {
    const conversations = (await indexedDb.getAllDmConversations(accountPubkey)).filter(
      (c) => !c.deleted
    )

    // Migrate old conversations missing lastMessageRumor or having reaction as lastMessageRumor
    const needsMigration = conversations.filter(
      (c) => !c.lastMessageRumor || c.lastMessageRumor.kind === kinds.Reaction
    )
    if (needsMigration.length > 0) {
      await Promise.all(
        needsMigration.map(async (conv) => {
          const participantsKey = this.getParticipantsKey(accountPubkey, conv.pubkey)
          const messages = await indexedDb.getDmMessages(participantsKey, {
            after: conv.deletedAt
          })
          const latestChatMessage = messages
            .filter((m) => m.decryptedRumor?.kind !== kinds.Reaction)
            .sort((a, b) => b.createdAt - a.createdAt)[0]
          if (latestChatMessage?.decryptedRumor) {
            conv.lastMessageRumor = latestChatMessage.decryptedRumor
            await indexedDb.putDmConversation(conv)
          }
        })
      )
    }

    return conversations
  }

  async getConversation(
    accountPubkey: string,
    otherPubkey: string
  ): Promise<TDmConversation | null> {
    const key = this.getConversationKey(accountPubkey, otherPubkey)
    return indexedDb.getDmConversation(key)
  }

  async getMessages(
    accountPubkey: string,
    otherPubkey: string,
    options?: { limit?: number; before?: number }
  ): Promise<TDmMessage[]> {
    const participantsKey = this.getParticipantsKey(accountPubkey, otherPubkey)
    const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)
    const conversation = await indexedDb.getDmConversation(conversationKey)
    return indexedDb.getDmMessages(participantsKey, {
      ...options,
      after: conversation?.deletedAt
    })
  }

  async markConversationAsRead(accountPubkey: string, otherPubkey: string): Promise<void> {
    const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)
    const now = Math.floor(Date.now() / 1000)
    storage.setLastReadDmTime(accountPubkey, otherPubkey, now)

    const conversation = await indexedDb.getDmConversation(conversationKey)
    if (conversation && conversation.unreadCount > 0) {
      await indexedDb.putDmConversation({
        ...conversation,
        unreadCount: 0
      })
      this.emitDataChanged()
    }
  }

  setActiveConversation(accountPubkey: string, otherPubkey: string): void {
    this.activeConversationKey = this.getConversationKey(accountPubkey, otherPubkey)
  }

  clearActiveConversation(accountPubkey: string, otherPubkey: string): void {
    const key = this.getConversationKey(accountPubkey, otherPubkey)
    if (this.activeConversationKey === key) {
      this.activeConversationKey = null
    }
  }

  isActiveConversation(accountPubkey: string, otherPubkey: string): boolean {
    return this.activeConversationKey === this.getConversationKey(accountPubkey, otherPubkey)
  }

  getConversationKey(accountPubkey: string, otherPubkey: string): string {
    return `${accountPubkey}:${otherPubkey}`
  }

  getParticipantsKey(pubkey1: string, pubkey2: string): string {
    return [pubkey1, pubkey2].sort().join(':')
  }

  private async extractEncryptionPubkeyFromRelays(
    accountPubkey: string,
    otherPubkey: string,
    encryptionKeypair: TEncryptionKeypair
  ): Promise<string | null> {
    try {
      const myDmRelays = await client.fetchDmRelays(accountPubkey)
      if (myDmRelays.length === 0) return null

      const giftWraps = await client.fetchEvents(myDmRelays, {
        kinds: [ExtendedKind.GIFT_WRAP],
        '#p': [accountPubkey],
        limit: 20
      })

      for (const gw of giftWraps) {
        const unwrapped = this.tryUnwrap(gw)
        if (!unwrapped) continue

        const fromMe = this.isFromMe(
          unwrapped.senderPubkey,
          accountPubkey,
          encryptionKeypair.pubkey
        )
        if (!fromMe && unwrapped.senderPubkey === otherPubkey) {
          // Backfill conversation record
          const conversation = await this.getConversation(accountPubkey, otherPubkey)
          if (conversation) {
            conversation.encryptionPubkey = unwrapped.senderEncryptionPubkey
            await indexedDb.putDmConversation(conversation)
          }
          return unwrapped.senderEncryptionPubkey
        }
      }
    } catch (e) {
      console.error('[checkDmSupport] extractEncryptionPubkeyFromRelays failed:', e)
    }
    return null
  }

  private isFromMe(senderPubkey: string, accountPubkey: string, encryptionPubkey: string): boolean {
    return senderPubkey === accountPubkey || senderPubkey === encryptionPubkey
  }

  private createMessageFromUnwrapped(
    accountPubkey: string,
    encryptionPubkey: string,
    unwrapped: TUnwrappedMessage,
    giftWrap: Event,
    verified: boolean
  ): TDmMessage | null {
    const { rumor, senderPubkey } = unwrapped

    if (
      rumor.kind !== ExtendedKind.RUMOR_CHAT &&
      rumor.kind !== ExtendedKind.RUMOR_FILE &&
      rumor.kind !== kinds.Reaction
    ) {
      return null
    }

    const pTags = rumor.tags.filter((t) => t[0] === 'p')
    // Only support 1:1 chats, filter out group chats (multiple p tags)
    if (pTags.length !== 1) return null
    const recipientPubkey = pTags[0][1]

    const fromMe = this.isFromMe(senderPubkey, accountPubkey, encryptionPubkey)
    const effectiveSenderPubkey = fromMe ? accountPubkey : senderPubkey
    const participantsKey = this.getParticipantsKey(effectiveSenderPubkey, recipientPubkey)

    // Parse reply tag: ['e', kind-14-id, relay-url]
    const replyTag = rumor.tags.find((t) => t[0] === 'e')
    const replyToId = replyTag?.[1]

    return {
      id: rumor.id,
      participantsKey,
      senderPubkey: effectiveSenderPubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      originalEvent: giftWrap,
      decryptedRumor: rumor as unknown as Event,
      verified,
      ...(replyToId ? { replyTo: { id: replyToId, content: '', senderPubkey: '' } } : {})
    }
  }

  getFilePreviewContent(tags?: string[][]): string {
    const fileType = tags?.find((t) => t[0] === 'file-type')?.[1] ?? ''
    if (fileType.startsWith('image/')) return '[Image]'
    if (fileType.startsWith('video/')) return '[Video]'
    if (fileType.startsWith('audio/')) return '[Audio]'
    return '[File]'
  }

  async resolveReplyTo(message: TDmMessage): Promise<TDmMessage> {
    if (!message.replyTo || (message.replyTo.content && message.replyTo.senderPubkey)) {
      return message
    }
    const replyMsg = await indexedDb.getDmMessageById(message.replyTo.id)
    if (replyMsg) {
      const isFile = replyMsg.decryptedRumor?.kind === ExtendedKind.RUMOR_FILE
      message.replyTo = {
        id: replyMsg.id,
        content: isFile
          ? this.getFilePreviewContent(replyMsg.decryptedRumor?.tags)
          : replyMsg.content,
        senderPubkey: replyMsg.senderPubkey,
        tags: replyMsg.decryptedRumor?.tags
      }
    }
    return message
  }

  private async saveMessage(message: TDmMessage): Promise<void> {
    // `verified` is monotonic by design:
    //   - `true` may never be downgraded (a transient relay miss for Kind 10044
    //     during a refresh shouldn't undo a previously-confirmed identity).
    //   - `undefined` (legacy / imported messages that predate the check) is left
    //     alone — those records were never meant to participate in the check.
    //   - `false` may be upgraded to `true` on a later pass when the sender's
    //     Kind 10044 finally becomes reachable, but cannot regress.
    const existing = await indexedDb.getDmMessageById(message.id)
    if (existing && existing.verified !== false) {
      message.verified = existing.verified
    }
    await indexedDb.putDmMessage(message)
  }

  private async updateConversation(
    accountPubkey: string,
    otherPubkey: string,
    message: TDmMessage,
    otherEncryptionPubkey?: string
  ): Promise<void> {
    const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)
    const existing = await indexedDb.getDmConversation(conversationKey)

    // Messages older than the soft-delete cutoff should not resurrect the conversation
    // or update its last-message state for this account.
    if (existing?.deletedAt !== undefined && message.createdAt <= existing.deletedAt) {
      if (otherEncryptionPubkey && otherEncryptionPubkey !== existing.encryptionPubkey) {
        await indexedDb.putDmConversation({ ...existing, encryptionPubkey: otherEncryptionPubkey })
      }
      return
    }

    const lastReadTime = storage.getLastReadDmTime(accountPubkey, otherPubkey)
    const isActive = this.activeConversationKey === conversationKey
    const isUnread =
      !isActive && message.senderPubkey !== accountPubkey && message.createdAt > lastReadTime

    const isReaction = message.decryptedRumor?.kind === kinds.Reaction
    const isNewest = message.createdAt >= (existing?.lastMessageAt ?? 0)
    const isNewestFromSelf = isNewest && !isReaction && message.senderPubkey === accountPubkey
    if (isNewestFromSelf && message.createdAt > lastReadTime) {
      storage.setLastReadDmTime(accountPubkey, otherPubkey, message.createdAt)
    }

    const conversation: TDmConversation = {
      key: conversationKey,
      pubkey: otherPubkey,
      lastMessageAt: Math.max(existing?.lastMessageAt ?? 0, message.createdAt),
      lastMessageRumor:
        isNewest && !isReaction ? message.decryptedRumor : existing?.lastMessageRumor,
      unreadCount: isNewestFromSelf ? 0 : (existing?.unreadCount ?? 0) + (isUnread ? 1 : 0),
      hasReplied: existing?.hasReplied || message.senderPubkey === accountPubkey,
      encryptionPubkey: otherEncryptionPubkey ?? existing?.encryptionPubkey,
      deleted: false,
      deletedAt: existing?.deletedAt
    }

    await indexedDb.putDmConversation(conversation)
  }

  private async rebuildConversationsFromMessages(
    accountPubkey: string,
    messages: TDmMessage[],
    encryptionPubkeyMap?: Map<string, string>
  ): Promise<void> {
    // Group messages by conversation
    const conversationMap = new Map<string, { otherPubkey: string; messages: TDmMessage[] }>()

    for (const message of messages) {
      const otherPubkey =
        message.senderPubkey === accountPubkey
          ? message.decryptedRumor.tags?.find((t) => t[0] === 'p')?.[1]
          : message.senderPubkey

      if (!otherPubkey) continue

      const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)
      if (!conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, { otherPubkey, messages: [] })
      }
      conversationMap.get(conversationKey)!.messages.push(message)
    }

    // Build/update each conversation
    for (const [conversationKey, { otherPubkey, messages: convMessages }] of conversationMap) {
      const lastReadTime = storage.getLastReadDmTime(accountPubkey, otherPubkey)
      const existingConversation = await indexedDb.getDmConversation(conversationKey)
      const deletedAt = existingConversation?.deletedAt
      const participantsKey = this.getParticipantsKey(accountPubkey, otherPubkey)

      // Get all stored messages for this conversation to calculate accurate unread count
      const storedMessages = await indexedDb.getDmMessages(participantsKey, { after: deletedAt })
      const allMessages = [...storedMessages]

      // Add new messages that aren't already stored
      for (const msg of convMessages) {
        if (deletedAt !== undefined && msg.createdAt <= deletedAt) continue
        if (!allMessages.some((m) => m.id === msg.id)) {
          allMessages.push(msg)
        }
      }

      // Filter out reactions for conversation summary
      const chatMessages = allMessages.filter((m) => m.decryptedRumor?.kind !== kinds.Reaction)

      // Sort messages by time to find latest
      const sortedMessages = chatMessages.sort((a, b) => b.createdAt - a.createdAt)
      const latestMessage = sortedMessages[0]

      // If the newest chat message is from self, treat the conversation as read.
      const latestIsFromSelf = !!latestMessage && latestMessage.senderPubkey === accountPubkey
      if (latestIsFromSelf && latestMessage.createdAt > lastReadTime) {
        storage.setLastReadDmTime(accountPubkey, otherPubkey, latestMessage.createdAt)
      }

      // Count unread messages (from other user, after last read time, excluding reactions)
      const unreadCount = latestIsFromSelf
        ? 0
        : chatMessages.filter((m) => m.senderPubkey !== accountPubkey && m.createdAt > lastReadTime)
            .length

      // Check if the user has ever replied in this conversation
      const hasReplied =
        existingConversation?.hasReplied ||
        chatMessages.some((m) => m.senderPubkey === accountPubkey)

      const hasVisibleMessages = chatMessages.length > 0
      const deleted = hasVisibleMessages ? false : (existingConversation?.deleted ?? false)

      const conversation: TDmConversation = {
        key: conversationKey,
        pubkey: otherPubkey,
        lastMessageAt: latestMessage?.createdAt ?? existingConversation?.lastMessageAt ?? 0,
        lastMessageRumor: latestMessage?.decryptedRumor ?? existingConversation?.lastMessageRumor,
        unreadCount,
        hasReplied,
        encryptionPubkey:
          encryptionPubkeyMap?.get(otherPubkey) ?? existingConversation?.encryptionPubkey,
        deleted,
        deletedAt
      }

      await indexedDb.putDmConversation(conversation)
    }
  }
}

const instance = DmService.getInstance()
export default instance
