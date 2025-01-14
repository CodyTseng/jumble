export const StorageKey = {
  THEME_SETTING: 'themeSetting',
  RELAY_SETS: 'relaySets',
  ACTIVE_RELAY_SET_ID: 'activeRelaySetId',
  FEED_TYPE: 'feedType',
  ACCOUNTS: 'accounts',
  CURRENT_ACCOUNT: 'currentAccount',
  ACCOUNT_RELAY_LIST_EVENT_MAP: 'accountRelayListEventMap',
  ACCOUNT_FOLLOW_LIST_EVENT_MAP: 'accountFollowListEventMap',
  ACCOUNT_PROFILE_EVENT_MAP: 'accountProfileEventMap',
  ADD_CLIENT_TAG: 'addClientTag'
}

export const BIG_RELAY_URLS = [
  'wss://relay.damus.io/',
  'wss://nos.lol/',
  'wss://relay.nostr.band/',
  'wss://relay.noswhere.com/'
]

export const SEARCHABLE_RELAY_URLS = ['wss://relay.nostr.band/', 'wss://search.nos.today/']

export const PICTURE_EVENT_KIND = 20
export const COMMENT_EVENT_KIND = 1111

export const URL_REGEX = /(https?:\/\/[^\s"']+)/g
