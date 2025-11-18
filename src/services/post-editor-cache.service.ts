import { TPollCreateData } from '@/types'
import { Content } from '@tiptap/react'
import { Event } from 'nostr-tools'

type TPostSettings = {
  isNsfw?: boolean
  isPoll?: boolean
  pollCreateData?: TPollCreateData
  addClientTag?: boolean
}

class PostEditorCacheService {
  static instance: PostEditorCacheService

  private postContentCache: Map<string, Content> = new Map()
  private postSettingsCache: Map<string, TPostSettings> = new Map()

  constructor() {
    if (!PostEditorCacheService.instance) {
      PostEditorCacheService.instance = this
    }
    return PostEditorCacheService.instance
  }

  getPostContentCache({
    defaultContent,
    parentStuff
  }: { defaultContent?: string; parentStuff?: Event | string } = {}) {
    return (
      this.postContentCache.get(this.generateCacheKey(defaultContent, parentStuff)) ??
      defaultContent
    )
  }

  setPostContentCache(
    { defaultContent, parentStuff }: { defaultContent?: string; parentStuff?: Event | string },
    content: Content
  ) {
    this.postContentCache.set(this.generateCacheKey(defaultContent, parentStuff), content)
  }

  getPostSettingsCache({
    defaultContent,
    parentStuff
  }: { defaultContent?: string; parentStuff?: Event | string } = {}): TPostSettings | undefined {
    return this.postSettingsCache.get(this.generateCacheKey(defaultContent, parentStuff))
  }

  setPostSettingsCache(
    { defaultContent, parentStuff }: { defaultContent?: string; parentStuff?: Event | string },
    settings: TPostSettings
  ) {
    this.postSettingsCache.set(this.generateCacheKey(defaultContent, parentStuff), settings)
  }

  clearPostCache({
    defaultContent,
    parentStuff
  }: {
    defaultContent?: string
    parentStuff?: Event | string
  }) {
    const cacheKey = this.generateCacheKey(defaultContent, parentStuff)
    this.postContentCache.delete(cacheKey)
    this.postSettingsCache.delete(cacheKey)
  }

  generateCacheKey(defaultContent: string = '', parentStuff?: Event | string): string {
    return parentStuff
      ? typeof parentStuff === 'string'
        ? parentStuff
        : parentStuff.id
      : defaultContent
  }
}

const instance = new PostEditorCacheService()
export default instance
