import {
  BUTTON_RADIUS_VALUES,
  CARD_RADIUS_VALUES,
  DEFAULT_BUTTON_RADIUS,
  DEFAULT_CARD_RADIUS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TITLE_FONT_SIZE,
  DEFAULT_LOGO_FONT_SIZE,
  DEFAULT_NIP_96_SERVICE,
  DEFAULT_PAGE_THEME,
  DEFAULT_POST_BUTTON_STYLE,
  DEFAULT_PRIMARY_COLOR,
  DISTRACTION_FREE_MODE,
  ExtendedKind,
  FONT_FAMILIES,
  FONT_SIZES,
  TITLE_FONT_SIZES,
  LOGO_FONT_SIZES,
  MEDIA_AUTO_LOAD_POLICY,
  NOTIFICATION_LIST_STYLE,
  POST_BUTTON_STYLE,
  PRIMARY_COLORS,
  SUPPORTED_KINDS,
  StorageKey,
  TZapSound,
  ZAP_SOUNDS
} from '@/constants'
import { isSameAccount } from '@/lib/account'
import { randomString } from '@/lib/random'
import {
  TAccount,
  TAccountPointer,
  TAIServiceConfig,
  TAIToolsConfig,
  TCustomFeed,
  TDistractionFreeMode,
  TFeedInfo,
  TFontFamily,
  TMediaAutoLoadPolicy,
  TMediaUploadServiceConfig,
  TNoteListMode,
  TNotificationStyle,
  TPageTheme,
  TPostButtonStyle,
  TPrimaryColor,
  TRelaySet,
  TThemeSetting,
  TTranslationServiceConfig,
  TColorPalette,
  TLogoStyle
} from '@/types'

class LocalStorageService {
  static instance: LocalStorageService

  private relaySets: TRelaySet[] = []
  private themeSetting: TThemeSetting = 'system'
  private colorPalette: TColorPalette = 'default'
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
  private hideUntrustedInteractions: boolean = false
  private hideUntrustedNotifications: boolean = false
  private hideUntrustedNotes: boolean = false
  private translationServiceConfigMap: Record<string, TTranslationServiceConfig> = {}
  private mediaUploadServiceConfigMap: Record<string, TMediaUploadServiceConfig> = {}
  private aiServiceConfigMap: Record<string, TAIServiceConfig> = {}
  private aiToolsConfigMap: Record<string, TAIToolsConfig> = {}
  private defaultShowNsfw: boolean = false
  private dismissedTooManyRelaysAlert: boolean = false
  private showKinds: number[] = []
  private hideContentMentioningMutedUsers: boolean = false
  private alwaysHideMutedNotes: boolean = false
  private hideNotificationsFromMutedUsers: boolean = false
  private notificationListStyle: TNotificationStyle = NOTIFICATION_LIST_STYLE.DETAILED
  private mediaAutoLoadPolicy: TMediaAutoLoadPolicy = MEDIA_AUTO_LOAD_POLICY.ALWAYS
  private shownCreateWalletGuideToastPubkeys: Set<string> = new Set()
  private fontSize: number = DEFAULT_FONT_SIZE
  private titleFontSize: number = DEFAULT_TITLE_FONT_SIZE
  private fontFamily: TFontFamily = DEFAULT_FONT_FAMILY
  private primaryColor: TPrimaryColor = DEFAULT_PRIMARY_COLOR
  private buttonRadius: number = DEFAULT_BUTTON_RADIUS
  private postButtonStyle: TPostButtonStyle = DEFAULT_POST_BUTTON_STYLE
  private cardRadius: number = DEFAULT_CARD_RADIUS
  private pageTheme: TPageTheme = DEFAULT_PAGE_THEME
  private trendingNotesDismissed: boolean = false
  private compactSidebar: boolean = false
  private logoStyle: TLogoStyle = 'image'
  private customLogoText: string = 'Jumble'
  private logoFontSize: number = DEFAULT_LOGO_FONT_SIZE
  private widgetSidebarTitle: string = 'Widgets'
  private widgetSidebarIcon: string | null = null
  private enabledWidgets: string[] = []
  private pinnedNoteWidgets: { id: string; eventId: string }[] = []
  private aiPromptWidgets: { id: string; eventId: string; messages: any[] }[] = []
  private trendingNotesHeight: 'short' | 'medium' | 'tall' | 'remaining' = 'medium'
  private bitcoinTickerAlignment: 'left' | 'center' = 'left'
  private bitcoinTickerTextSize: 'large' | 'small' = 'large'
  private bitcoinTickerShowBlockHeight: boolean = false
  private zapSound: TZapSound = ZAP_SOUNDS.NONE
  private customFeeds: TCustomFeed[] = []
  private chargeZapEnabled: boolean = false
  private chargeZapLimit: number = 1000
  private zapOnReactions: boolean = false
  private onlyZapsMode: boolean = false
  private distractionFreeMode: TDistractionFreeMode = DISTRACTION_FREE_MODE.DRAIN_MY_TIME
  private hideReadsInNavigation: boolean = false
  private hideReadsInProfiles: boolean = false
  private favoriteListsMap: Record<string, string[]> = {}

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
    this.colorPalette =
      (window.localStorage.getItem(StorageKey.COLOR_PALETTE) as TColorPalette) ?? 'default'
    const accountsStr = window.localStorage.getItem(StorageKey.ACCOUNTS)
    this.accounts = accountsStr ? JSON.parse(accountsStr) : []
    const currentAccountStr = window.localStorage.getItem(StorageKey.CURRENT_ACCOUNT)
    this.currentAccount = currentAccountStr ? JSON.parse(currentAccountStr) : null
    const noteListModeStr = window.localStorage.getItem(StorageKey.NOTE_LIST_MODE)
    this.noteListMode =
      noteListModeStr && ['posts', 'postsAndReplies', 'pictures'].includes(noteListModeStr)
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

    const hideUntrustedEvents =
      window.localStorage.getItem(StorageKey.HIDE_UNTRUSTED_EVENTS) === 'true'
    const storedHideUntrustedInteractions = window.localStorage.getItem(
      StorageKey.HIDE_UNTRUSTED_INTERACTIONS
    )
    const storedHideUntrustedNotifications = window.localStorage.getItem(
      StorageKey.HIDE_UNTRUSTED_NOTIFICATIONS
    )
    const storedHideUntrustedNotes = window.localStorage.getItem(StorageKey.HIDE_UNTRUSTED_NOTES)
    this.hideUntrustedInteractions = storedHideUntrustedInteractions
      ? storedHideUntrustedInteractions === 'true'
      : hideUntrustedEvents
    this.hideUntrustedNotifications = storedHideUntrustedNotifications
      ? storedHideUntrustedNotifications === 'true'
      : hideUntrustedEvents
    this.hideUntrustedNotes = storedHideUntrustedNotes
      ? storedHideUntrustedNotes === 'true'
      : hideUntrustedEvents

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

    const aiServiceConfigMapStr = window.localStorage.getItem(StorageKey.AI_SERVICE_CONFIG_MAP)
    if (aiServiceConfigMapStr) {
      this.aiServiceConfigMap = JSON.parse(aiServiceConfigMapStr)
    }

    const aiToolsConfigMapStr = window.localStorage.getItem(StorageKey.AI_TOOLS_CONFIG_MAP)
    if (aiToolsConfigMapStr) {
      this.aiToolsConfigMap = JSON.parse(aiToolsConfigMapStr)
    }

    this.defaultShowNsfw = window.localStorage.getItem(StorageKey.DEFAULT_SHOW_NSFW) === 'true'

    this.dismissedTooManyRelaysAlert =
      window.localStorage.getItem(StorageKey.DISMISSED_TOO_MANY_RELAYS_ALERT) === 'true'

    const showKindsStr = window.localStorage.getItem(StorageKey.SHOW_KINDS)
    if (!showKindsStr) {
      this.showKinds = SUPPORTED_KINDS
    } else {
      const showKindsVersionStr = window.localStorage.getItem(StorageKey.SHOW_KINDS_VERSION)
      const showKindsVersion = showKindsVersionStr ? parseInt(showKindsVersionStr) : 0
      const showKinds = JSON.parse(showKindsStr) as number[]
      if (showKindsVersion < 1) {
        showKinds.push(ExtendedKind.VIDEO, ExtendedKind.SHORT_VIDEO)
      }
      this.showKinds = showKinds
    }
    window.localStorage.setItem(StorageKey.SHOW_KINDS, JSON.stringify(this.showKinds))
    window.localStorage.setItem(StorageKey.SHOW_KINDS_VERSION, '1')

    this.hideContentMentioningMutedUsers =
      window.localStorage.getItem(StorageKey.HIDE_CONTENT_MENTIONING_MUTED_USERS) === 'true'

    this.alwaysHideMutedNotes =
      window.localStorage.getItem(StorageKey.ALWAYS_HIDE_MUTED_NOTES) === 'true'

    this.hideNotificationsFromMutedUsers =
      window.localStorage.getItem(StorageKey.HIDE_NOTIFICATIONS_FROM_MUTED_USERS) === 'true'

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

    const shownCreateWalletGuideToastPubkeysStr = window.localStorage.getItem(
      StorageKey.SHOWN_CREATE_WALLET_GUIDE_TOAST_PUBKEYS
    )
    this.shownCreateWalletGuideToastPubkeys = shownCreateWalletGuideToastPubkeysStr
      ? new Set(JSON.parse(shownCreateWalletGuideToastPubkeysStr))
      : new Set()

    const fontSizeStr = window.localStorage.getItem(StorageKey.FONT_SIZE)
    if (fontSizeStr) {
      const fontSize = parseInt(fontSizeStr)
      if (FONT_SIZES.includes(fontSize as any)) {
        this.fontSize = fontSize
      }
    }

    const titleFontSizeStr = window.localStorage.getItem(StorageKey.TITLE_FONT_SIZE)
    if (titleFontSizeStr) {
      const titleFontSize = parseInt(titleFontSizeStr)
      if (TITLE_FONT_SIZES.includes(titleFontSize as any)) {
        this.titleFontSize = titleFontSize
      }
    }

    const fontFamily = window.localStorage.getItem(StorageKey.FONT_FAMILY)
    if (fontFamily && Object.keys(FONT_FAMILIES).includes(fontFamily)) {
      this.fontFamily = fontFamily as TFontFamily
    }

    const primaryColor = window.localStorage.getItem(StorageKey.PRIMARY_COLOR)
    if (primaryColor && Object.keys(PRIMARY_COLORS).includes(primaryColor)) {
      this.primaryColor = primaryColor as TPrimaryColor
    }

    const buttonRadiusStr = window.localStorage.getItem(StorageKey.BUTTON_RADIUS)
    if (buttonRadiusStr) {
      const buttonRadius = parseInt(buttonRadiusStr)
      if (BUTTON_RADIUS_VALUES.includes(buttonRadius as any)) {
        this.buttonRadius = buttonRadius
      }
    }

    const postButtonStyle = window.localStorage.getItem(StorageKey.POST_BUTTON_STYLE)
    if (postButtonStyle && (postButtonStyle === POST_BUTTON_STYLE.FILLED || postButtonStyle === POST_BUTTON_STYLE.OUTLINED)) {
      this.postButtonStyle = postButtonStyle as TPostButtonStyle
    }

    const cardRadiusStr = window.localStorage.getItem(StorageKey.CARD_RADIUS)
    if (cardRadiusStr) {
      const cardRadius = parseInt(cardRadiusStr)
      if (CARD_RADIUS_VALUES.includes(cardRadius as any)) {
        this.cardRadius = cardRadius
      }
    }

    const pageTheme = window.localStorage.getItem(StorageKey.PAGE_THEME)
    if (pageTheme && ['default', 'pure-black'].includes(pageTheme)) {
      this.pageTheme = pageTheme as TPageTheme
    }

    this.trendingNotesDismissed =
      window.localStorage.getItem(StorageKey.TRENDING_NOTES_DISMISSED) === 'true'

    this.compactSidebar =
      window.localStorage.getItem(StorageKey.COMPACT_SIDEBAR) === 'true'

    const logoStyle = window.localStorage.getItem(StorageKey.LOGO_STYLE)
    if (logoStyle && ['image', 'text'].includes(logoStyle)) {
      this.logoStyle = logoStyle as TLogoStyle
    }

    const customLogoText = window.localStorage.getItem(StorageKey.CUSTOM_LOGO_TEXT)
    if (customLogoText) {
      this.customLogoText = customLogoText
    }

    const logoFontSize = window.localStorage.getItem(StorageKey.LOGO_FONT_SIZE)
    if (logoFontSize) {
      const size = Number(logoFontSize)
      if (LOGO_FONT_SIZES.includes(size as any)) {
        this.logoFontSize = size
      }
    }

    const widgetSidebarTitle = window.localStorage.getItem(StorageKey.WIDGET_SIDEBAR_TITLE)
    if (widgetSidebarTitle) {
      this.widgetSidebarTitle = widgetSidebarTitle
    }

    const widgetSidebarIcon = window.localStorage.getItem(StorageKey.WIDGET_SIDEBAR_ICON)
    if (widgetSidebarIcon) {
      this.widgetSidebarIcon = widgetSidebarIcon
    }

    const enabledWidgetsStr = window.localStorage.getItem(StorageKey.ENABLED_WIDGETS)
    if (enabledWidgetsStr) {
      this.enabledWidgets = JSON.parse(enabledWidgetsStr)
    } else {
      // Default to tour and trending notes enabled for new users
      this.enabledWidgets = ['tour', 'trending-notes']
      window.localStorage.setItem(StorageKey.ENABLED_WIDGETS, JSON.stringify(this.enabledWidgets))
    }

    const pinnedNoteWidgetsStr = window.localStorage.getItem(StorageKey.PINNED_NOTE_WIDGETS)
    if (pinnedNoteWidgetsStr) {
      this.pinnedNoteWidgets = JSON.parse(pinnedNoteWidgetsStr)
    }

    // AI Prompt widgets are session-only and should not persist across page reloads
    // Clear any stored AI prompt widgets
    this.aiPromptWidgets = []
    window.localStorage.removeItem(StorageKey.AI_PROMPT_WIDGETS)

    const trendingNotesHeight = window.localStorage.getItem(StorageKey.TRENDING_NOTES_HEIGHT)
    if (trendingNotesHeight && ['short', 'medium', 'tall', 'remaining'].includes(trendingNotesHeight)) {
      this.trendingNotesHeight = trendingNotesHeight as 'short' | 'medium' | 'tall' | 'remaining'
    }

    const bitcoinTickerAlignment = window.localStorage.getItem(StorageKey.BITCOIN_TICKER_ALIGNMENT)
    if (bitcoinTickerAlignment && ['left', 'center'].includes(bitcoinTickerAlignment)) {
      this.bitcoinTickerAlignment = bitcoinTickerAlignment as 'left' | 'center'
    }

    const bitcoinTickerTextSize = window.localStorage.getItem(StorageKey.BITCOIN_TICKER_TEXT_SIZE)
    if (bitcoinTickerTextSize && ['large', 'small'].includes(bitcoinTickerTextSize)) {
      this.bitcoinTickerTextSize = bitcoinTickerTextSize as 'large' | 'small'
    }

    const bitcoinTickerShowBlockHeight = window.localStorage.getItem(StorageKey.BITCOIN_TICKER_SHOW_BLOCK_HEIGHT)
    if (bitcoinTickerShowBlockHeight !== null) {
      this.bitcoinTickerShowBlockHeight = bitcoinTickerShowBlockHeight === 'true'
    }

    const zapSound = window.localStorage.getItem(StorageKey.ZAP_SOUND)
    if (zapSound && Object.values(ZAP_SOUNDS).includes(zapSound as TZapSound)) {
      this.zapSound = zapSound as TZapSound
    }

    const customFeedsStr = window.localStorage.getItem(StorageKey.CUSTOM_FEEDS)
    if (customFeedsStr) {
      this.customFeeds = JSON.parse(customFeedsStr)
    }

    this.chargeZapEnabled = window.localStorage.getItem(StorageKey.CHARGE_ZAP_ENABLED) === 'true'

    const chargeZapLimitStr = window.localStorage.getItem(StorageKey.CHARGE_ZAP_LIMIT)
    if (chargeZapLimitStr) {
      const num = parseInt(chargeZapLimitStr)
      if (!isNaN(num) && num > 0) {
        this.chargeZapLimit = num
      }
    }

    this.zapOnReactions = window.localStorage.getItem(StorageKey.ZAP_ON_REACTIONS) === 'true'

    this.onlyZapsMode = window.localStorage.getItem(StorageKey.ONLY_ZAPS_MODE) === 'true'

    const distractionFreeMode = window.localStorage.getItem(StorageKey.DISTRACTION_FREE_MODE)
    if (
      distractionFreeMode &&
      Object.values(DISTRACTION_FREE_MODE).includes(distractionFreeMode as TDistractionFreeMode)
    ) {
      this.distractionFreeMode = distractionFreeMode as TDistractionFreeMode
    }

    this.hideReadsInNavigation =
      window.localStorage.getItem(StorageKey.HIDE_READS_IN_NAVIGATION) === 'true'

    this.hideReadsInProfiles =
      window.localStorage.getItem(StorageKey.HIDE_READS_IN_PROFILES) === 'true'

    const favoriteListsMapStr = window.localStorage.getItem(StorageKey.FAVORITE_LISTS)
    if (favoriteListsMapStr) {
      try {
        const parsed = JSON.parse(favoriteListsMapStr)
        // Handle migration from old array format to new map format
        if (Array.isArray(parsed)) {
          this.favoriteListsMap = { _global: parsed }
        } else {
          this.favoriteListsMap = parsed
        }
      } catch {
        this.favoriteListsMap = {}
      }
    }

    // Clean up deprecated data
    window.localStorage.removeItem(StorageKey.ACCOUNT_PROFILE_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_FOLLOW_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_RELAY_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_MUTE_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_MUTE_DECRYPTED_TAGS_MAP)
    window.localStorage.removeItem(StorageKey.ACTIVE_RELAY_SET_ID)
    window.localStorage.removeItem(StorageKey.FEED_TYPE)
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

  getColorPalette() {
    return this.colorPalette
  }

  setColorPalette(colorPalette: TColorPalette) {
    window.localStorage.setItem(StorageKey.COLOR_PALETTE, colorPalette)
    this.colorPalette = colorPalette
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

  getChargeZapEnabled() {
    return this.chargeZapEnabled
  }

  setChargeZapEnabled(enabled: boolean) {
    this.chargeZapEnabled = enabled
    window.localStorage.setItem(StorageKey.CHARGE_ZAP_ENABLED, enabled.toString())
  }

  getChargeZapLimit() {
    return this.chargeZapLimit
  }

  setChargeZapLimit(limit: number) {
    this.chargeZapLimit = limit
    window.localStorage.setItem(StorageKey.CHARGE_ZAP_LIMIT, limit.toString())
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

  getHideUntrustedInteractions() {
    return this.hideUntrustedInteractions
  }

  setHideUntrustedInteractions(hideUntrustedInteractions: boolean) {
    this.hideUntrustedInteractions = hideUntrustedInteractions
    window.localStorage.setItem(
      StorageKey.HIDE_UNTRUSTED_INTERACTIONS,
      hideUntrustedInteractions.toString()
    )
  }

  getHideUntrustedNotifications() {
    return this.hideUntrustedNotifications
  }

  setHideUntrustedNotifications(hideUntrustedNotifications: boolean) {
    this.hideUntrustedNotifications = hideUntrustedNotifications
    window.localStorage.setItem(
      StorageKey.HIDE_UNTRUSTED_NOTIFICATIONS,
      hideUntrustedNotifications.toString()
    )
  }

  getHideUntrustedNotes() {
    return this.hideUntrustedNotes
  }

  setHideUntrustedNotes(hideUntrustedNotes: boolean) {
    this.hideUntrustedNotes = hideUntrustedNotes
    window.localStorage.setItem(StorageKey.HIDE_UNTRUSTED_NOTES, hideUntrustedNotes.toString())
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

  getDefaultShowNsfw() {
    return this.defaultShowNsfw
  }

  setDefaultShowNsfw(defaultShowNsfw: boolean) {
    this.defaultShowNsfw = defaultShowNsfw
    window.localStorage.setItem(StorageKey.DEFAULT_SHOW_NSFW, defaultShowNsfw.toString())
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

  getAlwaysHideMutedNotes() {
    return this.alwaysHideMutedNotes
  }

  setAlwaysHideMutedNotes(hide: boolean) {
    this.alwaysHideMutedNotes = hide
    window.localStorage.setItem(StorageKey.ALWAYS_HIDE_MUTED_NOTES, hide.toString())
  }

  getHideNotificationsFromMutedUsers() {
    return this.hideNotificationsFromMutedUsers
  }

  setHideNotificationsFromMutedUsers(hide: boolean) {
    this.hideNotificationsFromMutedUsers = hide
    window.localStorage.setItem(StorageKey.HIDE_NOTIFICATIONS_FROM_MUTED_USERS, hide.toString())
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

  getDistractionFreeMode() {
    return this.distractionFreeMode
  }

  setDistractionFreeMode(mode: TDistractionFreeMode) {
    this.distractionFreeMode = mode
    window.localStorage.setItem(StorageKey.DISTRACTION_FREE_MODE, mode)
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

  getFontSize() {
    return this.fontSize
  }

  setFontSize(fontSize: number) {
    if (!FONT_SIZES.includes(fontSize as any)) {
      return
    }
    this.fontSize = fontSize
    window.localStorage.setItem(StorageKey.FONT_SIZE, fontSize.toString())
  }

  getTitleFontSize() {
    return this.titleFontSize
  }

  setTitleFontSize(titleFontSize: number) {
    if (!TITLE_FONT_SIZES.includes(titleFontSize as any)) {
      return
    }
    this.titleFontSize = titleFontSize
    window.localStorage.setItem(StorageKey.TITLE_FONT_SIZE, titleFontSize.toString())
  }

  getFontFamily() {
    return this.fontFamily
  }

  setFontFamily(fontFamily: TFontFamily) {
    if (!Object.keys(FONT_FAMILIES).includes(fontFamily)) {
      return
    }
    this.fontFamily = fontFamily
    window.localStorage.setItem(StorageKey.FONT_FAMILY, fontFamily)
  }

  getPrimaryColor() {
    return this.primaryColor
  }

  setPrimaryColor(color: TPrimaryColor) {
    this.primaryColor = color
    window.localStorage.setItem(StorageKey.PRIMARY_COLOR, color)
  }

  getButtonRadius() {
    return this.buttonRadius
  }

  setButtonRadius(radius: number) {
    if (!BUTTON_RADIUS_VALUES.includes(radius as any)) {
      return
    }
    this.buttonRadius = radius
    window.localStorage.setItem(StorageKey.BUTTON_RADIUS, radius.toString())
  }

  getPostButtonStyle() {
    return this.postButtonStyle
  }

  setPostButtonStyle(style: TPostButtonStyle) {
    if (style !== POST_BUTTON_STYLE.FILLED && style !== POST_BUTTON_STYLE.OUTLINED) {
      return
    }
    this.postButtonStyle = style
    window.localStorage.setItem(StorageKey.POST_BUTTON_STYLE, style)
  }

  getCardRadius() {
    return this.cardRadius
  }

  setCardRadius(radius: number) {
    if (!CARD_RADIUS_VALUES.includes(radius as any)) {
      return
    }
    this.cardRadius = radius
    window.localStorage.setItem(StorageKey.CARD_RADIUS, radius.toString())
  }

  getPageTheme() {
    return this.pageTheme
  }

  setPageTheme(pageTheme: TPageTheme) {
    this.pageTheme = pageTheme
    window.localStorage.setItem(StorageKey.PAGE_THEME, pageTheme)
  }

  getTrendingNotesDismissed() {
    return this.trendingNotesDismissed
  }

  setTrendingNotesDismissed(dismissed: boolean) {
    this.trendingNotesDismissed = dismissed
    window.localStorage.setItem(StorageKey.TRENDING_NOTES_DISMISSED, dismissed.toString())
  }

  getCompactSidebar() {
    return this.compactSidebar
  }

  setCompactSidebar(compact: boolean) {
    this.compactSidebar = compact
    window.localStorage.setItem(StorageKey.COMPACT_SIDEBAR, compact.toString())
  }

  getLogoStyle() {
    return this.logoStyle
  }

  setLogoStyle(style: TLogoStyle) {
    this.logoStyle = style
    window.localStorage.setItem(StorageKey.LOGO_STYLE, style)
  }

  getCustomLogoText() {
    return this.customLogoText
  }

  setCustomLogoText(text: string) {
    this.customLogoText = text
    window.localStorage.setItem(StorageKey.CUSTOM_LOGO_TEXT, text)
  }

  getLogoFontSize() {
    return this.logoFontSize
  }

  setLogoFontSize(size: number) {
    this.logoFontSize = size
    window.localStorage.setItem(StorageKey.LOGO_FONT_SIZE, size.toString())
  }

  getWidgetSidebarTitle() {
    return this.widgetSidebarTitle
  }

  setWidgetSidebarTitle(title: string) {
    this.widgetSidebarTitle = title
    window.localStorage.setItem(StorageKey.WIDGET_SIDEBAR_TITLE, title)
  }

  getWidgetSidebarIcon() {
    return this.widgetSidebarIcon
  }

  setWidgetSidebarIcon(icon: string | null) {
    this.widgetSidebarIcon = icon
    if (icon === null) {
      window.localStorage.removeItem(StorageKey.WIDGET_SIDEBAR_ICON)
    } else {
      window.localStorage.setItem(StorageKey.WIDGET_SIDEBAR_ICON, icon)
    }
  }

  getEnabledWidgets() {
    return this.enabledWidgets
  }

  setEnabledWidgets(widgets: string[]) {
    this.enabledWidgets = widgets
    window.localStorage.setItem(StorageKey.ENABLED_WIDGETS, JSON.stringify(widgets))
  }

  getTrendingNotesHeight() {
    return this.trendingNotesHeight
  }

  setTrendingNotesHeight(height: 'short' | 'medium' | 'tall' | 'remaining') {
    this.trendingNotesHeight = height
    window.localStorage.setItem(StorageKey.TRENDING_NOTES_HEIGHT, height)
  }

  getBitcoinTickerAlignment() {
    return this.bitcoinTickerAlignment
  }

  setBitcoinTickerAlignment(alignment: 'left' | 'center') {
    this.bitcoinTickerAlignment = alignment
    window.localStorage.setItem(StorageKey.BITCOIN_TICKER_ALIGNMENT, alignment)
  }

  getBitcoinTickerTextSize() {
    return this.bitcoinTickerTextSize
  }

  setBitcoinTickerTextSize(size: 'large' | 'small') {
    this.bitcoinTickerTextSize = size
    window.localStorage.setItem(StorageKey.BITCOIN_TICKER_TEXT_SIZE, size)
  }

  getBitcoinTickerShowBlockHeight() {
    return this.bitcoinTickerShowBlockHeight
  }

  setBitcoinTickerShowBlockHeight(show: boolean) {
    this.bitcoinTickerShowBlockHeight = show
    window.localStorage.setItem(StorageKey.BITCOIN_TICKER_SHOW_BLOCK_HEIGHT, show.toString())
  }

  getPinnedNoteWidgets() {
    return this.pinnedNoteWidgets
  }

  setPinnedNoteWidgets(widgets: { id: string; eventId: string }[]) {
    this.pinnedNoteWidgets = widgets
    window.localStorage.setItem(StorageKey.PINNED_NOTE_WIDGETS, JSON.stringify(widgets))
  }

  addPinnedNoteWidget(eventId: string) {
    const id = `pinned-note-${Date.now()}`
    this.pinnedNoteWidgets.push({ id, eventId })
    window.localStorage.setItem(StorageKey.PINNED_NOTE_WIDGETS, JSON.stringify(this.pinnedNoteWidgets))
    return id
  }

  removePinnedNoteWidget(id: string) {
    this.pinnedNoteWidgets = this.pinnedNoteWidgets.filter((widget) => widget.id !== id)
    window.localStorage.setItem(StorageKey.PINNED_NOTE_WIDGETS, JSON.stringify(this.pinnedNoteWidgets))
  }

  getAIPromptWidgets() {
    return this.aiPromptWidgets
  }

  setAIPromptWidgets(widgets: { id: string; eventId: string; messages: any[] }[]) {
    // AI Prompt widgets are session-only, no localStorage persistence
    this.aiPromptWidgets = widgets
  }

  addAIPromptWidget(eventId: string, id?: string) {
    const widgetId = id ?? `ai-prompt-${Date.now()}`
    this.aiPromptWidgets.push({ id: widgetId, eventId, messages: [] })
    // AI Prompt widgets are session-only, no localStorage persistence
    return widgetId
  }

  removeAIPromptWidget(id: string) {
    this.aiPromptWidgets = this.aiPromptWidgets.filter((widget) => widget.id !== id)
    // AI Prompt widgets are session-only, no localStorage persistence
  }

  getZapSound() {
    return this.zapSound
  }

  setZapSound(sound: TZapSound) {
    this.zapSound = sound
    window.localStorage.setItem(StorageKey.ZAP_SOUND, sound)
  }

  getCustomFeeds() {
    return this.customFeeds
  }

  addCustomFeed(feed: TCustomFeed) {
    this.customFeeds.push(feed)
    window.localStorage.setItem(StorageKey.CUSTOM_FEEDS, JSON.stringify(this.customFeeds))
  }

  removeCustomFeed(id: string) {
    this.customFeeds = this.customFeeds.filter((feed) => feed.id !== id)
    window.localStorage.setItem(StorageKey.CUSTOM_FEEDS, JSON.stringify(this.customFeeds))
  }

  updateCustomFeed(id: string, updates: Partial<TCustomFeed>) {
    const index = this.customFeeds.findIndex((feed) => feed.id === id)
    if (index !== -1) {
      this.customFeeds[index] = { ...this.customFeeds[index], ...updates }
      window.localStorage.setItem(StorageKey.CUSTOM_FEEDS, JSON.stringify(this.customFeeds))
    }
  }

  getZapOnReactions() {
    return this.zapOnReactions
  }

  setZapOnReactions(enabled: boolean) {
    this.zapOnReactions = enabled
    window.localStorage.setItem(StorageKey.ZAP_ON_REACTIONS, enabled.toString())
  }

  getOnlyZapsMode() {
    return this.onlyZapsMode
  }

  setOnlyZapsMode(enabled: boolean) {
    this.onlyZapsMode = enabled
    window.localStorage.setItem(StorageKey.ONLY_ZAPS_MODE, enabled.toString())
  }

  getAIServiceConfig(pubkey?: string | null): TAIServiceConfig {
    return this.aiServiceConfigMap[pubkey ?? '_'] ?? {
      provider: 'openrouter'
    }
  }

  setAIServiceConfig(config: TAIServiceConfig, pubkey?: string | null) {
    this.aiServiceConfigMap[pubkey ?? '_'] = config
    window.localStorage.setItem(StorageKey.AI_SERVICE_CONFIG_MAP, JSON.stringify(this.aiServiceConfigMap))
  }

  getAIToolsConfig(pubkey?: string | null): TAIToolsConfig {
    return this.aiToolsConfigMap[pubkey ?? '_'] ?? { enableSummary: false }
  }

  setAIToolsConfig(config: TAIToolsConfig, pubkey?: string | null) {
    this.aiToolsConfigMap[pubkey ?? '_'] = config
    window.localStorage.setItem(StorageKey.AI_TOOLS_CONFIG_MAP, JSON.stringify(this.aiToolsConfigMap))
  }

  getHideReadsInNavigation() {
    return this.hideReadsInNavigation
  }

  setHideReadsInNavigation(hide: boolean) {
    this.hideReadsInNavigation = hide
    window.localStorage.setItem(StorageKey.HIDE_READS_IN_NAVIGATION, hide.toString())
  }

  getHideReadsInProfiles() {
    return this.hideReadsInProfiles
  }

  setHideReadsInProfiles(hide: boolean) {
    this.hideReadsInProfiles = hide
    window.localStorage.setItem(StorageKey.HIDE_READS_IN_PROFILES, hide.toString())
  }

  getFavoriteLists(pubkey?: string | null) {
    const key = pubkey || '_global'
    return this.favoriteListsMap[key] || []
  }

  addFavoriteList(listKey: string, pubkey?: string | null) {
    const key = pubkey || '_global'
    const currentFavorites = this.favoriteListsMap[key] || []
    if (!currentFavorites.includes(listKey)) {
      this.favoriteListsMap[key] = [...currentFavorites, listKey]
      window.localStorage.setItem(StorageKey.FAVORITE_LISTS, JSON.stringify(this.favoriteListsMap))
    }
  }

  removeFavoriteList(listKey: string, pubkey?: string | null) {
    const key = pubkey || '_global'
    const currentFavorites = this.favoriteListsMap[key] || []
    this.favoriteListsMap[key] = currentFavorites.filter((k) => k !== listKey)
    window.localStorage.setItem(StorageKey.FAVORITE_LISTS, JSON.stringify(this.favoriteListsMap))
  }

  isFavoriteList(listKey: string, pubkey?: string | null) {
    const key = pubkey || '_global'
    const currentFavorites = this.favoriteListsMap[key] || []
    return currentFavorites.includes(listKey)
  }
}

const instance = new LocalStorageService()
export default instance
