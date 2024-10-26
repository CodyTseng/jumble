import { ElectronAPI } from '@electron-toolkit/preload'
import { Event } from 'nostr-tools'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      theme: {
        onChange: (cb: (theme: 'dark' | 'light') => void) => void
        current: () => Promise<'dark' | 'light'>
      }
      relay: {
        fetchEvents: (filters: Filter[]) => Promise<Event[]>
      }
    }
  }
}
