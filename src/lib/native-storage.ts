import { registerPlugin } from '@capacitor/core'
import type { TNativeStorageBridge } from '@/types/native-storage'
import { getElectronBridge, isAndroid } from './platform'

interface AndroidStoragePlugin {
  isAvailable(): Promise<{ available: boolean }>
  load(options: { store: 'secrets' | 'state' }): Promise<{ value: string | null }>
  save(options: { store: 'secrets' | 'state'; value: string }): Promise<void>
}

const AndroidStorage = registerPlugin<AndroidStoragePlugin>('JumbleStorage')
const androidStorage: TNativeStorageBridge = {
  secrets: {
    isAvailable: async () => (await AndroidStorage.isAvailable()).available,
    load: async () => {
      const { value } = await AndroidStorage.load({ store: 'secrets' })
      return value === null ? {} : JSON.parse(value)
    },
    save: async (bundle) => AndroidStorage.save({ store: 'secrets', value: JSON.stringify(bundle) })
  },
  localStorage: {
    load: async () => {
      const { value } = await AndroidStorage.load({ store: 'state' })
      return value === null ? null : JSON.parse(value)
    },
    save: async (snapshot) =>
      AndroidStorage.save({ store: 'state', value: JSON.stringify(snapshot) })
  }
}

/** Select capabilities here; business services need not know which native shell is running. */
export function getNativeStorageBridge(): TNativeStorageBridge | undefined {
  return getElectronBridge() ?? (isAndroid() ? androidStorage : undefined)
}
