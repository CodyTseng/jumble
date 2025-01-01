import { Event } from 'nostr-tools'

export type TProfile = {
  username: string
  pubkey: string
  banner?: string
  avatar?: string
  nip05?: string
  about?: string
  created_at?: number
}

export type TRelayList = {
  write: string[]
  read: string[]
}

export type TRelayInfo = {
  supported_nips?: number[]
  software?: string
}

export type TWebMetadata = {
  title?: string | null
  description?: string | null
  image?: string | null
}

export type TRelayGroup = {
  groupName: string
  relayUrls: string[]
  isActive: boolean
}

export type TConfig = {
  relayGroups: TRelayGroup[]
  theme: TThemeSetting
}

export type TThemeSetting = 'light' | 'dark' | 'system'
export type TTheme = 'light' | 'dark'

export type TDraftEvent = Pick<Event, 'content' | 'created_at' | 'kind' | 'tags'>

export type TNip07 = {
  getPublicKey: () => Promise<string | null>
  signEvent: (draftEvent: TDraftEvent) => Promise<Event | null>
}

export interface ISigner {
  getPublicKey: () => Promise<string | null>
  signEvent: (draftEvent: TDraftEvent) => Promise<Event | null>
}

export type TSignerType = 'nsec' | 'nip-07' | 'bunker' | 'browser-nsec'

export type TAccount = {
  pubkey: string
  signerType: TSignerType
  nsec?: string
  bunker?: string
  bunkerClientSecretKey?: string
}

export type TAccountPointer = Pick<TAccount, 'pubkey' | 'signerType'>

export type TFeedType = 'following' | 'relays'

export type TLanguage = 'en' | 'zh'
