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
  nip44Encrypt?: (privkey: Uint8Array, pubkey: string, plainText: string) => Promise<string>
  nip44Decrypt?: (privkey: Uint8Array, pubkey: string, cipherText: string) => Promise<string>
  /** NIP-44 encrypt using the signer's own key (for seal creation) */
  nip44SignerEncrypt?: (pubkey: string, plainText: string) => Promise<string>
  /** NIP-44 decrypt using the signer's own key (for seal decryption) */
  nip44SignerDecrypt?: (pubkey: string, cipherText: string) => Promise<string>
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

export type TNoteListMode = 'posts' | 'postsAndReplies' | 'you' | '24h'

export type TNotificationType = 'all' | 'mentions' | 'reactions' | 'zaps'

export type TPageRef = { scrollToTop: (behavior?: ScrollBehavior) => void }

export type TEmoji = {
  shortcode: string
  url: string
}

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
  lastMessageContent: string
  unreadCount: number
}

export type TDmMessage = {
  id: string
  conversationKey: string
  senderPubkey: string
  content: string
  createdAt: number
  originalEvent: Event
  decryptedRumor: Event
}

export type TEncryptionKeypair = {
  privkey: Uint8Array
  pubkey: string
}
