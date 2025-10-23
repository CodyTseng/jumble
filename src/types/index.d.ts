import { Event, Filter, VerifiedEvent } from 'nostr-tools'
import { MEDIA_AUTO_LOAD_POLICY, NOTIFICATION_LIST_STYLE, POLL_TYPE } from '../constants'

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
}

export interface ISigner {
  getPublicKey: () => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<VerifiedEvent>
  nip04Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip04Decrypt: (pubkey: string, cipherText: string) => Promise<string>
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

export type TFeedType = 'following' | 'relays' | 'relay'
export type TFeedInfo = { feedType: TFeedType; id?: string }

export type TLanguage = 'en' | 'zh' | 'pl'

export type TImetaInfo = {
  url: string
  blurHash?: string
  dim?: { width: number; height: number }
  pubkey?: string
}

export type TPublishOptions = {
  specifiedRelayUrls?: string[]
  additionalRelayUrls?: string[]
  minPow?: number
}

export type TNoteListMode = 'posts' | 'postsAndReplies' | 'you'

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

export type TSearchType = 'profile' | 'profiles' | 'notes' | 'note' | 'hashtag' | 'relay'

export type TSearchParams = {
  type: TSearchType
  search: string
  input?: string
}

export type TNotificationStyle =
  (typeof NOTIFICATION_LIST_STYLE)[keyof typeof NOTIFICATION_LIST_STYLE]

export type TAwesomeRelayCollection = {
  id: string
  name: string
  description: string
  relays: string[]
}

export type TMediaAutoLoadPolicy =
  (typeof MEDIA_AUTO_LOAD_POLICY)[keyof typeof MEDIA_AUTO_LOAD_POLICY]
