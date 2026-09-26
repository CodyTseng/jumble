import { isElectron } from '@/lib/platform'
import { ElectronSystemNotificationAdapter } from './electron'
import { PwaSystemNotificationAdapter } from './pwa'

const systemNotification = isElectron()
  ? new ElectronSystemNotificationAdapter()
  : new PwaSystemNotificationAdapter()

export default systemNotification
export type * from './types'
