import { TRelayGroup } from '@common/types'
import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      theme: {
        onChange: (cb: (theme: 'dark' | 'light') => void) => void
        current: () => Promise<'dark' | 'light'>
      }
      storage: {
        getRelayGroups: () => Promise<TRelayGroup[]>
        setRelayGroups: (relayGroups: TRelayGroup[]) => Promise<void>
      }
    }
  }
}
