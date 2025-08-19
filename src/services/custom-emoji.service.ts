import { getEmojisAndEmojiSetsFromEvent, getEmojisFromEvent } from '@/lib/event-metadata'
import client from '@/services/client.service'
import { TEmoji } from '@/types'
import { sha256 } from '@noble/hashes/sha2'
import FlexSearch from 'flexsearch'
import { Event } from 'nostr-tools'

class CustomEmojiService {
  static instance: CustomEmojiService

  private emojiMap = new Map<string, TEmoji>()
  private emojiIndex = new FlexSearch.Index({
    tokenize: 'forward'
  })

  constructor() {
    if (!CustomEmojiService.instance) {
      CustomEmojiService.instance = this
    }
    return CustomEmojiService.instance
  }

  async init(userEmojiListEvent: Event | null) {
    if (!userEmojiListEvent) return

    const { emojis, emojiSetPointers } = getEmojisAndEmojiSetsFromEvent(userEmojiListEvent)
    await this.addEmojisToIndex(emojis)

    const emojiSetEvents = await client.fetchEmojiSetEvents(emojiSetPointers)
    await Promise.allSettled(
      emojiSetEvents.map(async (event) => {
        if (!event || event instanceof Error) return

        await this.addEmojisToIndex(getEmojisFromEvent(event))
      })
    )
  }

  async searchEmojis(query: string = '', limit = 20): Promise<string[]> {
    if (!query) {
      return Array.from(this.emojiMap.keys()).slice(0, limit)
    }
    const results = await this.emojiIndex.searchAsync(query, { limit })
    return results.filter((id) => typeof id === 'string') as string[]
  }

  getEmojiById(id?: string): TEmoji | undefined {
    if (!id) return undefined

    return this.emojiMap.get(id)
  }

  private async addEmojisToIndex(emojis: TEmoji[]) {
    await Promise.allSettled(
      emojis.map(async (emoji) => {
        const id = this.getEmojiId(emoji)
        this.emojiMap.set(id, emoji)
        await this.emojiIndex.addAsync(id, emoji.shortcode)
      })
    )
  }

  private getEmojiId(emoji: TEmoji) {
    const encoder = new TextEncoder()
    const data = encoder.encode(`${emoji.shortcode}:${emoji.url}`)
    const hashBuffer = sha256(data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
}

const instance = new CustomEmojiService()
export default instance
