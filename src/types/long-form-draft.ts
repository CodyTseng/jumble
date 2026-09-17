import { TPostTargetItem } from '.'

export type TLongFormDraft = {
  identifier: string
  title: string
  summary: string
  image: string
  tags: string[]
  content: string
  createdAt: number
  updatedAt: number
  publishedAt?: number
  originalTags?: string[][]
  originalContent?: string
  sourceEventId?: string
  addClientTag?: boolean
  isNsfw?: boolean
  isProtectedEvent?: boolean
  minPow?: number
  mentions?: string[]
  mentionSelections?: Record<string, boolean>
  removedMentionPubkeys?: string[]
  additionalRelayUrls?: string[]
  postTargetItems?: TPostTargetItem[]
}
