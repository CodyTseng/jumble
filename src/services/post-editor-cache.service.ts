import { TPollCreateData } from '@/types'
import { Content } from '@tiptap/react'
import { Event } from 'nostr-tools'

export type ImageAttachment = {
  url: string
  alt?: string
}

type TPostSettings = {
  isNsfw?: boolean
  isPoll?: boolean
  pollCreateData?: TPollCreateData
  addClientTag?: boolean
  images?: ImageAttachment[]
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
    parentEvent
  }: { defaultContent?: string; parentEvent?: Event } = {}) {
    return (
      this.postContentCache.get(this.generateCacheKey(defaultContent, parentEvent)) ??
      defaultContent
    )
  }

  setPostContentCache(
    { defaultContent, parentEvent }: { defaultContent?: string; parentEvent?: Event },
    content: Content
  ) {
    this.postContentCache.set(this.generateCacheKey(defaultContent, parentEvent), content)
  }

  getPostSettingsCache({
    defaultContent,
    parentEvent
  }: { defaultContent?: string; parentEvent?: Event } = {}): TPostSettings | undefined {
    return this.postSettingsCache.get(this.generateCacheKey(defaultContent, parentEvent))
  }

  setPostSettingsCache(
    { defaultContent, parentEvent }: { defaultContent?: string; parentEvent?: Event },
    settings: TPostSettings
  ) {
    this.postSettingsCache.set(this.generateCacheKey(defaultContent, parentEvent), settings)
  }

  clearPostCache({
    defaultContent,
    parentEvent
  }: {
    defaultContent?: string
    parentEvent?: Event
  }) {
    const cacheKey = this.generateCacheKey(defaultContent, parentEvent)
    this.postContentCache.delete(cacheKey)
    this.postSettingsCache.delete(cacheKey)
  }

  generateCacheKey(defaultContent: string = '', parentEvent?: Event): string {
    return parentEvent ? parentEvent.id : defaultContent
  }
}

const instance = new PostEditorCacheService()
export default instance
