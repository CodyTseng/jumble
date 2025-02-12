import { StorageKey } from '@/constants'
import { isSameAccount } from '@/lib/account'
import { randomString } from '@/lib/random'
import {
  TAccount,
  TAccountPointer,
  TFeedType,
  TNoteListMode,
  TRelaySet,
  TThemeSetting
} from '@/types'

const DEFAULT_RELAY_SETS: TRelaySet[] = [
  {
    id: randomString(),
    name: 'Global',
    relayUrls: ['wss://relay.damus.io/', 'wss://nos.lol/']
  },
  {
    id: randomString(),
    name: 'Safer Global',
    relayUrls: ['wss://nostr.wine/', 'wss://pyramid.fiatjaf.com/']
  },
  {
    id: randomString(),
    name: 'Short Notes',
    relayUrls: ['wss://140.f7z.io/']
  },
  {
    id: randomString(),
    name: 'News',
    relayUrls: ['wss://news.utxo.one/']
  },
  {
    id: randomString(),
    name: 'Algo',
    relayUrls: ['wss://algo.utxo.one']
  }
]

class LocalStorageService {
  static instance: LocalStorageService

  private relaySets: TRelaySet[] = []
  private activeRelaySetId: string | null = null
  private feedType: TFeedType = 'relays'
  private themeSetting: TThemeSetting = 'system'
  private accounts: TAccount[] = []
  private currentAccount: TAccount | null = null
  private noteListMode: TNoteListMode = 'posts'

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
    const feedType = window.localStorage.getItem(StorageKey.FEED_TYPE)
    if (feedType && ['following', 'relays'].includes(feedType)) {
      this.feedType = feedType as 'following' | 'relays'
    } else {
      this.feedType = 'relays'
    }
    const noteListModeStr = window.localStorage.getItem(StorageKey.NOTE_LIST_MODE)
    this.noteListMode =
      noteListModeStr && ['posts', 'postsAndReplies', 'pictures'].includes(noteListModeStr)
        ? (noteListModeStr as TNoteListMode)
        : 'posts'

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
      this.activeRelaySetId = window.localStorage.getItem(StorageKey.ACTIVE_RELAY_SET_ID) ?? null
    }

    // Clean up deprecated data
    window.localStorage.removeItem(StorageKey.ACCOUNT_PROFILE_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_FOLLOW_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_RELAY_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_MUTE_LIST_EVENT_MAP)
    window.localStorage.removeItem(StorageKey.ACCOUNT_MUTE_DECRYPTED_TAGS_MAP)
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
      window.localStorage.setItem(StorageKey.ACTIVE_RELAY_SET_ID, id)
    } else {
      window.localStorage.removeItem(StorageKey.ACTIVE_RELAY_SET_ID)
    }
  }

  getFeedType() {
    return this.feedType
  }

  setFeedType(feedType: TFeedType) {
    this.feedType = feedType
    window.localStorage.setItem(StorageKey.FEED_TYPE, this.feedType)
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

const instance = new LocalStorageService()
export default instance
