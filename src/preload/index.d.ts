import { TRelayGroup, TTheme, TThemeSetting } from '@common/types'
import { ElectronAPI } from '@electron-toolkit/preload'

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
    }
  }
}
