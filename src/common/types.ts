import { ElectronAPI } from '@electron-toolkit/preload'
import { Event } from 'nostr-tools'

export type TRelayGroup = {
  groupName: string
  relayUrls: string[]
  isActive: boolean
}

export type TConfig = {
  relayGroups: TRelayGroup[]
  theme: TThemeSetting
}

export type TThemeSetting = 'light' | 'dark' | 'system'
export type TTheme = 'light' | 'dark'

export type TDraftEvent = Pick<Event, 'content' | 'created_at' | 'kind' | 'tags'>

export type TElectronWindow = {
  electron: ElectronAPI
  api: {
    system: {
      isEncryptionAvailable: () => Promise<boolean>
    }
    theme: {
      onChange: (cb: (theme: TTheme) => void) => void
      current: () => Promise<TTheme>
      themeSetting: () => Promise<TThemeSetting>
      set: (themeSetting: TThemeSetting) => Promise<void>
    }
    storage: {
      getRelayGroups: () => Promise<TRelayGroup[]>
      setRelayGroups: (relayGroups: TRelayGroup[]) => Promise<void>
    }
    nostr: {
      login: (nsec: string) => Promise<{
        pubkey?: string
        reason?: string
      }>
      logout: () => Promise<void>
    }
  }
  nostr: {
    getPublicKey: () => Promise<string | null>
    signEvent: (draftEvent: TDraftEvent) => Promise<Event | null>
  }
}
