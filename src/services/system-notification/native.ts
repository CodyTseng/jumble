import { LocalNotifications } from '@capacitor/local-notifications'
import type {
  ISystemNotificationAdapter,
  TSystemNotification,
  TSystemNotificationPermission
} from './types'

function permission(value: string): TSystemNotificationPermission {
  return value === 'granted' || value === 'denied' ? value : 'default'
}

// Android notification IDs are signed 32-bit integers. A stable hash lets repeated
// notifications for the same event replace each other, as they do on desktop.
function notificationId(id: string): number {
  let hash = 0
  for (const char of id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0
  return hash & 0x7fffffff
}

export class NativeSystemNotificationAdapter implements ISystemNotificationAdapter {
  async isSupported() {
    return true
  }

  async getPermission() {
    return permission((await LocalNotifications.checkPermissions()).display)
  }

  async requestPermission() {
    return permission((await LocalNotifications.requestPermissions()).display)
  }

  async show(notification: TSystemNotification): Promise<boolean> {
    if ((await this.getPermission()) !== 'granted') return false
    try {
      await LocalNotifications.createChannel({
        id: 'activity',
        name: 'Jumble',
        importance: 3,
        visibility: 0
      })
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId(notification.id),
            title: notification.title,
            body: notification.body ?? '',
            channelId: 'activity',
            extra: { target: notification.target }
          }
        ]
      })
      return true
    } catch {
      return false
    }
  }

  onClick(listener: (target?: string) => void): () => void {
    let disposed = false
    const pending = LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      if (disposed) return
      const target = event.notification.extra?.target
      listener(typeof target === 'string' ? target : undefined)
    })
    void pending
      .then((handle) => {
        if (disposed) return handle.remove()
      })
      .catch(console.error)
    return () => {
      disposed = true
      void pending.then((handle) => handle.remove()).catch(console.error)
    }
  }
}
