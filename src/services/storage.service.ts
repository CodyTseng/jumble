import { StorageKey } from '@/constants'
import { isSameAccount } from '@/lib/account'
import { TAccount, TRelayGroup, TAccountPointer, TThemeSetting } from '@/types'

const DEFAULT_RELAY_GROUPS: TRelayGroup[] = [
  {
    groupName: 'Global',
    relayUrls: ['wss://relay.damus.io/', 'wss://nos.lol/'],
    isActive: true
  }
]

class StorageService {
  static instance: StorageService

  private relayGroups: TRelayGroup[] = []
  private themeSetting: TThemeSetting = 'system'
  private accounts: TAccount[] = []
  private currentAccount: TAccount | null = null

  constructor() {
    if (!StorageService.instance) {
      this.init()
      StorageService.instance = this
    }
    return StorageService.instance
  }

  init() {
    const relayGroupsStr = window.localStorage.getItem(StorageKey.RELAY_GROUPS)
    this.relayGroups = relayGroupsStr ? JSON.parse(relayGroupsStr) : DEFAULT_RELAY_GROUPS
    this.themeSetting =
      (window.localStorage.getItem(StorageKey.THEME_SETTING) as TThemeSetting) ?? 'system'
    const accountsStr = window.localStorage.getItem(StorageKey.ACCOUNTS)
    this.accounts = accountsStr ? JSON.parse(accountsStr) : []
    const currentAccountStr = window.localStorage.getItem(StorageKey.CURRENT_ACCOUNT)
    this.currentAccount = currentAccountStr ? JSON.parse(currentAccountStr) : null
  }

  getRelayGroups() {
    return this.relayGroups
  }

  setRelayGroups(relayGroups: TRelayGroup[]) {
    window.localStorage.setItem(StorageKey.RELAY_GROUPS, JSON.stringify(relayGroups))
    this.relayGroups = relayGroups
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
    window.localStorage.setItem(StorageKey.ACCOUNTS, JSON.stringify(this.accounts))
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
}

const instance = new StorageService()

export default instance
