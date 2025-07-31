export const JUMBLE_API_BASE_URL = 'https://api.jumble.social'

export const DEFAULT_FAVORITE_RELAYS = [
  'wss://nostr.wine/',
  'wss://pyramid.fiatjaf.com/',
  'wss://relays.land/spatianostra/',
  'wss://theforest.nostr1.com/',
  'wss://algo.utxo.one/',
  'wss://140.f7z.io/',
  'wss://news.utxo.one/'
]

export const RECOMMENDED_RELAYS = DEFAULT_FAVORITE_RELAYS.concat(['wss://yabu.me/'])

export const RECOMMENDED_BLOSSOM_SERVERS = ['https://blossom.band/', 'https://nostr.download/']

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
  AUTOPLAY: 'autoplay',
  HIDE_UNTRUSTED_INTERACTIONS: 'hideUntrustedInteractions',
  HIDE_UNTRUSTED_NOTIFICATIONS: 'hideUntrustedNotifications',
  TRANSLATION_SERVICE_CONFIG_MAP: 'translationServiceConfigMap',
  MEDIA_UPLOAD_SERVICE_CONFIG_MAP: 'mediaUploadServiceConfigMap',
  HIDE_UNTRUSTED_NOTES: 'hideUntrustedNotes',
  MEDIA_UPLOAD_SERVICE: 'mediaUploadService', // deprecated
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
  POLL: 1068,
  POLL_RESPONSE: 1018,
  COMMENT: 1111,
  VOICE: 1222,
  VOICE_COMMENT: 1244,
  FAVORITE_RELAYS: 10012,
  BLOSSOM_SERVER_LIST: 10063,
  GROUP_METADATA: 39000
}

export const URL_REGEX =
  /https?:\/\/[\w\p{L}\p{N}\p{M}&.-/?=#\-@%+_:!~*]+(?<![.,;:'")\]}!?，。；：""''！？】）])/gu
export const WS_URL_REGEX =
  /wss?:\/\/[\w\p{L}\p{N}\p{M}&.-/?=#\-@%+_:!~*]+(?<![.,;:'")\]}!?，。；：""''！？】）])/gu
export const IMAGE_REGEX =
  /https?:\/\/[\w\p{L}\p{N}\p{M}&.-]+\/(?:[^/\s?]*\/)*([^/\s?]*\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic|svg|avif))(?!\w)(?:\?[\w\p{L}\p{N}\p{M}&=.-]*)?(?<![.,;:'")\]}!?，。；：""''！？】）])/giu
export const MEDIA_REGEX =
  /https?:\/\/[\w\p{L}\p{N}\p{M}&.-]+\/(?:[^/\s?]*\/)*([^/\s?]*\.(mp4|webm|ogg|mov|mp3|wav|flac|aac|m4a|opus|wma))(?!\w)(?:\?[\w\p{L}\p{N}\p{M}&=.-]*)?(?<![.,;:'")\]}!?，。；：""''！？】）])/giu
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export const EMOJI_SHORT_CODE_REGEX = /:[a-zA-Z0-9_-]+:/g
export const EMBEDDED_EVENT_REGEX = /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/g
export const EMBEDDED_MENTION_REGEX = /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+)/g
export const HASHTAG_REGEX = /#[\p{L}\p{N}\p{M}_]+/gu
export const LN_INVOICE_REGEX = /(ln(?:bc|tb|bcrt))([0-9]+[munp]?)?1([02-9ac-hj-np-z]+)/g
export const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{2122}]|[\u{23E9}-\u{23EF}]|[\u{23F0}]|[\u{23F3}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu
export const YOUTUBE_URL_REGEX =
  /https?:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch\?[^#\s]*|embed\/[\w-]+|shorts\/[\w-]+)|youtu\.be\/[\w-]+)(?:\?[^#\s]*)?(?:#[^\s]*)?/g

export const MONITOR = '9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923'
export const MONITOR_RELAYS = ['wss://relay.nostr.watch/']

export const CODY_PUBKEY = '8125b911ed0e94dbe3008a0be48cfe5cd0c0b05923cfff917ae7e87da8400883'

export const NIP_96_SERVICE = [
  'https://mockingyou.com',
  'https://nostpic.com',
  'https://nostr.build', // default
  'https://nostrcheck.me',
  'https://nostrmedia.com',
  'https://files.sovbit.host'
]
export const DEFAULT_NIP_96_SERVICE = 'https://nostr.build'

export const DEFAULT_NOSTRCONNECT_RELAY = [
  'wss://relay.nsec.app/',
  'wss://nos.lol/',
  'wss://relay.primal.net'
]

export const POLL_TYPE = {
  MULTIPLE_CHOICE: 'multiplechoice',
  SINGLE_CHOICE: 'singlechoice'
} as const
