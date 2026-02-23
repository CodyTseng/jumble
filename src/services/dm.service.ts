import { DM_TIME_RANDOMIZATION_SECONDS, ExtendedKind } from '@/constants'
import { isValidPubkey } from '@/lib/pubkey'
import { tagNameEquals } from '@/lib/tag'
import { TDmConversation, TDmMessage, TEncryptionKeypair } from '@/types'
import { Event, Filter } from 'nostr-tools'
import client from './client.service'
import encryptionKeyService from './encryption-key.service'
import indexedDb from './indexed-db.service'
import storage from './local-storage.service'
import nip17GiftWrapService, { TUnwrappedMessage } from './nip17-gift-wrap.service'

class DmService {
  static instance: DmService

  private currentAccountPubkey: string | null = null
  private currentEncryptionKeypair: TEncryptionKeypair | null = null
  private isInitialized = false
  private isInitializing = false
  private relaySubscription: { close: () => void } | null = null
  private messageListeners = new Set<(message: TDmMessage) => void>()
  private dataChangedListeners = new Set<() => void>()
  private sendingStatuses = new Map<string, 'sending' | 'sent' | 'failed'>()
  private sendingStatusListeners = new Set<() => void>()
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
    this.currentAccountPubkey = accountPubkey
    this.currentEncryptionKeypair = encryptionKeypair

    try {
      let since = storage.getDmLastSyncedAt(accountPubkey)
      if (since && !(await indexedDb.hasDmMessages())) {
        since = 0
        storage.setDmBackwardCursor(accountPubkey, 0)
      }
      await this.initMessages(accountPubkey, encryptionKeypair, since || undefined)
      storage.setDmLastSyncedAt(accountPubkey, Math.floor(Date.now() / 1000))
      this.emitDataChanged()
      this.startRelaySubscription(accountPubkey, encryptionKeypair)
      this.isInitialized = true
    } finally {
      this.isInitializing = false
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

  destroy(): void {
    if (this.relaySubscription) {
      this.relaySubscription.close()
      this.relaySubscription = null
    }
    this.messageListeners.clear()
    this.dataChangedListeners.clear()
    this.sendingStatuses.clear()
    this.sendingStatusListeners.clear()
    this.syncRequestListeners.clear()
    this.encryptionKeyChangedListeners.clear()
    this.activeConversationKey = null
    this.currentAccountPubkey = null
    this.currentEncryptionKeypair = null
    this.isInitialized = false
    this.isInitializing = false
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

  getSendingStatus(messageId: string): 'sending' | 'sent' | 'failed' | undefined {
    return this.sendingStatuses.get(messageId)
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
      const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)

      const replyTag = rumor.tags.find((t) => t[0] === 'e')
      const replyToId = replyTag?.[1]

      const message: TDmMessage = {
        id: rumor.id,
        conversationKey,
        senderPubkey: rumor.pubkey,
        content: rumor.content,
        createdAt: rumor.created_at,
        originalEvent: rumor,
        decryptedRumor: rumor,
        ...(replyToId ? { replyTo: { id: replyToId, content: '', senderPubkey: '' } } : {})
      }

      await this.saveMessage(accountPubkey, message)
      await this.updateConversation(accountPubkey, otherPubkey, message)
      importedCount++
    }

    this.emitDataChanged()
    return importedCount
  }

  async checkDmSupport(
    pubkey: string
  ): Promise<{ hasDmRelays: boolean; hasEncryptionKey: boolean; encryptionPubkey: string | null }> {
    const [dmRelaysEvent, encryptionKeyEvent] = await Promise.all([
      client.fetchDmRelaysEvent(pubkey),
      client.fetchEncryptionKeyAnnouncementEvent(pubkey)
    ])

    const encryptionPubkey = encryptionKeyEvent
      ? encryptionKeyService.getEncryptionPubkeyFromEvent(encryptionKeyEvent)
      : null

    return {
      hasDmRelays: !!dmRelaysEvent,
      hasEncryptionKey: !!encryptionKeyEvent,
      encryptionPubkey
    }
  }

  async getRecipientEncryptionPubkey(pubkey: string): Promise<string | null> {
    const event = await client.fetchEncryptionKeyAnnouncementEvent(pubkey)
    if (!event) return null
    const recipient = event.tags.find(tagNameEquals('n'))?.[1]
    if (recipient && isValidPubkey(recipient)) {
      return recipient
    }
    return null
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
          '#p': [encryptionKeypair.pubkey],
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
        '#p': [encryptionKeypair.pubkey],
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
      backwardCursor = events[events.length - 1].created_at
      storage.setDmBackwardCursor(accountPubkey, backwardCursor)
    }
  }

  private async processGiftWrapBatch(
    accountPubkey: string,
    encryptionKeypair: TEncryptionKeypair,
    events: Event[]
  ) {
    const messages: TDmMessage[] = []
    let unwrapFailCount = 0
    let parseFailCount = 0

    for (const giftWrap of events) {
      const unwrapped = nip17GiftWrapService.unwrapGiftWrap(giftWrap, encryptionKeypair.privkey)
      if (!unwrapped) {
        unwrapFailCount++
        continue
      }

      const message = this.createMessageFromUnwrapped(
        accountPubkey,
        encryptionKeypair.pubkey,
        unwrapped,
        giftWrap
      )
      if (message) {
        await this.resolveReplyTo(message)
        const saved = await this.saveMessage(accountPubkey, message)
        if (saved) {
          messages.push(message)
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

    await this.rebuildConversationsFromMessages(accountPubkey, messages)
  }

  async sendMessage(
    accountPubkey: string,
    recipientPubkey: string,
    content: string,
    replyTo?: { id: string; content: string; senderPubkey: string }
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

    const replyRelayHint = recipientDmRelays[0] ?? ''
    const extraTags = replyTo ? [['e', replyTo.id, replyRelayHint]] : undefined
    const { giftWrap, rumor } = nip17GiftWrapService.createGiftWrappedMessage(
      content,
      accountPubkey,
      keypair.privkey,
      recipientPubkey,
      recipientEncryptionPubkey,
      extraTags
    )

    const selfGiftWrap = nip17GiftWrapService.createGiftWrapForSelf(
      rumor,
      keypair.privkey,
      keypair.pubkey,
      accountPubkey
    )

    const conversationKey = this.getConversationKey(accountPubkey, recipientPubkey)
    const message: TDmMessage = {
      id: rumor.id,
      conversationKey,
      senderPubkey: accountPubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      originalEvent: selfGiftWrap,
      decryptedRumor: rumor as unknown as Event,
      ...(replyTo ? { replyTo } : {})
    }

    // Save and show immediately (optimistic UI)
    await this.saveMessage(accountPubkey, message)
    await this.updateConversation(accountPubkey, recipientPubkey, message)
    this.sendingStatuses.set(message.id, 'sending')
    this.emitNewMessage(message)

    try {
      const myDmRelays = await client.fetchDmRelays(accountPubkey)
      const [recipientResult, selfResult] = await Promise.allSettled([
        client.publishEvent(recipientDmRelays, giftWrap),
        client.publishEvent(myDmRelays, selfGiftWrap)
      ])
      if (selfResult.status === 'rejected') {
        console.warn('[DM] selfGiftWrap publish failed:', selfResult.reason)
      }
      if (recipientResult.status === 'rejected') {
        throw recipientResult.reason
      }

      this.sendingStatuses.set(message.id, 'sent')
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

  private async startRelaySubscription(
    accountPubkey: string,
    encryptionKeypair: TEncryptionKeypair
  ): Promise<void> {
    const myDmRelays = await client.fetchDmRelays(accountPubkey)

    const myClientKeypair = encryptionKeyService.getClientKeypair(accountPubkey)
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300

    const sub = client.subscribe(
      myDmRelays,
      [
        {
          kinds: [ExtendedKind.GIFT_WRAP],
          '#p': [encryptionKeypair.pubkey, accountPubkey],
          limit: 0
        },
        {
          kinds: [ExtendedKind.CLIENT_KEY_ANNOUNCEMENT],
          authors: [accountPubkey],
          since: fiveMinutesAgo,
          limit: 1
        },
        {
          kinds: [ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT],
          authors: [accountPubkey],
          limit: 0
        }
      ],
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
            if (!newPubkey || newPubkey === encryptionKeypair.pubkey) return
            this.emitEncryptionKeyChanged(newPubkey)
            return
          }

          // GIFT_WRAP handling
          const giftWrap = event
          const unwrapped = nip17GiftWrapService.unwrapGiftWrap(giftWrap, encryptionKeypair.privkey)
          if (!unwrapped) return

          const message = this.createMessageFromUnwrapped(
            accountPubkey,
            encryptionKeypair.pubkey,
            unwrapped,
            giftWrap
          )
          if (message) {
            await this.resolveReplyTo(message)
            const saved = await this.saveMessage(accountPubkey, message)
            if (!saved) return

            const fromMe = this.isFromMe(
              unwrapped.senderPubkey,
              accountPubkey,
              encryptionKeypair.pubkey
            )
            const otherPubkey = fromMe
              ? unwrapped.rumor.tags.find((t) => t[0] === 'p')?.[1]
              : unwrapped.senderPubkey
            if (otherPubkey) {
              await this.updateConversation(accountPubkey, otherPubkey, message)
            }

            this.emitNewMessage(message)
          }
        }
      }
    )

    this.relaySubscription = { close: () => sub.close() }
  }

  async deleteConversation(accountPubkey: string, otherPubkey: string): Promise<void> {
    const key = this.getConversationKey(accountPubkey, otherPubkey)
    const deletedAt = Math.floor(Date.now() / 1000)
    storage.setDmDeletedConversation(key, deletedAt)
    await indexedDb.deleteDmConversation(key)
    await indexedDb.deleteDmMessagesByConversationKey(key)
    this.emitDataChanged()
  }

  async getConversations(accountPubkey: string): Promise<TDmConversation[]> {
    return indexedDb.getAllDmConversations(accountPubkey)
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
    const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)
    return indexedDb.getDmMessages(conversationKey, options)
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
    const sorted = [accountPubkey, otherPubkey].sort()
    return `${sorted[0]}:${sorted[1]}`
  }

  private isFromMe(senderPubkey: string, accountPubkey: string, encryptionPubkey: string): boolean {
    return senderPubkey === accountPubkey || senderPubkey === encryptionPubkey
  }

  private createMessageFromUnwrapped(
    accountPubkey: string,
    encryptionPubkey: string,
    unwrapped: TUnwrappedMessage,
    giftWrap: Event
  ): TDmMessage | null {
    const { rumor, senderPubkey } = unwrapped

    if (rumor.kind !== ExtendedKind.RUMOR_CHAT && rumor.kind !== ExtendedKind.RUMOR_FILE) {
      return null
    }

    const recipientPubkey = rumor.tags.find((t) => t[0] === 'p')?.[1]
    if (!recipientPubkey) return null

    const fromMe = this.isFromMe(senderPubkey, accountPubkey, encryptionPubkey)
    const effectiveSenderPubkey = fromMe ? accountPubkey : senderPubkey
    const otherPubkey = fromMe ? recipientPubkey : senderPubkey
    const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)

    // Parse reply tag: ['e', kind-14-id, relay-url]
    const replyTag = rumor.tags.find((t) => t[0] === 'e')
    const replyToId = replyTag?.[1]

    return {
      id: rumor.id,
      conversationKey,
      senderPubkey: effectiveSenderPubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      originalEvent: giftWrap,
      decryptedRumor: rumor as unknown as Event,
      ...(replyToId ? { replyTo: { id: replyToId, content: '', senderPubkey: '' } } : {})
    }
  }

  async resolveReplyTo(message: TDmMessage): Promise<TDmMessage> {
    if (!message.replyTo || (message.replyTo.content && message.replyTo.senderPubkey)) {
      return message
    }
    const replyMsg = await indexedDb.getDmMessageById(message.replyTo.id)
    if (replyMsg) {
      message.replyTo = {
        id: replyMsg.id,
        content: replyMsg.content,
        senderPubkey: replyMsg.senderPubkey
      }
    }
    return message
  }

  private async saveMessage(_accountPubkey: string, message: TDmMessage): Promise<boolean> {
    const deletedAt = storage.getDmDeletedConversation(message.conversationKey)
    if (deletedAt !== null && message.createdAt <= deletedAt) {
      return false
    }
    await indexedDb.putDmMessage(message)
    return true
  }

  private async updateConversation(
    accountPubkey: string,
    otherPubkey: string,
    message: TDmMessage
  ): Promise<void> {
    const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)
    const existing = await indexedDb.getDmConversation(conversationKey)

    const lastReadTime = storage.getLastReadDmTime(accountPubkey, otherPubkey)
    const isActive = this.activeConversationKey === conversationKey
    const isUnread =
      !isActive && message.senderPubkey !== accountPubkey && message.createdAt > lastReadTime

    const conversation: TDmConversation = {
      key: conversationKey,
      pubkey: otherPubkey,
      lastMessageAt: Math.max(existing?.lastMessageAt ?? 0, message.createdAt),
      lastMessageContent:
        message.createdAt >= (existing?.lastMessageAt ?? 0)
          ? message.content
          : (existing?.lastMessageContent ?? ''),
      unreadCount: (existing?.unreadCount ?? 0) + (isUnread ? 1 : 0),
      hasReplied: existing?.hasReplied || message.senderPubkey === accountPubkey
    }

    await indexedDb.putDmConversation(conversation)
  }

  private async rebuildConversationsFromMessages(
    accountPubkey: string,
    messages: TDmMessage[]
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

      // Get all stored messages for this conversation to calculate accurate unread count
      const storedMessages = await indexedDb.getDmMessages(conversationKey, {})
      const allMessages = [...storedMessages]

      // Add new messages that aren't already stored
      for (const msg of convMessages) {
        if (!allMessages.some((m) => m.id === msg.id)) {
          allMessages.push(msg)
        }
      }

      // Sort messages by time to find latest
      const sortedMessages = allMessages.sort((a, b) => b.createdAt - a.createdAt)
      const latestMessage = sortedMessages[0]

      // Count unread messages (from other user, after last read time)
      const unreadCount = allMessages.filter(
        (m) => m.senderPubkey !== accountPubkey && m.createdAt > lastReadTime
      ).length

      // Check if the user has ever replied in this conversation
      const existingConversation = await indexedDb.getDmConversation(conversationKey)
      const hasReplied =
        existingConversation?.hasReplied ||
        allMessages.some((m) => m.senderPubkey === accountPubkey)

      const conversation: TDmConversation = {
        key: conversationKey,
        pubkey: otherPubkey,
        lastMessageAt: latestMessage?.createdAt ?? 0,
        lastMessageContent: latestMessage?.content ?? '',
        unreadCount,
        hasReplied
      }

      await indexedDb.putDmConversation(conversation)
    }
  }
}

const instance = DmService.getInstance()
export default instance
