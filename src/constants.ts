import { kinds } from 'nostr-tools'

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

export const RECOMMENDED_BLOSSOM_SERVERS = [
  'https://blossom.band/',
  'https://blossom.primal.net/',
  'https://nostr.media/'
]

export const StorageKey = {
  VERSION: 'version',
  THEME_SETTING: 'themeSetting',
  COLOR_PALETTE: 'colorPalette',
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
  DEFAULT_SHOW_NSFW: 'defaultShowNsfw',
  DISMISSED_TOO_MANY_RELAYS_ALERT: 'dismissedTooManyRelaysAlert',
  SHOW_KINDS: 'showKinds',
  SHOW_KINDS_VERSION: 'showKindsVersion',
  HIDE_CONTENT_MENTIONING_MUTED_USERS: 'hideContentMentioningMutedUsers',
  ALWAYS_HIDE_MUTED_NOTES: 'alwaysHideMutedNotes',
  HIDE_NOTIFICATIONS_FROM_MUTED_USERS: 'hideNotificationsFromMutedUsers',
  NOTIFICATION_LIST_STYLE: 'notificationListStyle',
  MEDIA_AUTO_LOAD_POLICY: 'mediaAutoLoadPolicy',
  SHOWN_CREATE_WALLET_GUIDE_TOAST_PUBKEYS: 'shownCreateWalletGuideToastPubkeys',
  FONT_SIZE: 'fontSize',
  PRIMARY_COLOR: 'primaryColor',
  LAYOUT_MODE: 'layoutMode',
  BUTTON_RADIUS: 'buttonRadius',
  POST_BUTTON_STYLE: 'postButtonStyle',
  CARD_RADIUS: 'cardRadius',
  PAGE_THEME: 'pageTheme',
  PRIVATE_NOTES: 'privateNotes',
  TRENDING_NOTES_DISMISSED: 'trendingNotesDismissed',
  TRENDING_NOTES_HEIGHT: 'trendingNotesHeight',
  BITCOIN_TICKER_ALIGNMENT: 'bitcoinTickerAlignment',
  BITCOIN_TICKER_TEXT_SIZE: 'bitcoinTickerTextSize',
  COMPACT_SIDEBAR: 'compactSidebar',
  ENABLED_WIDGETS: 'enabledWidgets',
  PINNED_NOTE_WIDGETS: 'pinnedNoteWidgets',
  AI_PROMPT_WIDGETS: 'aiPromptWidgets',
  ZAP_SOUND: 'zapSound',
  FONT_FAMILY: 'fontFamily',
  CUSTOM_FEEDS: 'customFeeds',
  CHARGE_ZAP_ENABLED: 'chargeZapEnabled',
  CHARGE_ZAP_LIMIT: 'chargeZapLimit',
  ZAP_ON_REACTIONS: 'zapOnReactions',
  ONLY_ZAPS_MODE: 'onlyZapsMode',
  DECK_VIEW_MODE: 'deckViewMode',
  PINNED_COLUMNS: 'pinnedColumns',
  DISTRACTION_FREE_MODE: 'distractionFreeMode',
  AI_SERVICE_CONFIG_MAP: 'aiServiceConfigMap',
  AI_TOOLS_CONFIG_MAP: 'aiToolsConfigMap',
  HIDE_READS_IN_NAVIGATION: 'hideReadsInNavigation',
  HIDE_READS_IN_PROFILES: 'hideReadsInProfiles',
  HIDE_LISTS_IN_NAVIGATION: 'hideListsInNavigation',
  FAVORITE_LISTS: 'favoriteLists',
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
  VIDEO: 21,
  SHORT_VIDEO: 22,
  POLL: 1068,
  POLL_RESPONSE: 1018,
  COMMENT: 1111,
  VOICE: 1222,
  VOICE_COMMENT: 1244,
  FAVORITE_RELAYS: 10012,
  BLOSSOM_SERVER_LIST: 10063,
  RELAY_REVIEW: 31987,
  GROUP_METADATA: 39000,
  STARTER_PACK: 39089
}

export const SUPPORTED_KINDS = [
  kinds.ShortTextNote,
  kinds.Repost,
  ExtendedKind.PICTURE,
  ExtendedKind.VIDEO,
  ExtendedKind.SHORT_VIDEO,
  ExtendedKind.POLL,
  ExtendedKind.COMMENT,
  ExtendedKind.VOICE,
  ExtendedKind.VOICE_COMMENT,
  kinds.Highlights,
  kinds.LongFormArticle,
  ExtendedKind.RELAY_REVIEW
]

export const URL_REGEX =
  /https?:\/\/[\w\p{L}\p{N}\p{M}&.\-/?=#@%+_:!~*]+[^\s.,;:'")\]}!?，。；："'！？】）]/gu
export const WS_URL_REGEX =
  /wss?:\/\/[\w\p{L}\p{N}\p{M}&.\-/?=#@%+_:!~*]+[^\s.,;:'")\]}!?，。；："'！？】）]/gu
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export const EMOJI_SHORT_CODE_REGEX = /:[a-zA-Z0-9_-]+:/g
export const EMBEDDED_EVENT_REGEX = /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/g
export const EMBEDDED_MENTION_REGEX = /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+)/g
export const HASHTAG_REGEX = /#[\p{L}\p{N}\p{M}_]+/gu
export const LN_INVOICE_REGEX = /(ln(?:bc|tb|bcrt))([0-9]+[munp]?)?1([02-9ac-hj-np-z]+)/g
export const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{2122}]|[\u{23E9}-\u{23EF}]|[\u{23F0}]|[\u{23F3}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu
export const YOUTUBE_URL_REGEX =
  /https?:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch\?[^#\s]*|embed\/[\w-]+|shorts\/[\w-]+|live\/[\w-]+)|youtu\.be\/[\w-]+)(?:\?[^#\s]*)?(?:#[^\s]*)?/g

export const JUMBLE_PUBKEY = 'f4eb8e62add1340b9cadcd9861e669b2e907cea534e0f7f3ac974c11c758a51a'
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

export const NOTIFICATION_LIST_STYLE = {
  COMPACT: 'compact',
  DETAILED: 'detailed'
} as const

export const MEDIA_AUTO_LOAD_POLICY = {
  ALWAYS: 'always',
  WIFI_ONLY: 'wifi-only',
  NEVER: 'never'
} as const

export const DISTRACTION_FREE_MODE = {
  DRAIN_MY_TIME: 'drain-my-time',
  FOCUS_MODE: 'focus-mode'
} as const

export const DEFAULT_DISTRACTION_FREE_MODE = 'drain-my-time'

export const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const
export const DEFAULT_FONT_SIZE = 14

// Available font families for the application
export const FONT_FAMILIES = {
  DEFAULT: {
    name: 'Default',
    value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  SYSTEM: {
    name: 'System',
    value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  },
  IBM_PLEX_SANS: {
    name: 'IBM Plex Sans',
    value: '"IBM Plex Sans", system-ui, sans-serif'
  },
  LATO: {
    name: 'Lato',
    value: 'Lato, system-ui, sans-serif'
  },
  OUTFIT: {
    name: 'Outfit',
    value: 'Outfit, system-ui, sans-serif'
  },
  ROBOTO: {
    name: 'Roboto',
    value: 'Roboto, system-ui, sans-serif'
  },
  GEIST_MONO: {
    name: 'Geist Mono',
    value: '"Geist Mono", monospace'
  }
} as const

export const DEFAULT_FONT_FAMILY = 'DEFAULT'

export const ZAP_SOUNDS = {
  NONE: 'none',
  RANDOM: 'random',
  ZAP1: 'zap1',
  ELECTRIC_ZAP: 'electric_zap',
  SENDING_A_MESSAGE: 'sending-a-message',
  NO_SECOND_BEST: 'no-second-best',
  FREEDOM: 'freedom',
  HEY_HEY_HEY: 'hey-hey-hey'
} as const

export type TZapSound = (typeof ZAP_SOUNDS)[keyof typeof ZAP_SOUNDS]

// Array of actual sound files (excluding 'none' and 'random')
export const ACTUAL_ZAP_SOUNDS = [
  ZAP_SOUNDS.ZAP1,
  ZAP_SOUNDS.ELECTRIC_ZAP,
  ZAP_SOUNDS.SENDING_A_MESSAGE,
  ZAP_SOUNDS.NO_SECOND_BEST,
  ZAP_SOUNDS.FREEDOM,
  ZAP_SOUNDS.HEY_HEY_HEY
] as const

export const BUTTON_RADIUS_VALUES = [0, 2, 4, 6, 8, 12, 16, 9999] as const
export const DEFAULT_BUTTON_RADIUS = 6

export const POST_BUTTON_STYLE = {
  FILLED: 'filled',
  OUTLINED: 'outlined'
} as const

export const DEFAULT_POST_BUTTON_STYLE = 'filled'

export const CARD_RADIUS_VALUES = [0, 4, 8, 12, 16, 20, 24] as const
export const DEFAULT_CARD_RADIUS = 8

export const PRIMARY_COLORS = {
  RED: {
    name: 'Red',
    light: '0 72% 51%',
    dark: '0 84% 60%',
    hover: '0 72% 61%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  ORANGE: {
    name: 'Orange',
    light: '25 95% 53%',
    dark: '24 94% 50%',
    hover: '25 95% 63%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  AMBER: {
    name: 'Amber',
    light: '38 92% 50%',
    dark: '38 92% 50%',
    hover: '38 92% 60%',
    foreground: { light: '240 5.9% 10%', dark: '240 5.9% 10%' }
  },
  YELLOW: {
    name: 'Yellow',
    light: '45 93% 47%',
    dark: '45 93% 47%',
    hover: '45 93% 57%',
    foreground: { light: '240 5.9% 10%', dark: '240 5.9% 10%' }
  },
  LIME: {
    name: 'Lime',
    light: '84 81% 44%',
    dark: '84 81% 44%',
    hover: '84 81% 54%',
    foreground: { light: '240 5.9% 10%', dark: '240 5.9% 10%' }
  },
  GREEN: {
    name: 'Green',
    light: '142 76% 36%',
    dark: '142 71% 45%',
    hover: '142 76% 46%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  EMERALD: {
    name: 'Emerald',
    light: '160 84% 39%',
    dark: '160 84% 39%',
    hover: '160 84% 49%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  TEAL: {
    name: 'Teal',
    light: '173 80% 40%',
    dark: '173 58% 39%',
    hover: '173 80% 50%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  CYAN: {
    name: 'Cyan',
    light: '189 94% 43%',
    dark: '189 94% 43%',
    hover: '189 94% 53%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  SKY: {
    name: 'Sky',
    light: '199 89% 48%',
    dark: '199 89% 48%',
    hover: '199 89% 58%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  BLUE: {
    name: 'Blue',
    light: '221 83% 53%',
    dark: '217 91% 60%',
    hover: '221 83% 63%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  INDIGO: {
    name: 'Indigo',
    light: '239 84% 67%',
    dark: '239 84% 67%',
    hover: '239 84% 77%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  VIOLET: {
    name: 'Violet',
    light: '258 90% 66%',
    dark: '258 90% 66%',
    hover: '258 90% 76%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  PURPLE: {
    name: 'Purple',
    light: '271 91% 65%',
    dark: '271 91% 65%',
    hover: '271 91% 75%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  FUCHSIA: {
    name: 'Fuchsia',
    light: '292 84% 61%',
    dark: '292 84% 61%',
    hover: '292 84% 71%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  PINK: {
    name: 'Pink',
    light: '326 78% 50%',
    dark: '326 78% 60%',
    hover: '326 78% 60%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  },
  ROSE: {
    name: 'Rose',
    light: '350 89% 60%',
    dark: '350 89% 60%',
    hover: '350 89% 70%',
    foreground: { light: '0 0% 100%', dark: '0 0% 100%' }
  }
} as const

export const DEFAULT_PRIMARY_COLOR = 'PURPLE'

export const MAX_PINNED_NOTES = 10

export const LAYOUT_MODE = {
  BOXED: 'boxed',
  FULL_WIDTH: 'full-width'
} as const

export const DEFAULT_LAYOUT_MODE = 'boxed'

export const DECK_VIEW_MODE = {
  STANDARD: 'standard',
  MULTI_COLUMN: 'multi-column'
} as const

export const DEFAULT_DECK_VIEW_MODE = 'standard'

export const DEFAULT_PAGE_THEME = 'default'
