import { TDraftEvent, TRelayGroup, TTheme, TThemeSetting } from '@common/types'
import { ElectronAPI } from '@electron-toolkit/preload'
import { Event } from 'nostr-tools'

declare global {
  interface Window {
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
        getPublicKey: () => Promise<string | null>
        signEvent: (draftEvent: TDraftEvent) => Promise<Event | null>
      }
    }
  }
}
