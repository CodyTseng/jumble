import { Event } from 'nostr-tools'
import { TEmoji, TPollCreateData, TPostTargetItem } from '.'

export type TPostDraftStatus = 'draft' | 'pending' | 'failed'

export type TPostDraftBase = {
  id: string
  pubkey: string
  createdAt: number
  updatedAt: number
}

export type TPostDraftUnsigned = TPostDraftBase & {
  status: 'draft'
  tiptapJson: unknown
  previewEvent?: Event
  text: string
  mentions: string[]
  isNsfw: boolean
  isPoll: boolean
  pollCreateData: TPollCreateData
  addClientTag: boolean
  isAnonymous?: boolean
  isProtectedEvent: boolean
  additionalRelayUrls: string[]
  postTargetItems?: TPostTargetItem[]
  minPow: number
  parentEvent?: Event
  parentEventCoordinate?: string
  defaultContent?: string
  highlightedText?: string
  openFrom?: string[]
  imetaTags: Record<string, string[]>
  customEmojis: Record<string, TEmoji>
}

export type TPostDraftSigned = TPostDraftBase & {
  status: 'pending' | 'failed'
  signedEvent: Event
  targetRelays: string[]
  parentEvent?: Event
  parentEventCoordinate?: string
  highlightedText?: string
  error?: string
  failedAt?: number
}

export type TPostDraft = TPostDraftUnsigned | TPostDraftSigned
