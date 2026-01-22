import { DM_TIME_RANDOMIZATION_SECONDS, ExtendedKind } from '@/constants'
import { TDmConversation, TDmMessage, TEncryptionKeypair } from '@/types'
import { Event } from 'nostr-tools'
import client from './client.service'
import dmRelayService from './dm-relay.service'
import indexedDb from './indexed-db.service'
import storage from './local-storage.service'
import nip17GiftWrapService, { TUnwrappedMessage } from './nip17-gift-wrap.service'

class DmMessageService {
  static instance: DmMessageService

  private subscriptions = new Map<string, () => void>()

  private constructor() {}

  static getInstance(): DmMessageService {
    if (!DmMessageService.instance) {
      DmMessageService.instance = new DmMessageService()
    }
    return DmMessageService.instance
  }

  async fetchMessages(
    accountPubkey: string,
    encryptionKeypair: TEncryptionKeypair,
    since?: number,
    until?: number
  ): Promise<TDmMessage[]> {
    const myDmRelays = await dmRelayService.getDmRelays(accountPubkey)

    const filter: {
      kinds: number[]
      '#p': string[]
      since?: number
      until?: number
    } = {
      kinds: [ExtendedKind.GIFT_WRAP],
      '#p': [encryptionKeypair.pubkey]
    }

    if (since !== undefined) {
      filter.since = since - DM_TIME_RANDOMIZATION_SECONDS
    }
    if (until !== undefined) {
      filter.until = until
    }

    const giftWraps = await client.fetchEvents(myDmRelays, filter)
    const messages: TDmMessage[] = []

    for (const giftWrap of giftWraps) {
      const unwrapped = nip17GiftWrapService.unwrapGiftWrap(giftWrap, encryptionKeypair.privkey)
      if (!unwrapped) continue

      if (since !== undefined && unwrapped.rumor.created_at < since) continue

      const message = this.createMessageFromUnwrapped(accountPubkey, unwrapped, giftWrap)
      if (message) {
        messages.push(message)
        await this.saveMessage(accountPubkey, message)
      }
    }

    // Update conversations after fetching all messages
    await this.rebuildConversationsFromMessages(accountPubkey, messages)

    return messages.sort((a, b) => b.createdAt - a.createdAt)
  }

  async sendMessage(
    accountPubkey: string,
    recipientPubkey: string,
    content: string,
    encryptionKeypair: TEncryptionKeypair
  ): Promise<TDmMessage | null> {
    const recipientEncryptionPubkey = await dmRelayService.getRecipientEncryptionPubkey(recipientPubkey)
    if (!recipientEncryptionPubkey) {
      throw new Error('Recipient does not have encryption key published')
    }

    const recipientDmRelays = await dmRelayService.getDmRelays(recipientPubkey)

    const { giftWrap, rumor } = await nip17GiftWrapService.createGiftWrappedMessage(
      content,
      encryptionKeypair.privkey,
      accountPubkey,
      recipientPubkey,
      recipientEncryptionPubkey
    )

    await client.publishEvent(recipientDmRelays, giftWrap)

    const selfGiftWrap = await nip17GiftWrapService.createGiftWrapForSelf(
      rumor,
      encryptionKeypair.privkey,
      encryptionKeypair.pubkey
    )

    const myDmRelays = await dmRelayService.getDmRelays(accountPubkey)
    await client.publishEvent(myDmRelays, selfGiftWrap)

    const conversationKey = this.getConversationKey(accountPubkey, recipientPubkey)
    const message: TDmMessage = {
      id: rumor.id,
      conversationKey,
      senderPubkey: accountPubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      originalEvent: selfGiftWrap,
      decryptedRumor: rumor as unknown as Event
    }

    await this.saveMessage(accountPubkey, message)
    await this.updateConversation(accountPubkey, recipientPubkey, message)

    return message
  }

  subscribeToMessages(
    accountPubkey: string,
    encryptionKeypair: TEncryptionKeypair,
    onMessage: (message: TDmMessage) => void
  ): () => void {
    const subscriptionKey = `dm:${accountPubkey}`

    if (this.subscriptions.has(subscriptionKey)) {
      const existingClose = this.subscriptions.get(subscriptionKey)!
      existingClose()
    }

    const subscribe = async () => {
      const myDmRelays = await dmRelayService.getDmRelays(accountPubkey)

      const sub = client.subscribe(
        myDmRelays,
        {
          kinds: [ExtendedKind.GIFT_WRAP],
          '#p': [encryptionKeypair.pubkey]
        },
        {
          onevent: async (giftWrap) => {
            const unwrapped = nip17GiftWrapService.unwrapGiftWrap(giftWrap, encryptionKeypair.privkey)
            if (!unwrapped) return

            const message = this.createMessageFromUnwrapped(accountPubkey, unwrapped, giftWrap)
            if (message) {
              await this.saveMessage(accountPubkey, message)

              const otherPubkey =
                unwrapped.senderPubkey === accountPubkey
                  ? unwrapped.rumor.tags.find((t) => t[0] === 'p')?.[1]
                  : unwrapped.senderPubkey
              if (otherPubkey) {
                await this.updateConversation(accountPubkey, otherPubkey, message)
              }

              onMessage(message)
            }
          }
        }
      )

      this.subscriptions.set(subscriptionKey, () => sub.close())
      return () => sub.close()
    }

    subscribe()

    return () => {
      const closeHandler = this.subscriptions.get(subscriptionKey)
      if (closeHandler) {
        closeHandler()
        this.subscriptions.delete(subscriptionKey)
      }
    }
  }

  async getConversations(accountPubkey: string): Promise<TDmConversation[]> {
    return indexedDb.getAllDmConversations(accountPubkey)
  }

  async getConversation(accountPubkey: string, otherPubkey: string): Promise<TDmConversation | null> {
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
    if (conversation) {
      await indexedDb.putDmConversation({
        ...conversation,
        unreadCount: 0
      })
    }
  }

  getConversationKey(accountPubkey: string, otherPubkey: string): string {
    const sorted = [accountPubkey, otherPubkey].sort()
    return `${sorted[0]}:${sorted[1]}`
  }

  private createMessageFromUnwrapped(
    accountPubkey: string,
    unwrapped: TUnwrappedMessage,
    giftWrap: Event
  ): TDmMessage | null {
    const { rumor, senderPubkey } = unwrapped

    if (rumor.kind !== ExtendedKind.RUMOR_CHAT && rumor.kind !== ExtendedKind.RUMOR_FILE) {
      return null
    }

    const recipientPubkey = rumor.tags.find((t) => t[0] === 'p')?.[1]
    if (!recipientPubkey) return null

    const otherPubkey = senderPubkey === accountPubkey ? recipientPubkey : senderPubkey
    const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)

    return {
      id: rumor.id,
      conversationKey,
      senderPubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      originalEvent: giftWrap,
      decryptedRumor: rumor as unknown as Event
    }
  }

  private async saveMessage(_accountPubkey: string, message: TDmMessage): Promise<void> {
    await indexedDb.putDmMessage(message)
  }

  private async updateConversation(
    accountPubkey: string,
    otherPubkey: string,
    message: TDmMessage
  ): Promise<void> {
    const conversationKey = this.getConversationKey(accountPubkey, otherPubkey)
    const existing = await indexedDb.getDmConversation(conversationKey)

    const lastReadTime = storage.getLastReadDmTime(accountPubkey, otherPubkey)
    const isUnread = message.senderPubkey !== accountPubkey && message.createdAt > lastReadTime

    const conversation: TDmConversation = {
      key: conversationKey,
      pubkey: otherPubkey,
      lastMessageAt: Math.max(existing?.lastMessageAt ?? 0, message.createdAt),
      lastMessageContent: message.createdAt >= (existing?.lastMessageAt ?? 0) ? message.content : existing?.lastMessageContent ?? '',
      unreadCount: (existing?.unreadCount ?? 0) + (isUnread ? 1 : 0)
    }

    await indexedDb.putDmConversation(conversation)
  }

  clearSubscriptions(): void {
    for (const closeHandler of this.subscriptions.values()) {
      closeHandler()
    }
    this.subscriptions.clear()
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

      const conversation: TDmConversation = {
        key: conversationKey,
        pubkey: otherPubkey,
        lastMessageAt: latestMessage?.createdAt ?? 0,
        lastMessageContent: latestMessage?.content ?? '',
        unreadCount
      }

      await indexedDb.putDmConversation(conversation)
    }
  }
}

const instance = DmMessageService.getInstance()
export default instance
