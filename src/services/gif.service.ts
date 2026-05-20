import indexedDb from '@/services/indexed-db.service'
import { TGifRecord } from '@/types'
import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { TGif } from './klipy.service'

const RECENT_GIFS_MAX = 50

export const favoriteGifsAtom = atom<TGifRecord[]>([])
export const recentGifsAtom = atom<TGifRecord[]>([])

class GifService {
  static instance: GifService

  private favorites: TGifRecord[] = []
  private recents: TGifRecord[] = []
  private hydrated = false
  private hydratePromise: Promise<void> | null = null

  constructor() {
    if (!GifService.instance) {
      GifService.instance = this
    }
    return GifService.instance
  }

  hydrate(): Promise<void> {
    if (this.hydrated) return Promise.resolve()
    if (this.hydratePromise) return this.hydratePromise
    this.hydratePromise = Promise.all([
      indexedDb.getAllFavoriteGifs(),
      indexedDb.getAllRecentGifs()
    ])
      .then(([favorites, recents]) => {
        this.favorites = favorites
        this.recents = recents
        this.hydrated = true
        this.publish()
      })
      .catch(() => {
        // ignore — picker keeps empty lists
      })
    return this.hydratePromise
  }

  getFavorites(): TGifRecord[] {
    return this.favorites
  }

  getRecents(): TGifRecord[] {
    return this.recents
  }

  isFavorite(id: string): boolean {
    return this.favorites.some((g) => g.id === id)
  }

  async toggleFavorite(gif: TGif): Promise<boolean> {
    await this.hydrate()
    const existing = this.favorites.find((g) => g.id === gif.id)
    if (existing) {
      this.favorites = this.favorites.filter((g) => g.id !== gif.id)
      this.publish()
      await indexedDb.deleteFavoriteGif(gif.id).catch(() => {})
      return false
    }
    const record = this.toRecord(gif)
    this.favorites = [record, ...this.favorites]
    this.publish()
    await indexedDb.putFavoriteGif(record).catch(() => {})
    return true
  }

  async addRecent(gif: TGif): Promise<void> {
    await this.hydrate()
    const record = this.toRecord(gif)
    this.recents = [record, ...this.recents.filter((g) => g.id !== gif.id)].slice(
      0,
      RECENT_GIFS_MAX
    )
    this.publish()
    await indexedDb.putRecentGif(record, RECENT_GIFS_MAX).catch(() => {})
  }

  private toRecord(gif: TGif): TGifRecord {
    return {
      id: gif.id,
      url: gif.url,
      previewUrl: gif.previewUrl,
      width: gif.width,
      height: gif.height,
      description: gif.description,
      addedAt: Date.now()
    }
  }

  private publish() {
    const store = getDefaultStore()
    store.set(favoriteGifsAtom, this.favorites)
    store.set(recentGifsAtom, this.recents)
  }
}

const instance = new GifService()
export default instance

export function useGifCollections() {
  const favorites = useAtomValue(favoriteGifsAtom)
  const recents = useAtomValue(recentGifsAtom)
  return { favorites, recents }
}
