import { getEmojisAndEmojiSetsFromEvent, getEmojisFromEvent } from '@/lib/event-metadata'
import client from '@/services/client.service'
import { TEmoji } from '@/types'
import FlexSearch from 'flexsearch'
import { Event } from 'nostr-tools'

class CustomEmojiService {
  static instance: CustomEmojiService

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

  async searchEmojis(query: string): Promise<TEmoji[]> {
    const results = await this.emojiIndex.searchAsync(query, { limit: 100 })
    const emojis: TEmoji[] = []
    for (const result of results) {
      if (typeof result !== 'string') continue
      const [shortcode, url] = result.split(':')
      if (!shortcode || !url) continue
      emojis.push({ shortcode, url })
    }
    return emojis
  }

  private async addEmojisToIndex(emojis: TEmoji[]) {
    await Promise.allSettled(
      emojis.map((emoji) =>
        this.emojiIndex.addAsync(`:${emoji.shortcode}:${emoji.url}:`, emoji.shortcode)
      )
    )
  }
}

const instance = new CustomEmojiService()
export default instance
