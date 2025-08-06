import { getEmojisAndEmojiSetsFromEvent, getEmojisFromEvent } from '@/lib/event-metadata'
import client from '@/services/client.service'
import { TEmoji } from '@/types'
import { Event } from 'nostr-tools'

class CustomEmojiService {
  static instance: CustomEmojiService

  private emojis: TEmoji[] = []

  constructor() {
    if (!CustomEmojiService.instance) {
      CustomEmojiService.instance = this
    }
    return CustomEmojiService.instance
  }

  async init(userEmojiListEvent: Event | null) {
    if (!userEmojiListEvent) return

    const { emojis, emojiSetPointers } = getEmojisAndEmojiSetsFromEvent(userEmojiListEvent)
    this.emojis = emojis

    const emojiSetEvents = await client.fetchEmojiSetEvents(emojiSetPointers)
    emojiSetEvents.forEach((event) => {
      if (!event || event instanceof Error) return

      getEmojisFromEvent(event).forEach((emoji) => {
        this.emojis.push(emoji)
      })
    })

    console.log('CustomEmojiService initialized with emojis:', this.emojis)
  }
}

const instance = new CustomEmojiService()
export default instance
