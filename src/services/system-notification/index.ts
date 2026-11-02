import { isAndroid, isElectron } from '@/lib/platform'
import { ElectronSystemNotificationAdapter } from './electron'
import { NativeSystemNotificationAdapter } from './native'
import { PwaSystemNotificationAdapter } from './pwa'

const systemNotification = isElectron()
  ? new ElectronSystemNotificationAdapter()
  : isAndroid()
    ? new NativeSystemNotificationAdapter()
    : new PwaSystemNotificationAdapter()

export default systemNotification
export type * from './types'
