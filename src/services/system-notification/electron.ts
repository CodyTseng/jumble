import { getElectronBridge } from '@/lib/platform'
import type {
  ISystemNotificationAdapter,
  TSystemNotification,
  TSystemNotificationPermission
} from './types'

export class ElectronSystemNotificationAdapter implements ISystemNotificationAdapter {
  async isSupported(): Promise<boolean> {
    try {
      return (await getElectronBridge()?.notification.isSupported()) ?? false
    } catch {
      return false
    }
  }

  async getPermission(): Promise<TSystemNotificationPermission> {
    return (await this.isSupported()) ? 'granted' : 'denied'
  }

  requestPermission(): Promise<TSystemNotificationPermission> {
    return this.getPermission()
  }

  async show(notification: TSystemNotification): Promise<boolean> {
    try {
      return (await getElectronBridge()?.notification.show(notification)) ?? false
    } catch {
      return false
    }
  }

  onClick(listener: (target?: string) => void): () => void {
    return getElectronBridge()?.notification.onClick(listener) ?? (() => undefined)
  }
}
