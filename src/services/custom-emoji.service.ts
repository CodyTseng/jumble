import { BoundedMap } from '@/lib/bounded-map'
import { getReplaceableCoordinateFromEvent } from '@/lib/event'
import { getEmojiPackInfoFromEvent, getEmojisAndEmojiSetsFromEvent } from '@/lib/event-metadata'
import client from '@/services/client.service'
import recentEmojiService from '@/services/recent-emoji.service'
import { TEmoji, TEmojiPack } from '@/types'
import { sha256 } from '@noble/hashes/sha2'
import FlexSearch from 'flexsearch'
import { atom, getDefaultStore } from 'jotai'
import { Event } from 'nostr-tools'

export type TCustomEmojiCollections = {
  standalone: TEmoji[]
  packs: TEmojiPack[]
  version: number
}

export const customEmojiCollectionsAtom = atom<TCustomEmojiCollections>({
  standalone: [],
  packs: [],
  version: 0
})

class CustomEmojiService {
  static instance: CustomEmojiService

  private emojiMap = new BoundedMap<string, TEmoji>({ maxSize: 10_000 })
  private emojiIndex = new FlexSearch.Index({ tokenize: 'full' })
  private standaloneEmojis: TEmoji[] = []
  private packs: TEmojiPack[] = []
  private version = 0

  constructor() {
    if (!CustomEmojiService.instance) {
      CustomEmojiService.instance = this
    }
    return CustomEmojiService.instance
  }

  async init(userEmojiListEvent: Event | null) {
    this.emojiMap = new BoundedMap<string, TEmoji>({ maxSize: 10_000 })
    this.emojiIndex = new FlexSearch.Index({ tokenize: 'full' })
    this.standaloneEmojis = []
    this.packs = []

    if (!userEmojiListEvent) {
      this.publishCollections()
      return
    }

    const { emojis, emojiSetPointers } = getEmojisAndEmojiSetsFromEvent(userEmojiListEvent)
    this.standaloneEmojis = emojis
    await this.addEmojisToIndex(emojis)

    const emojiSetEvents = await client.fetchEmojiSetEvents(emojiSetPointers, false)
    const packs: TEmojiPack[] = []
    await Promise.allSettled(
      emojiSetEvents.map(async (event) => {
        if (!event || event instanceof Error) return
        const { title, emojis: packEmojis } = getEmojiPackInfoFromEvent(event)
        if (packEmojis.length === 0) return
        const setAddress = getReplaceableCoordinateFromEvent(event)
        const emojisWithSet = packEmojis.map((emoji) => ({ ...emoji, setAddress }))
        packs.push({
          id: setAddress,
          title,
          author: event.pubkey,
          emojis: emojisWithSet
        })
        await this.addEmojisToIndex(emojisWithSet)
      })
    )
    // Preserve a-tag order from the user's kind 10030 event
    const orderIndex = new Map(emojiSetPointers.map((p, i) => [p, i]))
    packs.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
    this.packs = packs

    this.publishCollections()
  }

  async searchEmojis(query: string): Promise<TEmoji[]> {
    const trimmed = query.trim()
    if (!trimmed) {
      const seen = new Set<string>()
      const result: TEmoji[] = []
      for (const entry of recentEmojiService.getRecent()) {
        if (typeof entry === 'string') continue
        const id = this.getEmojiId(entry)
        if (!this.emojiMap.has(id) || seen.has(id)) continue
        seen.add(id)
        result.push(entry)
      }
      for (const [id, emoji] of this.emojiMap) {
        if (seen.has(id)) continue
        seen.add(id)
        result.push(emoji)
      }
      return result
    }
    const ids = await this.emojiIndex.searchAsync(trimmed)
    return ids
      .map((id) => this.emojiMap.get(id as string))
      .filter((e): e is TEmoji => Boolean(e))
  }

  getEmojiById(id?: string): TEmoji | undefined {
    if (!id) return undefined
    return this.emojiMap.get(id)
  }

  registerExternalEmoji(emoji: TEmoji) {
    const id = this.getEmojiId(emoji)
    if (this.emojiMap.has(id)) return
    this.emojiMap.set(id, emoji)
  }

  getEmojiId(emoji: TEmoji): string {
    const data = new TextEncoder().encode(`${emoji.shortcode}:${emoji.url}`.toLowerCase())
    const hash = sha256(data)
    return Array.from(hash)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  getStandaloneEmojis(): TEmoji[] {
    return this.standaloneEmojis
  }

  getEmojiPacks(): TEmojiPack[] {
    return this.packs
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

  private publishCollections() {
    this.version += 1
    getDefaultStore().set(customEmojiCollectionsAtom, {
      standalone: this.standaloneEmojis,
      packs: this.packs,
      version: this.version
    })
  }
}

const instance = new CustomEmojiService()
export default instance
