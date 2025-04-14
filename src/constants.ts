export const StorageKey = {
  VERSION: 'version',
  THEME_SETTING: 'themeSetting',
  RELAY_SETS: 'relaySets',
  ACCOUNTS: 'accounts',
  CURRENT_ACCOUNT: 'currentAccount',
  ADD_CLIENT_TAG: 'addClientTag',
  NOTE_LIST_MODE: 'noteListMode',
  NOTIFICATION_TYPE: 'notificationType',
  DEFAULT_ZAP_SATS: 'defaultZapSats',
  DEFAULT_ZAP_COMMENT: 'defaultZapComment',
  QUICK_ZAP: 'quickZap',
  LAST_READ_NOTIFICATION_TIME_MAP: 'lastReadNotificationTimeMap',
  ACCOUNT_FEED_INFO_MAP: 'accountFeedInfoMap',
  MEDIA_UPLOAD_SERVICE: 'mediaUploadService',
  ACCOUNT_RELAY_LIST_EVENT_MAP: 'accountRelayListEventMap', // deprecated
  ACCOUNT_FOLLOW_LIST_EVENT_MAP: 'accountFollowListEventMap', // deprecated
  ACCOUNT_MUTE_LIST_EVENT_MAP: 'accountMuteListEventMap', // deprecated
  ACCOUNT_MUTE_DECRYPTED_TAGS_MAP: 'accountMuteDecryptedTagsMap', // deprecated
  ACCOUNT_PROFILE_EVENT_MAP: 'accountProfileEventMap', // deprecated
  ACTIVE_RELAY_SET_ID: 'activeRelaySetId', // deprecated
  FEED_TYPE: 'feedType' // deprecated
}

export const BIG_RELAY_URLS = [
  'wss://relay.damus.io/',
  'wss://nos.lol/',
  'wss://relay.nostr.band/',
  'wss://nostr.mom/'
]

export const SEARCHABLE_RELAY_URLS = ['wss://relay.nostr.band/', 'wss://search.nos.today/']

export const GROUP_METADATA_EVENT_KIND = 39000

export const ExtendedKind = {
  PICTURE: 20,
  FAVORITE_RELAYS: 10012,
  COMMENT: 1111,
  GROUP_METADATA: 39000
}

export const URL_REGEX = /https?:\/\/[\w\p{L}\p{N}\p{M}&.-/?=#\-@%+_:!~*]+/gu
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export const MONITOR = '9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923'
export const MONITOR_RELAYS = ['wss://relay.nostr.watch/']

export const CODY_PUBKEY = '8125b911ed0e94dbe3008a0be48cfe5cd0c0b05923cfff917ae7e87da8400883'

export const DEFAULT_FAVORITE_RELAYS = [
  'wss://nostr.wine/',
  'wss://pyramid.fiatjaf.com/',
  'wss://140.f7z.io/',
  'wss://news.utxo.one/',
  'wss://algo.utxo.one'
]

export const NIP_96_SERVICE = [
  'https://mockingyou.com',
  'https://nostpic.com',
  'https://nostr.build', // default
  'https://nostrcheck.me',
  'https://nostrmedia.com',
  'https://files.sovbit.host'
]
export const DEFAULT_NIP_96_SERVICE = 'https://nostr.build'
