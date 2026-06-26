import { Event, Filter, VerifiedEvent } from 'nostr-tools'
import {
  MEDIA_AUTO_LOAD_POLICY,
  NOTIFICATION_LIST_STYLE,
  NSFW_DISPLAY_POLICY,
  POLL_TYPE,
  PROFILE_PICTURE_AUTO_LOAD_POLICY
} from '../constants'

export type TSubRequestFilter = Omit<Filter, 'since' | 'until'> & { limit: number }

export type TFeedSubRequest = {
  urls: string[]
  filter: Omit<Filter, 'since' | 'until'>
}

export type TProfile = {
  username: string
  pubkey: string
  npub: string
  original_username?: string
  banner?: string
  avatar?: string
  nip05?: string
  about?: string
  website?: string
  lud06?: string
  lud16?: string
  lightningAddress?: string
  sp?: string
  created_at?: number
  emojis?: TEmoji[]
}
export type TMailboxRelayScope = 'read' | 'write' | 'both'
export type TMailboxRelay = {
  url: string
  scope: TMailboxRelayScope
}
export type TRelayList = {
  write: string[]
  read: string[]
  originalRelays: TMailboxRelay[]
}

export type TRelayInfo = {
  url: string
  shortUrl: string
  name?: string
  description?: string
  icon?: string
  pubkey?: string
  contact?: string
  supported_nips?: number[]
  software?: string
  version?: string
  tags?: string[]
  payments_url?: string
  limitation?: {
    auth_required?: boolean
    payment_required?: boolean
  }
}

export type TWebMetadata = {
  title?: string | null
  description?: string | null
  image?: string | null
}

export type TRelaySet = {
  id: string
  aTag: string[]
  name: string
  relayUrls: string[]
}

export type TConfig = {
  relayGroups: TRelaySet[]
  theme: TThemeSetting
}

export type TThemeSetting = 'light' | 'dark' | 'system' | 'pure-black'
export type TTheme = 'light' | 'dark' | 'pure-black'

export type TDraftEvent = Pick<Event, 'content' | 'created_at' | 'kind' | 'tags'>

export type TNip07 = {
  getPublicKey: () => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<VerifiedEvent>
  nip04?: {
    encrypt?: (pubkey: string, plainText: string) => Promise<string>
    decrypt?: (pubkey: string, cipherText: string) => Promise<string>
  }
  nip44?: {
    encrypt?: (pubkey: string, plainText: string) => Promise<string>
    decrypt?: (pubkey: string, cipherText: string) => Promise<string>
  }
}

export interface ISigner {
  getPublicKey: () => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<VerifiedEvent>
  nip04Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip04Decrypt: (pubkey: string, cipherText: string) => Promise<string>
  nip44Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip44Decrypt: (pubkey: string, cipherText: string) => Promise<string>
}

export type TSignerType = 'nsec' | 'nip-07' | 'bunker' | 'browser-nsec' | 'ncryptsec' | 'npub'

export type TAccount = {
  pubkey: string
  signerType: TSignerType
  ncryptsec?: string
  nsec?: string
  bunker?: string
  bunkerClientSecretKey?: string
  npub?: string
  // Central server URL when the account was created via "Login with Google"
  // (pomegranate). Its presence marks the account as a pomegranate account.
  pomegranateCentral?: string
}

export type TAccountPointer = Pick<TAccount, 'pubkey' | 'signerType'>

export type TFeedType = 'following' | 'pinned' | 'relays' | 'relay'
export type TFeedInfo = { feedType: TFeedType; id?: string; name?: string } | null

export type TLanguage = 'en' | 'zh' | 'pl'

export type TImetaInfo = {
  url: string
  blurHash?: string
  thumbHash?: Uint8Array
  dim?: { width: number; height: number }
  pubkey?: string
}

export type TPublishOptions = {
  specifiedRelayUrls?: string[]
  additionalRelayUrls?: string[]
  minPow?: number
}

export type TPostTargetItem =
  | { type: 'optimalRelays' }
  | { type: 'relay'; url: string }
  | { type: 'relaySet'; id: string; urls: string[] }

export type TNoteListMode = 'posts' | 'postsAndReplies' | 'you' | '24h' | 'articles'

export type TFeedTabBuiltin = 'posts' | 'postsAndReplies' | '24h' | 'articles'

export type TFeedTabConfig = {
  id: string
  label: string
  hidden?: boolean
  kinds?: number[]
  hideReplies?: boolean
  hideFollowed?: boolean
  builtin?: TFeedTabBuiltin
}

export type TNotificationType = 'all' | 'mentions' | 'reactions' | 'zaps'

export type TPageRef = { scrollToTop: (behavior?: ScrollBehavior) => void }

export type TEmoji = {
  shortcode: string
  url: string
  // Address pointer (kind:pubkey:d-tag) to the kind 30030 emoji set this emoji belongs to, if any
  setAddress?: string
}

export type TEmojiPack = {
  id: string
  title?: string
  author: string
  emojis: TEmoji[]
}

export type TSkinTone = 0 | 1 | 2 | 3 | 4 | 5

export type TTranslationAccount = {
  pubkey: string
  api_key: string
  balance: number
}

export type TTranslationServiceConfig =
  | {
      service: 'jumble'
    }
  | {
      service: 'libre_translate'
      server?: string
      api_key?: string
    }

export type TMediaUploadServiceConfig =
  | {
      type: 'nip96'
      service: string
    }
  | {
      type: 'blossom'
    }

export type TPollType = (typeof POLL_TYPE)[keyof typeof POLL_TYPE]

export type TPollCreateData = {
  isMultipleChoice: boolean
  options: string[]
  relays: string[]
  endsAt?: number
}

export type TSearchType =
  | 'profile'
  | 'profiles'
  | 'notes'
  | 'note'
  | 'hashtag'
  | 'relay'
  | 'externalContent'
  | 'nak'

export type TSearchParams =
  | {
      type: Exclude<TSearchType, 'nak'>
      search: string
      input?: string
    }
  | {
      type: 'nak'
      search: string
      request: TFeedSubRequest
      input?: string
    }

export type TNotificationStyle =
  (typeof NOTIFICATION_LIST_STYLE)[keyof typeof NOTIFICATION_LIST_STYLE]

export type TAwesomeRelayCollection = {
  id: string
  name: string
  relays: string[]
}

export type TMediaAutoLoadPolicy =
  (typeof MEDIA_AUTO_LOAD_POLICY)[keyof typeof MEDIA_AUTO_LOAD_POLICY]

export type TProfilePictureAutoLoadPolicy =
  (typeof PROFILE_PICTURE_AUTO_LOAD_POLICY)[keyof typeof PROFILE_PICTURE_AUTO_LOAD_POLICY]

export type TNsfwDisplayPolicy = (typeof NSFW_DISPLAY_POLICY)[keyof typeof NSFW_DISPLAY_POLICY]

export type TDmConversation = {
  key: string
  pubkey: string
  lastMessageAt: number
  lastMessageRumor?: Event
  unreadCount: number
  hasReplied: boolean
  encryptionPubkey?: string
  deleted?: boolean
  deletedAt?: number
}

export type TDmMessage = {
  id: string
  participantsKey: string
  senderPubkey: string
  content: string
  createdAt: number
  originalEvent: Event
  decryptedRumor: Event
  replyTo?: {
    id: string
    content: string
    senderPubkey: string
    tags?: string[][]
  }
  // Sender-identity verification result captured at ingestion time.
  // true      — seal.pubkey matched rumor.pubkey's current Kind 10044 'n' tag
  // false     — mismatch, or Kind 10044 could not be retrieved
  // undefined — message was ingested before this check existed, or imported from a JSONL dump
  verified?: boolean
}

export type TEncryptionKeypair = {
  privkey: Uint8Array
  pubkey: string
}

// Outcome of reconciling the local DM encryption key against the account's
// currently announced one. 'adopted' = this browser already holds the announced
// key (e.g. another tab rotated it) and it is now in use; 'needs_sync' = a
// different device rotated the key, the stale local key was retired, and a resync
// from another device is required.
export type TEncryptionKeyReconcileResult = 'adopted' | 'needs_sync'

export type TGifRecord = {
  id: string
  url: string
  width: number
  height: number
  description: string
  addedAt: number
}
