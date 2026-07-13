import {
  ALLOWED_FILTER_KINDS,
  BIG_RELAY_URLS,
  DEFAULT_BLOSSOM_CACHE_SERVER_URL,
  DEFAULT_FAVICON_URL_TEMPLATE,
  DEFAULT_FEED_TABS,
  ExtendedKind,
  MEDIA_AUTO_LOAD_POLICY,
  NOTIFICATION_LIST_STYLE,
  NSFW_DISPLAY_POLICY,
  PROCESSED_SYNC_REQUEST_ID_RETENTION_MS,
  PROFILE_PICTURE_AUTO_LOAD_POLICY,
  SEARCHABLE_RELAY_URLS,
  StorageKey,
  TPrimaryColor
} from '@/constants'
import { isSameAccount } from '@/lib/account'
import { getElectronBridge, isElectron } from '@/lib/platform'
import { randomString } from '@/lib/random'
import { isTorBrowser } from '@/lib/utils'
import {
  TAccount,
  TAccountPointer,
  TEmoji,
  TFeedInfo,
  TFeedTabConfig,
  TMediaAutoLoadPolicy,
  TMediaUploadServiceConfig,
  TNotificationStyle,
  TNsfwDisplayPolicy,
  TProfilePictureAutoLoadPolicy,
  TRelaySet,
  TThemeSetting,
  TTranslationServiceConfig
} from '@/types'
import { kinds } from 'nostr-tools'

type TProcessedSyncRequestIdMap = Record<string, number>

class LocalStorageService {
  static instance: LocalStorageService

  private relaySets: TRelaySet[] = []
  private themeSetting: TThemeSetting = 'system'
  private accounts: TAccount[] = []
  private currentAccount: TAccount | null = null
  private feedTabs: TFeedTabConfig[] = DEFAULT_FEED_TABS
  private lastReadNotificationTimeMap: Record<string, number> = {}
  private defaultZapSats: number = 21
  private defaultZapComment: string = 'Zap!'
  private quickZap: boolean = false
  private accountFeedInfoMap: Record<string, TFeedInfo | undefined> = {}
  private autoplay: boolean = true
  private videoLoop: boolean = false
  private translationServiceConfigMap: Record<string, TTranslationServiceConfig> = {}
  private mediaUploadServiceConfigMap: Record<string, TMediaUploadServiceConfig> = {}
  private dismissedTooManyRelaysAlert: boolean = false
  private dismissedDesktopAppTip: boolean = false
  private showKinds: number[] = []
  private showKindsMap: Record<string, number[]> = {}
  private hideContentMentioningMutedUsers: boolean = false
  private notificationListStyle: TNotificationStyle = NOTIFICATION_LIST_STYLE.DETAILED
  private mediaAutoLoadPolicy: TMediaAutoLoadPolicy = MEDIA_AUTO_LOAD_POLICY.ALWAYS
  private profilePictureAutoLoadPolicy: TProfilePictureAutoLoadPolicy =
    PROFILE_PICTURE_AUTO_LOAD_POLICY.ALWAYS
  private shownCreateWalletGuideToastPubkeys: Set<string> = new Set()
  private sidebarCollapse: boolean = false
  private primaryColor: TPrimaryColor = 'DEFAULT'
  private enableSingleColumnLayout: boolean = true
  private faviconUrlTemplate: string = DEFAULT_FAVICON_URL_TEMPLATE
  private filterOutOnionRelays: boolean = !isTorBrowser()
  private allowInsecureConnection: boolean = false
  private blossomCacheServerUrl: string = DEFAULT_BLOSSOM_CACHE_SERVER_URL
  private blossomCacheServerEnabled: boolean = false
  private quickReaction: boolean = false
  private quickReactionEmoji: string | TEmoji = '+'
  private addClientTag: boolean = false
  private nsfwDisplayPolicy: TNsfwDisplayPolicy = NSFW_DISPLAY_POLICY.HIDE_CONTENT
  private defaultRelayUrls: string[] = BIG_RELAY_URLS
  private searchRelayUrls: string[] = SEARCHABLE_RELAY_URLS
  private searchHistory: string[] = []
  private mutedWords: string[] = []
  private minTrustScore: number = 0
  private minTrustScoreMap: Record<string, number> = {}
  private hideIndirectNotifications: boolean = false
  private encryptionKeyPrivkeyMap: Record<string, string> = {}
  // Rotated-out encryption keys kept around (per account) so messages still
  // encrypted to them can be decrypted during the grace period. retiredAt is in ms.
  private retiredEncryptionKeyMap: Record<string, { privkey: string; retiredAt: number }[]> = {}
  // Per-pubkey maps for fields that historically lived inline on TAccount.
  // Always the source of truth at runtime regardless of mode.
  private nsecByPubkey: Record<string, string> = {}
  private ncryptsecByPubkey: Record<string, string> = {}
  private bunkerClientSecretByPubkey: Record<string, string> = {}
  // True when secrets persist via main-process safeStorage (Electron) instead of localStorage.
  private secretsViaIpc = false
  private secretsHydrated = false
  private secretsWriteChain: Promise<void> = Promise.resolve()
  private lastReadDmTimeMap: Record<string, Record<string, number>> = {}
  private dmLastSyncedAtMap: Record<string, number> = {}
  private dmBackwardCursorMap: Record<string, number> = {}
  private processedSyncRequestIds: TProcessedSyncRequestIdMap = {}
  private disableNotificationSync: boolean = false

  constructor() {
    if (!LocalStorageService.instance) {
      this.init()
      LocalStorageService.instance = this
    }
    return LocalStorageService.instance
  }

  init() {
    this.themeSetting =
      (window.localStorage.getItem(StorageKey.THEME_SETTING) as TThemeSetting) ?? 'system'
    const accountsStr = window.localStorage.getItem(StorageKey.ACCOUNTS)
    this.accounts = accountsStr ? JSON.parse(accountsStr) : []
    const currentAccountStr = window.localStorage.getItem(StorageKey.CURRENT_ACCOUNT)
    this.currentAccount = currentAccountStr ? JSON.parse(currentAccountStr) : null

    // Peel any inline secrets out of accounts into per-pubkey maps so the
    // accessor surface is uniform. In Web mode these maps are still backed
    // by inline storage (re-attached on persistence). In Electron mode
    // hydrate() will discard these and reload from safeStorage.
    this.peelInlineSecrets()

    const feedTabsStr = window.localStorage.getItem(StorageKey.FEED_TABS)
    if (feedTabsStr) {
      try {
        const parsed = JSON.parse(feedTabsStr)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (tab): tab is TFeedTabConfig =>
              tab != null &&
              typeof tab === 'object' &&
              typeof tab.id === 'string' &&
              tab.id.length > 0 &&
              typeof tab.label === 'string'
          )
          if (valid.length > 0) {
            // Backfill any default builtin tabs the user has never seen
            // before (e.g. ones added in a later version). They're appended
            // at the end with their default `hidden` value preserved, so
            // they show up in Customize tabs and the user can enable them
            // without losing their existing layout.
            const knownIds = new Set(valid.map((tab) => tab.id))
            const knownBuiltins = new Set(
              valid.map((tab) => tab.builtin).filter((b): b is NonNullable<typeof b> => !!b)
            )
            const missingDefaults = DEFAULT_FEED_TABS.filter(
              (tab) => !knownIds.has(tab.id) && !(tab.builtin && knownBuiltins.has(tab.builtin))
            ).map((tab) => ({ ...tab }))
            this.feedTabs = [...valid, ...missingDefaults]
            if (missingDefaults.length > 0) {
              window.localStorage.setItem(
                StorageKey.FEED_TABS,
                JSON.stringify(this.feedTabs)
              )
            }
          }
        }
      } catch {
        // ignore, fall back to defaults
      }
    }
    const lastReadNotificationTimeMapStr =
      window.localStorage.getItem(StorageKey.LAST_READ_NOTIFICATION_TIME_MAP) ?? '{}'
    this.lastReadNotificationTimeMap = JSON.parse(lastReadNotificationTimeMapStr)

    const relaySetsStr = window.localStorage.getItem(StorageKey.RELAY_SETS)
    if (!relaySetsStr) {
      let relaySets: TRelaySet[] = []
      const legacyRelayGroupsStr = window.localStorage.getItem('relayGroups')
      if (legacyRelayGroupsStr) {
        const legacyRelayGroups = JSON.parse(legacyRelayGroupsStr)
        relaySets = legacyRelayGroups.map((group: any) => {
          return {
            id: randomString(),
            name: group.groupName,
            relayUrls: group.relayUrls
          }
        })
      }
      if (!relaySets.length) {
        relaySets = []
      }
      window.localStorage.setItem(StorageKey.RELAY_SETS, JSON.stringify(relaySets))
      this.relaySets = relaySets
    } else {
      this.relaySets = JSON.parse(relaySetsStr)
    }

    const defaultZapSatsStr = window.localStorage.getItem(StorageKey.DEFAULT_ZAP_SATS)
    if (defaultZapSatsStr) {
      const num = parseInt(defaultZapSatsStr)
      if (!isNaN(num)) {
        this.defaultZapSats = num
      }
    }
    this.defaultZapComment = window.localStorage.getItem(StorageKey.DEFAULT_ZAP_COMMENT) ?? 'Zap!'
    this.quickZap = window.localStorage.getItem(StorageKey.QUICK_ZAP) === 'true'

    const accountFeedInfoMapStr =
      window.localStorage.getItem(StorageKey.ACCOUNT_FEED_INFO_MAP) ?? '{}'
    this.accountFeedInfoMap = JSON.parse(accountFeedInfoMapStr)

    this.autoplay = window.localStorage.getItem(StorageKey.AUTOPLAY) !== 'false'
    this.videoLoop = window.localStorage.getItem(StorageKey.VIDEO_LOOP) === 'true'

    const translationServiceConfigMapStr = window.localStorage.getItem(
      StorageKey.TRANSLATION_SERVICE_CONFIG_MAP
    )
    if (translationServiceConfigMapStr) {
      this.translationServiceConfigMap = JSON.parse(translationServiceConfigMapStr)
    }

    const mediaUploadServiceConfigMapStr = window.localStorage.getItem(
      StorageKey.MEDIA_UPLOAD_SERVICE_CONFIG_MAP
    )
    if (mediaUploadServiceConfigMapStr) {
      this.mediaUploadServiceConfigMap = JSON.parse(mediaUploadServiceConfigMapStr)
    }

    // Migrate old boolean setting to new policy
    const nsfwDisplayPolicyStr = window.localStorage.getItem(StorageKey.NSFW_DISPLAY_POLICY)
    if (
      nsfwDisplayPolicyStr &&
      Object.values(NSFW_DISPLAY_POLICY).includes(nsfwDisplayPolicyStr as TNsfwDisplayPolicy)
    ) {
      this.nsfwDisplayPolicy = nsfwDisplayPolicyStr as TNsfwDisplayPolicy
    } else {
      // Migration: convert old boolean to new policy
      const defaultShowNsfwStr = window.localStorage.getItem(StorageKey.DEFAULT_SHOW_NSFW)
      this.nsfwDisplayPolicy =
        defaultShowNsfwStr === 'true' ? NSFW_DISPLAY_POLICY.SHOW : NSFW_DISPLAY_POLICY.HIDE_CONTENT
      window.localStorage.setItem(StorageKey.NSFW_DISPLAY_POLICY, this.nsfwDisplayPolicy)
    }

    this.dismissedTooManyRelaysAlert =
      window.localStorage.getItem(StorageKey.DISMISSED_TOO_MANY_RELAYS_ALERT) === 'true'

    this.dismissedDesktopAppTip =
      window.localStorage.getItem(StorageKey.DISMISSED_DESKTOP_APP_TIP) === 'true'

    const showKindsStr = window.localStorage.getItem(StorageKey.SHOW_KINDS)
    if (!showKindsStr) {
      this.showKinds = ALLOWED_FILTER_KINDS
    } else {
      const showKindsVersionStr = window.localStorage.getItem(StorageKey.SHOW_KINDS_VERSION)
      const showKindsVersion = showKindsVersionStr ? parseInt(showKindsVersionStr) : 0
      const showKindSet = new Set(JSON.parse(showKindsStr) as number[])
      if (showKindsVersion < 1) {
        showKindSet.add(ExtendedKind.VIDEO)
        showKindSet.add(ExtendedKind.SHORT_VIDEO)
      }
      if (showKindsVersion < 2 && showKindSet.has(ExtendedKind.VIDEO)) {
        showKindSet.add(ExtendedKind.ADDRESSABLE_NORMAL_VIDEO)
        showKindSet.add(ExtendedKind.ADDRESSABLE_SHORT_VIDEO)
      }
      if (showKindsVersion < 3 && showKindSet.has(24236)) {
        showKindSet.delete(24236) // remove typo kind
        showKindSet.add(ExtendedKind.ADDRESSABLE_SHORT_VIDEO)
      }
      if (showKindsVersion < 4 && showKindSet.has(kinds.Repost)) {
        showKindSet.add(kinds.GenericRepost)
      }
      this.showKinds = Array.from(showKindSet)
    }
    window.localStorage.setItem(StorageKey.SHOW_KINDS, JSON.stringify(this.showKinds))
    window.localStorage.setItem(StorageKey.SHOW_KINDS_VERSION, '4')

    const showKindsMapStr = window.localStorage.getItem(StorageKey.SHOW_KINDS_MAP)
    if (showKindsMapStr) {
      try {
        const map = JSON.parse(showKindsMapStr)
        if (typeof map === 'object' && map !== null) {
          this.showKindsMap = map
        }
      } catch {
        // ignore
      }
    }

    this.hideContentMentioningMutedUsers =
      window.localStorage.getItem(StorageKey.HIDE_CONTENT_MENTIONING_MUTED_USERS) === 'true'

    this.notificationListStyle =
      window.localStorage.getItem(StorageKey.NOTIFICATION_LIST_STYLE) ===
      NOTIFICATION_LIST_STYLE.COMPACT
        ? NOTIFICATION_LIST_STYLE.COMPACT
        : NOTIFICATION_LIST_STYLE.DETAILED

    const mediaAutoLoadPolicy = window.localStorage.getItem(StorageKey.MEDIA_AUTO_LOAD_POLICY)
    if (
      mediaAutoLoadPolicy &&
      Object.values(MEDIA_AUTO_LOAD_POLICY).includes(mediaAutoLoadPolicy as TMediaAutoLoadPolicy)
    ) {
      this.mediaAutoLoadPolicy = mediaAutoLoadPolicy as TMediaAutoLoadPolicy
    }

    const profilePictureAutoLoadPolicy = window.localStorage.getItem(
      StorageKey.PROFILE_PICTURE_AUTO_LOAD_POLICY
    )
    if (profilePictureAutoLoadPolicy) {
      // Migrate wifi-only to never
      const policy =
        profilePictureAutoLoadPolicy === 'wifi-only'
          ? PROFILE_PICTURE_AUTO_LOAD_POLICY.NEVER
          : profilePictureAutoLoadPolicy
      if (
        Object.values(PROFILE_PICTURE_AUTO_LOAD_POLICY).includes(
          policy as TProfilePictureAutoLoadPolicy
        )
      ) {
        this.profilePictureAutoLoadPolicy = policy as TProfilePictureAutoLoadPolicy
        if (profilePictureAutoLoadPolicy === 'wifi-only') {
          window.localStorage.setItem(StorageKey.PROFILE_PICTURE_AUTO_LOAD_POLICY, policy)
        }
      }
    }

    const shownCreateWalletGuideToastPubkeysStr = window.localStorage.getItem(
      StorageKey.SHOWN_CREATE_WALLET_GUIDE_TOAST_PUBKEYS
    )
    this.shownCreateWalletGuideToastPubkeys = shownCreateWalletGuideToastPubkeysStr
      ? new Set(JSON.parse(shownCreateWalletGuideToastPubkeysStr))
      : new Set()

    this.sidebarCollapse = window.localStorage.getItem(StorageKey.SIDEBAR_COLLAPSE) === 'true'

    this.primaryColor =
      (window.localStorage.getItem(StorageKey.PRIMARY_COLOR) as TPrimaryColor) ?? 'DEFAULT'

    this.enableSingleColumnLayout =
      window.localStorage.getItem(StorageKey.ENABLE_SINGLE_COLUMN_LAYOUT) !== 'false'

    this.faviconUrlTemplate =
      window.localStorage.getItem(StorageKey.FAVICON_URL_TEMPLATE) ?? DEFAULT_FAVICON_URL_TEMPLATE

    const filterOutOnionRelaysStr = window.localStorage.getItem(StorageKey.FILTER_OUT_ONION_RELAYS)
    if (filterOutOnionRelaysStr) {
      this.filterOutOnionRelays = filterOutOnionRelaysStr !== 'false'
    }

    this.allowInsecureConnection =
      window.localStorage.getItem(StorageKey.ALLOW_INSECURE_CONNECTION) === 'true'

    this.blossomCacheServerUrl =
      window.localStorage.getItem(StorageKey.BLOSSOM_CACHE_SERVER_URL) ??
      DEFAULT_BLOSSOM_CACHE_SERVER_URL
    this.blossomCacheServerEnabled =
      window.localStorage.getItem(StorageKey.BLOSSOM_CACHE_SERVER_ENABLED) === 'true'

    this.quickReaction = window.localStorage.getItem(StorageKey.QUICK_REACTION) === 'true'
    this.addClientTag = window.localStorage.getItem(StorageKey.ADD_CLIENT_TAG) === 'true'
    const quickReactionEmojiStr =
      window.localStorage.getItem(StorageKey.QUICK_REACTION_EMOJI) ?? '+'
    if (quickReactionEmojiStr.startsWith('{')) {
      this.quickReactionEmoji = JSON.parse(quickReactionEmojiStr) as TEmoji
    } else {
      this.quickReactionEmoji = quickReactionEmojiStr
    }

    const minTrustScoreStr = window.localStorage.getItem(StorageKey.MIN_TRUST_SCORE)
    if (minTrustScoreStr) {
      const score = parseInt(minTrustScoreStr, 10)
      if (!isNaN(score) && score >= 0 && score <= 100) {
        this.minTrustScore = score
      }
    } else {
      const storedHideUntrustedInteractions =
        window.localStorage.getItem(StorageKey.HIDE_UNTRUSTED_INTERACTIONS) === 'true'
      const storedHideUntrustedNotifications =
        window.localStorage.getItem(StorageKey.HIDE_UNTRUSTED_NOTIFICATIONS) === 'true'
      const storedHideUntrustedNotes =
        window.localStorage.getItem(StorageKey.HIDE_UNTRUSTED_NOTES) === 'true'
      if (
        storedHideUntrustedInteractions ||
        storedHideUntrustedNotifications ||
        storedHideUntrustedNotes
      ) {
        this.minTrustScore = 100 // set to max if any of the old settings were true
      }
    }

    const minTrustScoreMapStr = window.localStorage.getItem(StorageKey.MIN_TRUST_SCORE_MAP)
    if (minTrustScoreMapStr) {
      try {
        const map = JSON.parse(minTrustScoreMapStr)
        if (typeof map === 'object' && map !== null) {
          this.minTrustScoreMap = map
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    const encryptionKeyPrivkeyMapStr = window.localStorage.getItem(
      StorageKey.ENCRYPTION_KEY_PRIVKEY_MAP
    )
    if (encryptionKeyPrivkeyMapStr) {
      try {
        const map = JSON.parse(encryptionKeyPrivkeyMapStr)
        if (typeof map === 'object' && map !== null) {
          this.encryptionKeyPrivkeyMap = map
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    const retiredEncryptionKeyMapStr = window.localStorage.getItem(
      StorageKey.RETIRED_ENCRYPTION_KEY_PRIVKEY_MAP
    )
    if (retiredEncryptionKeyMapStr) {
      try {
        const map = JSON.parse(retiredEncryptionKeyMapStr)
        if (typeof map === 'object' && map !== null) {
          this.retiredEncryptionKeyMap = map
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    const lastReadDmTimeMapStr = window.localStorage.getItem(StorageKey.LAST_READ_DM_TIME_MAP)
    if (lastReadDmTimeMapStr) {
      try {
        const map = JSON.parse(lastReadDmTimeMapStr)
        if (typeof map === 'object' && map !== null) {
          this.lastReadDmTimeMap = map
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    const dmLastSyncedAtMapStr = window.localStorage.getItem(StorageKey.DM_LAST_SYNCED_AT_MAP)
    if (dmLastSyncedAtMapStr) {
      try {
        const map = JSON.parse(dmLastSyncedAtMapStr)
        if (typeof map === 'object' && map !== null) {
          this.dmLastSyncedAtMap = map
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    const dmBackwardCursorMapStr = window.localStorage.getItem(StorageKey.DM_BACKWARD_CURSOR_MAP)
    if (dmBackwardCursorMapStr) {
      try {
        const map = JSON.parse(dmBackwardCursorMapStr)
        if (typeof map === 'object' && map !== null) {
          this.dmBackwardCursorMap = map
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    const processedSyncRequestIdsStr = window.localStorage.getItem(
      StorageKey.PROCESSED_SYNC_REQUEST_IDS
    )
    if (processedSyncRequestIdsStr) {
      try {
        this.processedSyncRequestIds = this.normalizeProcessedSyncRequestIds(
          JSON.parse(processedSyncRequestIdsStr)
        )
        this.pruneProcessedSyncRequestIds()
        this.persistProcessedSyncRequestIds()
      } catch {
        // Invalid JSON, use default
      }
    }

    const defaultRelayUrlsStr = window.localStorage.getItem(StorageKey.DEFAULT_RELAY_URLS)
    if (defaultRelayUrlsStr) {
      try {
        const urls = JSON.parse(defaultRelayUrlsStr)
        if (
          Array.isArray(urls) &&
          urls.length > 0 &&
          urls.every((url) => typeof url === 'string')
        ) {
          this.defaultRelayUrls = urls
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    const searchRelayUrlsStr = window.localStorage.getItem(StorageKey.SEARCH_RELAY_URLS)
    if (searchRelayUrlsStr) {
      try {
        const urls = JSON.parse(searchRelayUrlsStr)
        if (
          Array.isArray(urls) &&
          urls.length > 0 &&
          urls.every((url) => typeof url === 'string')
        ) {
          this.searchRelayUrls = urls
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    const searchHistoryStr = window.localStorage.getItem(StorageKey.SEARCH_HISTORY)
    if (searchHistoryStr) {
      try {
        const history = JSON.parse(searchHistoryStr)
        if (Array.isArray(history)) {
          this.searchHistory = history
        }
      } catch {
        // ignore
      }
    }

    const mutedWordsStr = window.localStorage.getItem(StorageKey.MUTED_WORDS)
    if (mutedWordsStr) {
      try {
        const words = JSON.parse(mutedWordsStr)
        if (Array.isArray(words) && words.every((word) => typeof word === 'string')) {
          this.mutedWords = words
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    this.hideIndirectNotifications =
      window.localStorage.getItem(StorageKey.HIDE_INDIRECT_NOTIFICATIONS) === 'true'

    this.disableNotificationSync =
      window.localStorage.getItem(StorageKey.DISABLE_NOTIFICATION_SYNC) === 'true'

    // Clean up deprecated data
    window.localStorage.removeItem(StorageKey.PINNED_PUBKEYS)
    window.localStorage.removeItem(StorageKey.ACCOUNT_PROFILE_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_FOLLOW_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_RELAY_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_MUTE_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_MUTE_DECRYPTED_TAGS_MAP)
    window.localStorage.removeItem(StorageKey.ACTIVE_RELAY_SET_ID)
    window.localStorage.removeItem(StorageKey.FEED_TYPE)
    window.localStorage.removeItem(StorageKey.ENABLE_LIVE_FEED)
    window.localStorage.removeItem(StorageKey.CLIENT_KEY_PRIVKEY_MAP)

    // In-memory maps above are loaded once; without this, a write in another tab
    // of the same browser would never reach this tab's caches (localStorage is
    // shared on disk, but each tab parses it into its own memory). Keep the
    // DM-key caches in sync so cross-tab key rotation is observed here too.
    // (Electron stores secrets via IPC, not localStorage, so this is a no-op there.)
    window.addEventListener('storage', this.handleCrossTabStorage)
  }

  private handleCrossTabStorage = (event: StorageEvent) => {
    // The browser only fires 'storage' for changes made by *other* tabs, so our
    // own writes never re-enter here. Ignore unrelated storage areas/keys.
    if (event.storageArea && event.storageArea !== window.localStorage) return
    switch (event.key) {
      case StorageKey.ENCRYPTION_KEY_PRIVKEY_MAP:
        this.encryptionKeyPrivkeyMap = this.parseStoredRecord(event.newValue)
        break
      case StorageKey.RETIRED_ENCRYPTION_KEY_PRIVKEY_MAP:
        this.retiredEncryptionKeyMap = this.parseStoredRecord(event.newValue)
        break
      case StorageKey.PROCESSED_SYNC_REQUEST_IDS: {
        this.processedSyncRequestIds = this.parseProcessedSyncRequestIds(event.newValue)
        break
      }
    }
  }

  private parseStoredRecord<T>(raw: string | null): Record<string, T> {
    if (!raw) return {}
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }

  private parseProcessedSyncRequestIds(raw: string | null): TProcessedSyncRequestIdMap {
    if (!raw) return {}
    try {
      return this.normalizeProcessedSyncRequestIds(JSON.parse(raw))
    } catch {
      return {}
    }
  }

  private normalizeProcessedSyncRequestIds(value: unknown): TProcessedSyncRequestIdMap {
    const now = Date.now()
    const entries: TProcessedSyncRequestIdMap = {}

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          entries[item] = now
          continue
        }

        if (typeof item !== 'object' || item === null) continue
        const id = (item as { id?: unknown }).id
        const processedAt = (item as { processedAt?: unknown }).processedAt
        if (typeof id === 'string') {
          entries[id] = typeof processedAt === 'number' ? processedAt : now
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [id, processedAt] of Object.entries(value)) {
        if (typeof processedAt === 'number') {
          entries[id] = processedAt
        }
      }
    }

    return entries
  }

  getRelaySets() {
    return this.relaySets
  }

  setRelaySets(relaySets: TRelaySet[]) {
    this.relaySets = relaySets
    window.localStorage.setItem(StorageKey.RELAY_SETS, JSON.stringify(this.relaySets))
  }

  getThemeSetting() {
    return this.themeSetting
  }

  setThemeSetting(themeSetting: TThemeSetting) {
    window.localStorage.setItem(StorageKey.THEME_SETTING, themeSetting)
    this.themeSetting = themeSetting
  }

  // getNoteListMode() {
  //   return this.noteListMode
  // }

  // setNoteListMode(mode: string) {
  //   window.localStorage.setItem(StorageKey.NOTE_LIST_MODE, mode)
  //   this.noteListMode = mode
  // }

  getFeedTabs() {
    return this.feedTabs
  }

  setFeedTabs(tabs: TFeedTabConfig[]) {
    this.feedTabs = tabs
    window.localStorage.setItem(StorageKey.FEED_TABS, JSON.stringify(tabs))
  }

  /**
   * Hydrate sensitive fields from secure storage. Must be awaited once at
   * boot, before any code reads/writes secrets. In Web mode this is a no-op;
   * in Electron mode it loads the encrypted secrets bundle from the main
   * process via safeStorage.
   */
  async hydrate(): Promise<void> {
    if (this.secretsHydrated) return
    this.secretsHydrated = true

    const bridge = getElectronBridge()
    if (!isElectron() || !bridge) return

    let available = false
    try {
      available = await bridge.secrets.isAvailable()
    } catch {
      available = false
    }

    // Discard anything peeled out of localStorage; main-process file is the
    // sole source of truth in Electron mode.
    this.nsecByPubkey = {}
    this.ncryptsecByPubkey = {}
    this.bunkerClientSecretByPubkey = {}
    this.encryptionKeyPrivkeyMap = {}
    this.retiredEncryptionKeyMap = {}

    if (available) {
      this.secretsViaIpc = true
      try {
        const bundle = await bridge.secrets.load()
        const hadPersistedClientKey = 'clientKeyPrivkey' in bundle
        Object.assign(this.nsecByPubkey, bundle.nsec ?? {})
        Object.assign(this.ncryptsecByPubkey, bundle.ncryptsec ?? {})
        Object.assign(this.bunkerClientSecretByPubkey, bundle.bunkerClientSecretKey ?? {})
        Object.assign(this.encryptionKeyPrivkeyMap, bundle.encryptionKeyPrivkey ?? {})
        Object.assign(this.retiredEncryptionKeyMap, bundle.retiredEncryptionKeyPrivkey ?? {})
        if (hadPersistedClientKey) this.queueSecretsSave()
      } catch (err) {
        console.error('[storage] failed to load encrypted secrets:', err)
      }
    } else {
      console.warn(
        '[storage] safeStorage not available — secrets stay in-memory and will be lost on quit'
      )
    }

    // Defensive cleanup: scrub any plaintext that lingered in localStorage.
    window.localStorage.removeItem(StorageKey.ENCRYPTION_KEY_PRIVKEY_MAP)
    window.localStorage.removeItem(StorageKey.RETIRED_ENCRYPTION_KEY_PRIVKEY_MAP)
    window.localStorage.removeItem(StorageKey.CLIENT_KEY_PRIVKEY_MAP)
    window.localStorage.setItem(StorageKey.ACCOUNTS, JSON.stringify(this.serializeAccounts()))
    if (this.currentAccount) {
      window.localStorage.setItem(
        StorageKey.CURRENT_ACCOUNT,
        JSON.stringify(this.serializeAccount(this.currentAccount))
      )
    }
  }

  /**
   * Pulls inline nsec/ncryptsec/bunkerClientSecretKey out of the accounts
   * array (and currentAccount) and into per-pubkey maps. Idempotent.
   */
  private peelInlineSecrets() {
    for (const act of this.accounts) {
      if (act.nsec) this.nsecByPubkey[act.pubkey] = act.nsec
      if (act.ncryptsec) this.ncryptsecByPubkey[act.pubkey] = act.ncryptsec
      if (act.bunkerClientSecretKey) {
        this.bunkerClientSecretByPubkey[act.pubkey] = act.bunkerClientSecretKey
      }
    }
    if (this.currentAccount) {
      const act = this.currentAccount
      if (act.nsec) this.nsecByPubkey[act.pubkey] = act.nsec
      if (act.ncryptsec) this.ncryptsecByPubkey[act.pubkey] = act.ncryptsec
      if (act.bunkerClientSecretKey) {
        this.bunkerClientSecretByPubkey[act.pubkey] = act.bunkerClientSecretKey
      }
    }
  }

  /**
   * Returns a copy of the account with the per-pubkey secret fields re-attached.
   * Consumers receive accounts with secrets visible (back-compat); internal
   * state stores secrets in maps only.
   */
  private hydrateAccount(account: TAccount): TAccount {
    return {
      ...account,
      nsec: this.nsecByPubkey[account.pubkey] ?? account.nsec,
      ncryptsec: this.ncryptsecByPubkey[account.pubkey] ?? account.ncryptsec,
      bunkerClientSecretKey:
        this.bunkerClientSecretByPubkey[account.pubkey] ?? account.bunkerClientSecretKey
    }
  }

  /** Shape an account for persistence: web inlines secrets, electron strips. */
  private serializeAccount(account: TAccount): TAccount {
    if (this.secretsViaIpc) {
      const stripped: TAccount = { ...account }
      delete stripped.nsec
      delete stripped.ncryptsec
      delete stripped.bunkerClientSecretKey
      return stripped
    }
    return this.hydrateAccount(account)
  }

  private serializeAccounts(): TAccount[] {
    return this.accounts.map((a) => this.serializeAccount(a))
  }

  private persistAccountsToLocalStorage() {
    window.localStorage.setItem(StorageKey.ACCOUNTS, JSON.stringify(this.serializeAccounts()))
  }

  private persistCurrentAccountToLocalStorage() {
    if (this.currentAccount) {
      window.localStorage.setItem(
        StorageKey.CURRENT_ACCOUNT,
        JSON.stringify(this.serializeAccount(this.currentAccount))
      )
    } else {
      window.localStorage.removeItem(StorageKey.CURRENT_ACCOUNT)
    }
  }

  private persistEncryptionKeyMap() {
    if (this.secretsViaIpc) {
      this.queueSecretsSave()
    } else {
      window.localStorage.setItem(
        StorageKey.ENCRYPTION_KEY_PRIVKEY_MAP,
        JSON.stringify(this.encryptionKeyPrivkeyMap)
      )
    }
  }

  private persistRetiredEncryptionKeyMap() {
    if (this.secretsViaIpc) {
      this.queueSecretsSave()
    } else {
      window.localStorage.setItem(
        StorageKey.RETIRED_ENCRYPTION_KEY_PRIVKEY_MAP,
        JSON.stringify(this.retiredEncryptionKeyMap)
      )
    }
  }

  private queueSecretsSave() {
    const bridge = getElectronBridge()
    if (!bridge) return
    const snapshot = {
      nsec: { ...this.nsecByPubkey },
      ncryptsec: { ...this.ncryptsecByPubkey },
      bunkerClientSecretKey: { ...this.bunkerClientSecretByPubkey },
      encryptionKeyPrivkey: { ...this.encryptionKeyPrivkeyMap },
      retiredEncryptionKeyPrivkey: { ...this.retiredEncryptionKeyMap }
    }
    this.secretsWriteChain = this.secretsWriteChain
      .catch(() => {
        // swallow so chain stays alive
      })
      .then(() =>
        bridge.secrets.save(snapshot).catch((err) => {
          console.error('[storage] failed to persist encrypted secrets:', err)
        })
      )
  }

  getAccounts() {
    return this.accounts.map((a) => this.hydrateAccount(a))
  }

  findAccount(account: TAccountPointer) {
    const found = this.accounts.find((act) => isSameAccount(act, account))
    return found ? this.hydrateAccount(found) : undefined
  }

  getCurrentAccount() {
    return this.currentAccount ? this.hydrateAccount(this.currentAccount) : null
  }

  getAccountNsec(pubkey: string) {
    return this.nsecByPubkey[pubkey]
  }

  getAccountNcryptsec(pubkey: string) {
    return this.ncryptsecByPubkey[pubkey]
  }

  getBunkerClientSecretKey(pubkey: string) {
    return this.bunkerClientSecretByPubkey[pubkey]
  }

  addAccount(account: TAccount) {
    if (account.nsec) this.nsecByPubkey[account.pubkey] = account.nsec
    if (account.ncryptsec) this.ncryptsecByPubkey[account.pubkey] = account.ncryptsec
    if (account.bunkerClientSecretKey) {
      this.bunkerClientSecretByPubkey[account.pubkey] = account.bunkerClientSecretKey
    }

    // Internal accounts array stores stripped copies; we re-attach on read.
    const stripped: TAccount = { ...account }
    delete stripped.nsec
    delete stripped.ncryptsec
    delete stripped.bunkerClientSecretKey

    const index = this.accounts.findIndex((act) => isSameAccount(act, account))
    if (index !== -1) {
      this.accounts[index] = stripped
    } else {
      this.accounts.push(stripped)
    }
    this.persistAccountsToLocalStorage()
    if (this.secretsViaIpc) this.queueSecretsSave()
    return this.getAccounts()
  }

  removeAccount(account: TAccount) {
    this.accounts = this.accounts.filter((act) => !isSameAccount(act, account))
    if (isSameAccount(this.currentAccount, account)) {
      this.currentAccount = null
      this.persistCurrentAccountToLocalStorage()
    }
    delete this.nsecByPubkey[account.pubkey]
    delete this.ncryptsecByPubkey[account.pubkey]
    delete this.bunkerClientSecretByPubkey[account.pubkey]
    this.persistAccountsToLocalStorage()
    if (this.secretsViaIpc) this.queueSecretsSave()
    return this.getAccounts()
  }

  switchAccount(account: TAccount | null) {
    if (!account) {
      return
    }
    const act = this.accounts.find((a) => isSameAccount(a, account))
    if (!act) {
      return
    }
    this.currentAccount = act
    this.persistCurrentAccountToLocalStorage()
  }

  getDefaultZapSats() {
    return this.defaultZapSats
  }

  setDefaultZapSats(sats: number) {
    this.defaultZapSats = sats
    window.localStorage.setItem(StorageKey.DEFAULT_ZAP_SATS, sats.toString())
  }

  getDefaultZapComment() {
    return this.defaultZapComment
  }

  setDefaultZapComment(comment: string) {
    this.defaultZapComment = comment
    window.localStorage.setItem(StorageKey.DEFAULT_ZAP_COMMENT, comment)
  }

  getQuickZap() {
    return this.quickZap
  }

  setQuickZap(quickZap: boolean) {
    this.quickZap = quickZap
    window.localStorage.setItem(StorageKey.QUICK_ZAP, quickZap.toString())
  }

  getLastReadNotificationTime(pubkey: string) {
    return this.lastReadNotificationTimeMap[pubkey] ?? 0
  }

  setLastReadNotificationTime(pubkey: string, time: number) {
    this.lastReadNotificationTimeMap[pubkey] = time
    window.localStorage.setItem(
      StorageKey.LAST_READ_NOTIFICATION_TIME_MAP,
      JSON.stringify(this.lastReadNotificationTimeMap)
    )
  }

  getFeedInfo(pubkey: string) {
    return this.accountFeedInfoMap[pubkey]
  }

  setFeedInfo(info: TFeedInfo, pubkey?: string | null) {
    this.accountFeedInfoMap[pubkey ?? 'default'] = info
    window.localStorage.setItem(
      StorageKey.ACCOUNT_FEED_INFO_MAP,
      JSON.stringify(this.accountFeedInfoMap)
    )
  }

  getAutoplay() {
    return this.autoplay
  }

  setAutoplay(autoplay: boolean) {
    this.autoplay = autoplay
    window.localStorage.setItem(StorageKey.AUTOPLAY, autoplay.toString())
  }

  getVideoLoop() {
    return this.videoLoop
  }

  setVideoLoop(videoLoop: boolean) {
    this.videoLoop = videoLoop
    window.localStorage.setItem(StorageKey.VIDEO_LOOP, videoLoop.toString())
  }

  getTranslationServiceConfig(pubkey?: string | null) {
    return this.translationServiceConfigMap[pubkey ?? '_'] ?? { service: 'jumble' }
  }

  setTranslationServiceConfig(config: TTranslationServiceConfig, pubkey?: string | null) {
    this.translationServiceConfigMap[pubkey ?? '_'] = config
    window.localStorage.setItem(
      StorageKey.TRANSLATION_SERVICE_CONFIG_MAP,
      JSON.stringify(this.translationServiceConfigMap)
    )
  }

  getMediaUploadServiceConfig(pubkey?: string | null): TMediaUploadServiceConfig {
    const defaultConfig = { type: 'blossom' } as const
    if (!pubkey) {
      return defaultConfig
    }
    return this.mediaUploadServiceConfigMap[pubkey] ?? defaultConfig
  }

  setMediaUploadServiceConfig(
    pubkey: string,
    config: TMediaUploadServiceConfig
  ): TMediaUploadServiceConfig {
    this.mediaUploadServiceConfigMap[pubkey] = config
    window.localStorage.setItem(
      StorageKey.MEDIA_UPLOAD_SERVICE_CONFIG_MAP,
      JSON.stringify(this.mediaUploadServiceConfigMap)
    )
    return config
  }

  getDismissedTooManyRelaysAlert() {
    return this.dismissedTooManyRelaysAlert
  }

  setDismissedTooManyRelaysAlert(dismissed: boolean) {
    this.dismissedTooManyRelaysAlert = dismissed
    window.localStorage.setItem(StorageKey.DISMISSED_TOO_MANY_RELAYS_ALERT, dismissed.toString())
  }

  getDismissedDesktopAppTip() {
    return this.dismissedDesktopAppTip
  }

  setDismissedDesktopAppTip(dismissed: boolean) {
    this.dismissedDesktopAppTip = dismissed
    window.localStorage.setItem(StorageKey.DISMISSED_DESKTOP_APP_TIP, dismissed.toString())
  }

  getShowKinds() {
    return this.showKinds
  }

  setShowKinds(kinds: number[]) {
    this.showKinds = kinds
    window.localStorage.setItem(StorageKey.SHOW_KINDS, JSON.stringify(kinds))
  }

  getShowKindsMap() {
    return this.showKindsMap
  }

  getShowKindsForFeed(feedId: string): number[] {
    return this.showKindsMap[feedId] ?? this.showKinds
  }

  setShowKindsForFeed(feedId: string, kinds: number[]) {
    this.showKindsMap = { ...this.showKindsMap, [feedId]: kinds }
    window.localStorage.setItem(StorageKey.SHOW_KINDS_MAP, JSON.stringify(this.showKindsMap))
  }

  clearShowKindsForFeed(feedId: string) {
    const { [feedId]: _, ...rest } = this.showKindsMap
    this.showKindsMap = rest
    window.localStorage.setItem(StorageKey.SHOW_KINDS_MAP, JSON.stringify(this.showKindsMap))
  }

  getHideContentMentioningMutedUsers() {
    return this.hideContentMentioningMutedUsers
  }

  setHideContentMentioningMutedUsers(hide: boolean) {
    this.hideContentMentioningMutedUsers = hide
    window.localStorage.setItem(StorageKey.HIDE_CONTENT_MENTIONING_MUTED_USERS, hide.toString())
  }

  getNotificationListStyle() {
    return this.notificationListStyle
  }

  setNotificationListStyle(style: TNotificationStyle) {
    this.notificationListStyle = style
    window.localStorage.setItem(StorageKey.NOTIFICATION_LIST_STYLE, style)
  }

  getMediaAutoLoadPolicy() {
    return this.mediaAutoLoadPolicy
  }

  setMediaAutoLoadPolicy(policy: TMediaAutoLoadPolicy) {
    this.mediaAutoLoadPolicy = policy
    window.localStorage.setItem(StorageKey.MEDIA_AUTO_LOAD_POLICY, policy)
  }

  getProfilePictureAutoLoadPolicy() {
    return this.profilePictureAutoLoadPolicy
  }

  setProfilePictureAutoLoadPolicy(policy: TProfilePictureAutoLoadPolicy) {
    this.profilePictureAutoLoadPolicy = policy
    window.localStorage.setItem(StorageKey.PROFILE_PICTURE_AUTO_LOAD_POLICY, policy)
  }

  hasShownCreateWalletGuideToast(pubkey: string) {
    return this.shownCreateWalletGuideToastPubkeys.has(pubkey)
  }

  markCreateWalletGuideToastAsShown(pubkey: string) {
    if (this.shownCreateWalletGuideToastPubkeys.has(pubkey)) {
      return
    }
    this.shownCreateWalletGuideToastPubkeys.add(pubkey)
    window.localStorage.setItem(
      StorageKey.SHOWN_CREATE_WALLET_GUIDE_TOAST_PUBKEYS,
      JSON.stringify(Array.from(this.shownCreateWalletGuideToastPubkeys))
    )
  }

  getSidebarCollapse() {
    return this.sidebarCollapse
  }

  setSidebarCollapse(collapse: boolean) {
    this.sidebarCollapse = collapse
    window.localStorage.setItem(StorageKey.SIDEBAR_COLLAPSE, collapse.toString())
  }

  getPrimaryColor() {
    return this.primaryColor
  }

  setPrimaryColor(color: TPrimaryColor) {
    this.primaryColor = color
    window.localStorage.setItem(StorageKey.PRIMARY_COLOR, color)
  }

  getEnableSingleColumnLayout() {
    return this.enableSingleColumnLayout
  }

  setEnableSingleColumnLayout(enable: boolean) {
    this.enableSingleColumnLayout = enable
    window.localStorage.setItem(StorageKey.ENABLE_SINGLE_COLUMN_LAYOUT, enable.toString())
  }

  getFaviconUrlTemplate() {
    return this.faviconUrlTemplate
  }

  setFaviconUrlTemplate(template: string) {
    this.faviconUrlTemplate = template
    window.localStorage.setItem(StorageKey.FAVICON_URL_TEMPLATE, template)
  }

  getFilterOutOnionRelays() {
    return this.filterOutOnionRelays
  }

  setFilterOutOnionRelays(filterOut: boolean) {
    this.filterOutOnionRelays = filterOut
    window.localStorage.setItem(StorageKey.FILTER_OUT_ONION_RELAYS, filterOut.toString())
  }

  getAllowInsecureConnection() {
    return this.allowInsecureConnection
  }

  setAllowInsecureConnection(allow: boolean) {
    this.allowInsecureConnection = allow
    window.localStorage.setItem(StorageKey.ALLOW_INSECURE_CONNECTION, allow.toString())
  }

  getBlossomCacheServerUrl() {
    return this.blossomCacheServerUrl
  }

  setBlossomCacheServerUrl(url: string) {
    this.blossomCacheServerUrl = url
    window.localStorage.setItem(StorageKey.BLOSSOM_CACHE_SERVER_URL, url)
  }

  getBlossomCacheServerEnabled() {
    return this.blossomCacheServerEnabled
  }

  setBlossomCacheServerEnabled(enabled: boolean) {
    this.blossomCacheServerEnabled = enabled
    window.localStorage.setItem(StorageKey.BLOSSOM_CACHE_SERVER_ENABLED, enabled.toString())
  }

  getQuickReaction() {
    return this.quickReaction
  }

  setQuickReaction(quickReaction: boolean) {
    this.quickReaction = quickReaction
    window.localStorage.setItem(StorageKey.QUICK_REACTION, quickReaction.toString())
  }

  getAddClientTag() {
    return this.addClientTag
  }

  setAddClientTag(addClientTag: boolean) {
    this.addClientTag = addClientTag
    window.localStorage.setItem(StorageKey.ADD_CLIENT_TAG, addClientTag.toString())
  }

  getQuickReactionEmoji() {
    return this.quickReactionEmoji
  }

  setQuickReactionEmoji(emoji: string | TEmoji) {
    this.quickReactionEmoji = emoji
    window.localStorage.setItem(
      StorageKey.QUICK_REACTION_EMOJI,
      typeof emoji === 'string' ? emoji : JSON.stringify(emoji)
    )
  }

  getNsfwDisplayPolicy() {
    return this.nsfwDisplayPolicy
  }

  setNsfwDisplayPolicy(policy: TNsfwDisplayPolicy) {
    this.nsfwDisplayPolicy = policy
    window.localStorage.setItem(StorageKey.NSFW_DISPLAY_POLICY, policy)
  }

  getMinTrustScore() {
    return this.minTrustScore
  }

  setMinTrustScore(score: number) {
    if (score >= 0 && score <= 100) {
      this.minTrustScore = score
      window.localStorage.setItem(StorageKey.MIN_TRUST_SCORE, score.toString())
    }
  }

  getMinTrustScoreMap() {
    return this.minTrustScoreMap
  }

  setMinTrustScoreMap(map: Record<string, number>) {
    this.minTrustScoreMap = map
    window.localStorage.setItem(StorageKey.MIN_TRUST_SCORE_MAP, JSON.stringify(map))
  }

  getDefaultRelayUrls() {
    return this.defaultRelayUrls
  }

  setDefaultRelayUrls(urls: string[]) {
    this.defaultRelayUrls = urls
    window.localStorage.setItem(StorageKey.DEFAULT_RELAY_URLS, JSON.stringify(urls))
  }

  getSearchRelayUrls() {
    return this.searchRelayUrls
  }

  setSearchRelayUrls(urls: string[]) {
    this.searchRelayUrls = urls
    window.localStorage.setItem(StorageKey.SEARCH_RELAY_URLS, JSON.stringify(urls))
  }

  getSearchHistory() {
    return this.searchHistory
  }

  addSearchHistory(text: string) {
    if (!text) return
    this.searchHistory = [text, ...this.searchHistory.filter((h) => h !== text)].slice(0, 20)
    window.localStorage.setItem(StorageKey.SEARCH_HISTORY, JSON.stringify(this.searchHistory))
  }

  removeSearchHistory(index: number) {
    this.searchHistory = this.searchHistory.filter((_, i) => i !== index)
    window.localStorage.setItem(StorageKey.SEARCH_HISTORY, JSON.stringify(this.searchHistory))
  }

  clearSearchHistory() {
    this.searchHistory = []
    window.localStorage.removeItem(StorageKey.SEARCH_HISTORY)
  }

  getMutedWords() {
    return this.mutedWords
  }

  setMutedWords(words: string[]) {
    this.mutedWords = words
    window.localStorage.setItem(StorageKey.MUTED_WORDS, JSON.stringify(this.mutedWords))
  }

  getHideIndirectNotifications() {
    return this.hideIndirectNotifications
  }

  setHideIndirectNotifications(onlyShow: boolean) {
    this.hideIndirectNotifications = onlyShow
    window.localStorage.setItem(StorageKey.HIDE_INDIRECT_NOTIFICATIONS, onlyShow.toString())
  }

  getEncryptionKeyPrivkey(accountPubkey: string): string | null {
    return this.encryptionKeyPrivkeyMap[accountPubkey] ?? null
  }

  setEncryptionKeyPrivkey(accountPubkey: string, privkey: string) {
    this.encryptionKeyPrivkeyMap[accountPubkey] = privkey
    this.persistEncryptionKeyMap()
  }

  removeEncryptionKeyPrivkey(accountPubkey: string) {
    delete this.encryptionKeyPrivkeyMap[accountPubkey]
    this.persistEncryptionKeyMap()
  }

  getRetiredEncryptionKeyPrivkeys(accountPubkey: string): { privkey: string; retiredAt: number }[] {
    return this.retiredEncryptionKeyMap[accountPubkey] ?? []
  }

  addRetiredEncryptionKeyPrivkey(accountPubkey: string, privkey: string, retiredAt: number) {
    const list = this.retiredEncryptionKeyMap[accountPubkey] ?? []
    if (list.some((k) => k.privkey === privkey)) return
    // Newest first; age/count pruning is owned by encryptionKeyService.
    list.unshift({ privkey, retiredAt })
    this.retiredEncryptionKeyMap[accountPubkey] = list
    this.persistRetiredEncryptionKeyMap()
  }

  setRetiredEncryptionKeyPrivkeys(
    accountPubkey: string,
    list: { privkey: string; retiredAt: number }[]
  ) {
    if (list.length === 0) {
      delete this.retiredEncryptionKeyMap[accountPubkey]
    } else {
      this.retiredEncryptionKeyMap[accountPubkey] = list
    }
    this.persistRetiredEncryptionKeyMap()
  }

  getLastReadDmTime(accountPubkey: string, conversationPubkey: string): number {
    return this.lastReadDmTimeMap[accountPubkey]?.[conversationPubkey] ?? 0
  }

  setLastReadDmTime(accountPubkey: string, conversationPubkey: string, time: number) {
    if (!this.lastReadDmTimeMap[accountPubkey]) {
      this.lastReadDmTimeMap[accountPubkey] = {}
    }
    this.lastReadDmTimeMap[accountPubkey][conversationPubkey] = time
    window.localStorage.setItem(
      StorageKey.LAST_READ_DM_TIME_MAP,
      JSON.stringify(this.lastReadDmTimeMap)
    )
  }

  clearDmSyncState(accountPubkey: string) {
    delete this.dmLastSyncedAtMap[accountPubkey]
    delete this.dmBackwardCursorMap[accountPubkey]
    window.localStorage.setItem(
      StorageKey.DM_LAST_SYNCED_AT_MAP,
      JSON.stringify(this.dmLastSyncedAtMap)
    )
    window.localStorage.setItem(
      StorageKey.DM_BACKWARD_CURSOR_MAP,
      JSON.stringify(this.dmBackwardCursorMap)
    )
  }

  getDmLastSyncedAt(accountPubkey: string): number {
    return this.dmLastSyncedAtMap[accountPubkey] ?? 0
  }

  setDmLastSyncedAt(accountPubkey: string, time: number) {
    this.dmLastSyncedAtMap[accountPubkey] = time
    window.localStorage.setItem(
      StorageKey.DM_LAST_SYNCED_AT_MAP,
      JSON.stringify(this.dmLastSyncedAtMap)
    )
  }

  getDmBackwardCursor(accountPubkey: string): number | undefined {
    return this.dmBackwardCursorMap[accountPubkey]
  }

  setDmBackwardCursor(accountPubkey: string, cursor: number) {
    this.dmBackwardCursorMap[accountPubkey] = cursor
    window.localStorage.setItem(
      StorageKey.DM_BACKWARD_CURSOR_MAP,
      JSON.stringify(this.dmBackwardCursorMap)
    )
  }

  getProcessedSyncRequestIds(): string[] {
    return Object.keys(this.processedSyncRequestIds)
  }

  hasProcessedSyncRequestId(eventId: string): boolean {
    return eventId in this.processedSyncRequestIds
  }

  addProcessedSyncRequestId(eventId: string) {
    if (!(eventId in this.processedSyncRequestIds)) {
      this.processedSyncRequestIds[eventId] = Date.now()
      this.persistProcessedSyncRequestIds()
    }
  }

  private pruneProcessedSyncRequestIds() {
    const now = Date.now()
    this.processedSyncRequestIds = Object.fromEntries(
      Object.entries(this.processedSyncRequestIds).filter(
        ([, processedAt]) => now - processedAt < PROCESSED_SYNC_REQUEST_ID_RETENTION_MS
      )
    )
  }

  private persistProcessedSyncRequestIds() {
    window.localStorage.setItem(
      StorageKey.PROCESSED_SYNC_REQUEST_IDS,
      JSON.stringify(this.processedSyncRequestIds)
    )
  }

  getDisableNotificationSync() {
    return this.disableNotificationSync
  }

  setDisableNotificationSync(disable: boolean) {
    this.disableNotificationSync = disable
    window.localStorage.setItem(StorageKey.DISABLE_NOTIFICATION_SYNC, disable.toString())
  }
}

const instance = new LocalStorageService()
export default instance
