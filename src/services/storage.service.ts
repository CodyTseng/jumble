import { StorageKey } from '@/constants'
import { isSameAccount } from '@/lib/account'
import { randomString } from '@/lib/random'
import { TAccount, TAccountPointer, TFeedType, TRelaySet, TThemeSetting } from '@/types'
import { Event } from 'nostr-tools'

const DEFAULT_RELAY_SETS: TRelaySet[] = [
  {
    id: randomString(),
    name: 'Global',
    relayUrls: ['wss://relay.damus.io/', 'wss://nos.lol/']
  },
  {
    id: randomString(),
    name: 'Algo',
    relayUrls: ['wss://algo.utxo.one']
  }
]

class StorageService {
  static instance: StorageService

  private relaySets: TRelaySet[] = []
  private activeRelaySetId: string | null = null
  private feedType: TFeedType = 'relays'
  private themeSetting: TThemeSetting = 'system'
  private accounts: TAccount[] = []
  private currentAccount: TAccount | null = null
  private accountRelayListEventMap: Record<string, Event | undefined> = {} // pubkey -> relayListEvent
  private accountFollowListEventMap: Record<string, Event | undefined> = {} // pubkey -> followListEvent
  private accountProfileEventMap: Record<string, Event> = {} // pubkey -> profileEvent

  constructor() {
    if (!StorageService.instance) {
      this.init()
      StorageService.instance = this
    }
    return StorageService.instance
  }

  init() {
    this.themeSetting =
      (window.localStorage.getItem(StorageKey.THEME_SETTING) as TThemeSetting) ?? 'system'
    const accountsStr = window.localStorage.getItem(StorageKey.ACCOUNTS)
    this.accounts = accountsStr ? JSON.parse(accountsStr) : []
    const currentAccountStr = window.localStorage.getItem(StorageKey.CURRENT_ACCOUNT)
    this.currentAccount = currentAccountStr ? JSON.parse(currentAccountStr) : null
    const feedTypeStr = window.localStorage.getItem(StorageKey.FEED_TYPE)
    this.feedType = feedTypeStr ? JSON.parse(feedTypeStr) : 'relays'

    const accountRelayListEventMapStr = window.localStorage.getItem(
      StorageKey.ACCOUNT_RELAY_LIST_EVENT_MAP
    )
    this.accountRelayListEventMap = accountRelayListEventMapStr
      ? JSON.parse(accountRelayListEventMapStr)
      : {}
    const accountFollowListEventMapStr = window.localStorage.getItem(
      StorageKey.ACCOUNT_FOLLOW_LIST_EVENT_MAP
    )
    this.accountFollowListEventMap = accountFollowListEventMapStr
      ? JSON.parse(accountFollowListEventMapStr)
      : {}
    const accountProfileEventMapStr = window.localStorage.getItem(
      StorageKey.ACCOUNT_PROFILE_EVENT_MAP
    )
    this.accountProfileEventMap = accountProfileEventMapStr
      ? JSON.parse(accountProfileEventMapStr)
      : {}

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
        relaySets = DEFAULT_RELAY_SETS
      }
      const activeRelaySetId = relaySets[0].id
      window.localStorage.setItem(StorageKey.RELAY_SETS, JSON.stringify(relaySets))
      window.localStorage.setItem(StorageKey.ACTIVE_RELAY_SET_ID, activeRelaySetId)
      this.relaySets = relaySets
      this.activeRelaySetId = activeRelaySetId
    } else {
      this.relaySets = JSON.parse(relaySetsStr)
      const activeRelaySetIdStr = window.localStorage.getItem(StorageKey.ACTIVE_RELAY_SET_ID)
      this.activeRelaySetId = activeRelaySetIdStr ? JSON.parse(activeRelaySetIdStr) : null
    }
  }

  getRelaySets() {
    return this.relaySets
  }

  setRelaySets(relaySets: TRelaySet[]) {
    this.relaySets = relaySets
    window.localStorage.setItem(StorageKey.RELAY_SETS, JSON.stringify(this.relaySets))
  }

  getActiveRelaySetId() {
    return this.activeRelaySetId
  }

  setActiveRelaySetId(id: string | null) {
    this.activeRelaySetId = id
    if (id) {
      window.localStorage.setItem(
        StorageKey.ACTIVE_RELAY_SET_ID,
        JSON.stringify(this.activeRelaySetId)
      )
    } else {
      window.localStorage.removeItem(StorageKey.ACTIVE_RELAY_SET_ID)
    }
  }

  getFeedType() {
    return this.feedType
  }

  setFeedType(feedType: TFeedType) {
    this.feedType = feedType
    window.localStorage.setItem(StorageKey.FEED_TYPE, JSON.stringify(this.feedType))
  }

  getThemeSetting() {
    return this.themeSetting
  }

  setThemeSetting(themeSetting: TThemeSetting) {
    window.localStorage.setItem(StorageKey.THEME_SETTING, themeSetting)
    this.themeSetting = themeSetting
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

  addAccount(account: TAccount) {
    if (this.accounts.find((act) => isSameAccount(act, account))) {
      return
    }
    this.accounts.push(account)
    window.localStorage.setItem(StorageKey.ACCOUNTS, JSON.stringify(this.accounts))
    return account
  }

  removeAccount(account: TAccount) {
    this.accounts = this.accounts.filter((act) => !isSameAccount(act, account))
    delete this.accountFollowListEventMap[account.pubkey]
    delete this.accountRelayListEventMap[account.pubkey]
    delete this.accountProfileEventMap[account.pubkey]
    window.localStorage.setItem(StorageKey.ACCOUNTS, JSON.stringify(this.accounts))
    window.localStorage.setItem(
      StorageKey.ACCOUNT_FOLLOW_LIST_EVENT_MAP,
      JSON.stringify(this.accountFollowListEventMap)
    )
    window.localStorage.setItem(
      StorageKey.ACCOUNT_RELAY_LIST_EVENT_MAP,
      JSON.stringify(this.accountRelayListEventMap)
    )
    window.localStorage.setItem(
      StorageKey.ACCOUNT_PROFILE_EVENT_MAP,
      JSON.stringify(this.accountProfileEventMap)
    )
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

  getAccountRelayListEvent(pubkey: string) {
    return this.accountRelayListEventMap[pubkey]
  }

  setAccountRelayListEvent(relayListEvent: Event) {
    const pubkey = relayListEvent.pubkey
    if (
      this.accountRelayListEventMap[pubkey] &&
      this.accountRelayListEventMap[pubkey].created_at > relayListEvent.created_at
    ) {
      return false
    }
    this.accountRelayListEventMap[pubkey] = relayListEvent
    window.localStorage.setItem(
      StorageKey.ACCOUNT_RELAY_LIST_EVENT_MAP,
      JSON.stringify(this.accountRelayListEventMap)
    )
    return true
  }

  getAccountFollowListEvent(pubkey: string) {
    return this.accountFollowListEventMap[pubkey]
  }

  setAccountFollowListEvent(followListEvent: Event) {
    const pubkey = followListEvent.pubkey
    if (
      this.accountFollowListEventMap[pubkey] &&
      this.accountFollowListEventMap[pubkey].created_at > followListEvent.created_at
    ) {
      return false
    }
    this.accountFollowListEventMap[pubkey] = followListEvent
    window.localStorage.setItem(
      StorageKey.ACCOUNT_FOLLOW_LIST_EVENT_MAP,
      JSON.stringify(this.accountFollowListEventMap)
    )
    return true
  }

  getAccountProfileEvent(pubkey: string) {
    return this.accountProfileEventMap[pubkey]
  }

  setAccountProfileEvent(profileEvent: Event) {
    const pubkey = profileEvent.pubkey
    if (
      this.accountProfileEventMap[pubkey] &&
      this.accountProfileEventMap[pubkey].created_at > profileEvent.created_at
    ) {
      return false
    }
    this.accountProfileEventMap[pubkey] = profileEvent
    window.localStorage.setItem(
      StorageKey.ACCOUNT_PROFILE_EVENT_MAP,
      JSON.stringify(this.accountProfileEventMap)
    )
    return true
  }
}

const instance = new StorageService()

export default instance
