import { TRelayGroup, TTheme, TThemeSetting } from '@common/types'
import { ElectronAPI } from '@electron-toolkit/preload'
import { Event } from 'nostr-tools'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
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
        login: (nsec: string) => Promise<string | void>
        logout: () => Promise<void>
        getPublicKey: () => Promise<string | null>
        signEvent: (event: Omit<Event, 'id' | 'pubkey' | 'sig'>) => Promise<Event | null>
      }
    }
  }
}
