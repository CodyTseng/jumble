import {
  ALLOWED_FILTER_KINDS,
  BIG_RELAY_URLS,
  DEFAULT_FAVICON_URL_TEMPLATE,
  DEFAULT_NIP_96_SERVICE,
  ExtendedKind,
  MEDIA_AUTO_LOAD_POLICY,
  NOTIFICATION_LIST_STYLE,
  NSFW_DISPLAY_POLICY,
  PROFILE_PICTURE_AUTO_LOAD_POLICY,
  StorageKey,
  TPrimaryColor
} from '@/constants'
import { isSameAccount } from '@/lib/account'
import { randomString } from '@/lib/random'
import { isTorBrowser } from '@/lib/utils'
import {
  TAccount,
  TAccountPointer,
  TEmoji,
  TFeedInfo,
  TMediaAutoLoadPolicy,
  TMediaUploadServiceConfig,
  TNoteListMode,
  TNotificationStyle,
  TNsfwDisplayPolicy,
  TProfilePictureAutoLoadPolicy,
  TRelaySet,
  TThemeSetting,
  TTranslationServiceConfig
} from '@/types'
import { kinds } from 'nostr-tools'

class LocalStorageService {
  static instance: LocalStorageService

  private relaySets: TRelaySet[] = []
  private themeSetting: TThemeSetting = 'system'
  private accounts: TAccount[] = []
  private currentAccount: TAccount | null = null
  private noteListMode: TNoteListMode = 'posts'
  private lastReadNotificationTimeMap: Record<string, number> = {}
  private defaultZapSats: number = 21
  private defaultZapComment: string = 'Zap!'
  private quickZap: boolean = false
  private accountFeedInfoMap: Record<string, TFeedInfo | undefined> = {}
  private mediaUploadService: string = DEFAULT_NIP_96_SERVICE
  private autoplay: boolean = true
  private videoLoop: boolean = false
  private translationServiceConfigMap: Record<string, TTranslationServiceConfig> = {}
  private mediaUploadServiceConfigMap: Record<string, TMediaUploadServiceConfig> = {}
  private dismissedTooManyRelaysAlert: boolean = false
  private showKinds: number[] = []
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
  private quickReaction: boolean = false
  private quickReactionEmoji: string | TEmoji = '+'
  private nsfwDisplayPolicy: TNsfwDisplayPolicy = NSFW_DISPLAY_POLICY.HIDE_CONTENT
  private defaultRelayUrls: string[] = BIG_RELAY_URLS
  private mutedWords: string[] = []
  private minTrustScore: number = 0
  private minTrustScoreMap: Record<string, number> = {}
  private hideIndirectNotifications: boolean = false
  private encryptionKeyPrivkeyMap: Record<string, string> = {}
  private clientKeyPrivkeyMap: Record<string, string> = {}
  private lastReadDmTimeMap: Record<string, Record<string, number>> = {}
  private dmLastSyncedAtMap: Record<string, number> = {}
  private dmBackwardCursorMap: Record<string, number> = {}
  private processedSyncRequestIds: string[] = []

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
    const noteListModeStr = window.localStorage.getItem(StorageKey.NOTE_LIST_MODE)
    this.noteListMode =
      noteListModeStr && ['posts', 'postsAndReplies', '24h'].includes(noteListModeStr)
        ? (noteListModeStr as TNoteListMode)
        : 'posts'
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

    // deprecated
    this.mediaUploadService =
      window.localStorage.getItem(StorageKey.MEDIA_UPLOAD_SERVICE) ?? DEFAULT_NIP_96_SERVICE

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
    if (
      profilePictureAutoLoadPolicy &&
      Object.values(PROFILE_PICTURE_AUTO_LOAD_POLICY).includes(
        profilePictureAutoLoadPolicy as TProfilePictureAutoLoadPolicy
      )
    ) {
      this.profilePictureAutoLoadPolicy =
        profilePictureAutoLoadPolicy as TProfilePictureAutoLoadPolicy
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

    this.quickReaction = window.localStorage.getItem(StorageKey.QUICK_REACTION) === 'true'
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

    const clientKeyPrivkeyMapStr = window.localStorage.getItem(StorageKey.CLIENT_KEY_PRIVKEY_MAP)
    if (clientKeyPrivkeyMapStr) {
      try {
        const map = JSON.parse(clientKeyPrivkeyMapStr)
        if (typeof map === 'object' && map !== null) {
          this.clientKeyPrivkeyMap = map
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

    const dmBackwardCursorMapStr = window.localStorage.getItem(
      StorageKey.DM_BACKWARD_CURSOR_MAP
    )
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
        const arr = JSON.parse(processedSyncRequestIdsStr)
        if (Array.isArray(arr)) {
          this.processedSyncRequestIds = arr
        }
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

  getNoteListMode() {
    return this.noteListMode
  }

  setNoteListMode(mode: TNoteListMode) {
    window.localStorage.setItem(StorageKey.NOTE_LIST_MODE, mode)
    this.noteListMode = mode
  }

  getAccounts() {
    return this.accounts
  }

  findAccount(account: TAccountPointer) {
    return this.accounts.find((act) => isSameAccount(act, account))
  }

  getCurrentAccount() {
    return this.currentAccount
  }

  getAccountNsec(pubkey: string) {
    const account = this.accounts.find((act) => act.pubkey === pubkey && act.signerType === 'nsec')
    return account?.nsec
  }

  getAccountNcryptsec(pubkey: string) {
    const account = this.accounts.find(
      (act) => act.pubkey === pubkey && act.signerType === 'ncryptsec'
    )
    return account?.ncryptsec
  }

  addAccount(account: TAccount) {
    const index = this.accounts.findIndex((act) => isSameAccount(act, account))
    if (index !== -1) {
      this.accounts[index] = account
    } else {
      this.accounts.push(account)
    }
    window.localStorage.setItem(StorageKey.ACCOUNTS, JSON.stringify(this.accounts))
    return this.accounts
  }

  removeAccount(account: TAccount) {
    this.accounts = this.accounts.filter((act) => !isSameAccount(act, account))
    window.localStorage.setItem(StorageKey.ACCOUNTS, JSON.stringify(this.accounts))
    return this.accounts
  }

  switchAccount(account: TAccount | null) {
    if (isSameAccount(this.currentAccount, account)) {
      return
    }
    const act = this.accounts.find((act) => isSameAccount(act, account))
    if (!act) {
      return
    }
    this.currentAccount = act
    window.localStorage.setItem(StorageKey.CURRENT_ACCOUNT, JSON.stringify(act))
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
    const defaultConfig = { type: 'nip96', service: this.mediaUploadService } as const
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

  getShowKinds() {
    return this.showKinds
  }

  setShowKinds(kinds: number[]) {
    this.showKinds = kinds
    window.localStorage.setItem(StorageKey.SHOW_KINDS, JSON.stringify(kinds))
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

  getQuickReaction() {
    return this.quickReaction
  }

  setQuickReaction(quickReaction: boolean) {
    this.quickReaction = quickReaction
    window.localStorage.setItem(StorageKey.QUICK_REACTION, quickReaction.toString())
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
    window.localStorage.setItem(
      StorageKey.ENCRYPTION_KEY_PRIVKEY_MAP,
      JSON.stringify(this.encryptionKeyPrivkeyMap)
    )
  }

  removeEncryptionKeyPrivkey(accountPubkey: string) {
    delete this.encryptionKeyPrivkeyMap[accountPubkey]
    window.localStorage.setItem(
      StorageKey.ENCRYPTION_KEY_PRIVKEY_MAP,
      JSON.stringify(this.encryptionKeyPrivkeyMap)
    )
  }

  getClientKeyPrivkey(accountPubkey: string): string | null {
    return this.clientKeyPrivkeyMap[accountPubkey] ?? null
  }

  setClientKeyPrivkey(accountPubkey: string, privkey: string) {
    this.clientKeyPrivkeyMap[accountPubkey] = privkey
    window.localStorage.setItem(
      StorageKey.CLIENT_KEY_PRIVKEY_MAP,
      JSON.stringify(this.clientKeyPrivkeyMap)
    )
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
    return this.processedSyncRequestIds
  }

  addProcessedSyncRequestId(eventId: string) {
    if (!this.processedSyncRequestIds.includes(eventId)) {
      this.processedSyncRequestIds.push(eventId)
      window.localStorage.setItem(
        StorageKey.PROCESSED_SYNC_REQUEST_IDS,
        JSON.stringify(this.processedSyncRequestIds)
      )
    }
  }
}

const instance = new LocalStorageService()
export default instance
