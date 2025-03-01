export const StorageKey = {
  THEME_SETTING: 'themeSetting',
  RELAY_SETS: 'relaySets',
  ACTIVE_RELAY_SET_ID: 'activeRelaySetId',
  FEED_TYPE: 'feedType',
  ACCOUNTS: 'accounts',
  CURRENT_ACCOUNT: 'currentAccount',
  ADD_CLIENT_TAG: 'addClientTag',
  NOTE_LIST_MODE: 'noteListMode',
  NOTIFICATION_TYPE: 'notificationType',
  DEFAULT_ZAP_SATS: 'defaultZapSats',
  DEFAULT_ZAP_COMMENT: 'defaultZapComment',
  QUICK_ZAP: 'quickZap',
  LAST_READ_NOTIFICATION_TIME_MAP: 'lastReadNotificationTimeMap',
  ACCOUNT_RELAY_LIST_EVENT_MAP: 'accountRelayListEventMap', // deprecated
  ACCOUNT_FOLLOW_LIST_EVENT_MAP: 'accountFollowListEventMap', // deprecated
  ACCOUNT_MUTE_LIST_EVENT_MAP: 'accountMuteListEventMap', // deprecated
  ACCOUNT_MUTE_DECRYPTED_TAGS_MAP: 'accountMuteDecryptedTagsMap', // deprecated
  ACCOUNT_PROFILE_EVENT_MAP: 'accountProfileEventMap' // deprecated
}

export const BIG_RELAY_URLS = [
  'wss://relay.damus.io/',
  'wss://nos.lol/',
  'wss://relay.nostr.band/',
  'wss://nostr.mom/'
]

export const SEARCHABLE_RELAY_URLS = ['wss://relay.nostr.band/', 'wss://search.nos.today/']

export const PICTURE_EVENT_KIND = 20
export const COMMENT_EVENT_KIND = 1111
export const GROUP_METADATA_EVENT_KIND = 39000

export const URL_REGEX = /https?:\/\/[\w\p{L}\p{N}\p{M}&.-/?=#\-@%+_,:!~*]+/gu
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export const MONITOR = '9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923'
export const MONITOR_RELAYS = ['wss://relay.nostr.watch/']

export const CODY_PUBKEY = '8125b911ed0e94dbe3008a0be48cfe5cd0c0b05923cfff917ae7e87da8400883'
