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
  AUTOPLAY: 'autoplay',
  HIDE_UNTRUSTED_INTERACTIONS: 'hideUntrustedInteractions',
  HIDE_UNTRUSTED_NOTIFICATIONS: 'hideUntrustedNotifications',
  HIDE_UNTRUSTED_EVENTS: 'hideUntrustedEvents', // deprecated
  ACCOUNT_RELAY_LIST_EVENT_MAP: 'accountRelayListEventMap', // deprecated
  ACCOUNT_FOLLOW_LIST_EVENT_MAP: 'accountFollowListEventMap', // deprecated
  ACCOUNT_MUTE_LIST_EVENT_MAP: 'accountMuteListEventMap', // deprecated
  ACCOUNT_MUTE_DECRYPTED_TAGS_MAP: 'accountMuteDecryptedTagsMap', // deprecated
  ACCOUNT_PROFILE_EVENT_MAP: 'accountProfileEventMap', // deprecated
  ACTIVE_RELAY_SET_ID: 'activeRelaySetId', // deprecated
  FEED_TYPE: 'feedType' // deprecated
}

export const ApplicationDataKey = {
  NOTIFICATIONS_SEEN_AT: 'seen_notifications_at'
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

export const URL_REGEX =
  /https?:\/\/[\w\p{L}\p{N}\p{M}&.-/?=#\-@%+_:!~*]+(?<![.,;:'")\]}!?，。；：""''！？】）])/gu
export const WS_URL_REGEX =
  /wss?:\/\/[\w\p{L}\p{N}\p{M}&.-/?=#\-@%+_:!~*]+(?<![.,;:'")\]}!?，。；：""''！？】）])/gu
export const IMAGE_REGEX =
  /https?:\/\/[\w\p{L}\p{N}\p{M}&.-]+\/(?:[^/\s?]*\/)*([^/\s?]*\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic|svg|avif))(?!\w)(?:\?[\w\p{L}\p{N}\p{M}&=.-]*)?(?<![.,;:'")\]}!?，。；：""''！？】）])/giu
export const VIDEO_REGEX =
  /https?:\/\/[\w\p{L}\p{N}\p{M}&.-]+\/(?:[^/\s?]*\/)*([^/\s?]*\.(mp4|webm|ogg|mov))(?!\w)(?:\?[\w\p{L}\p{N}\p{M}&=.-]*)?(?<![.,;:'")\]}!?，。；：""''！？】）])/giu
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export const EMOJI_SHORT_CODE_REGEX = /:[a-zA-Z0-9_-]+:/g
export const EMBEDDED_EVENT_REGEX = /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/g
export const EMBEDDED_MENTION_REGEX = /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+)/g
export const HASHTAG_REGEX = /#[\p{L}\p{N}\p{M}_]+/gu
export const LN_INVOICE_REGEX = /(ln(?:bc|tb|bcrt))([0-9]+[munp]?)?1([02-9ac-hj-np-z]+)/g

export const MONITOR = '9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923'
export const MONITOR_RELAYS = ['wss://relay.nostr.watch/']

export const CODY_PUBKEY = '8125b911ed0e94dbe3008a0be48cfe5cd0c0b05923cfff917ae7e87da8400883'

export const DEFAULT_FAVORITE_RELAYS = [
  'wss://nostr.wine/',
  'wss://pyramid.fiatjaf.com/',
  'wss://140.f7z.io/',
  'wss://news.utxo.one/',
  'wss://algo.utxo.one/'
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

export const DEFAULT_NOSTRCONNECT_RELAY = ['wss://relay.nsec.app/']
