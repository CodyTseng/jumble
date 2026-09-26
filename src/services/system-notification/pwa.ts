import type {
  ISystemNotificationAdapter,
  TSystemNotification,
  TSystemNotificationPermission
} from './types'

const NOTIFICATION_CLICK_MESSAGE = 'system-notification:click'

export class PwaSystemNotificationAdapter implements ISystemNotificationAdapter {
  private supportsNotifications(): boolean {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'ServiceWorkerRegistration' in window &&
      'showNotification' in ServiceWorkerRegistration.prototype
    )
  }

  async isSupported(): Promise<boolean> {
    return this.supportsNotifications()
  }

  async getPermission(): Promise<TSystemNotificationPermission> {
    if (!(await this.isSupported())) return 'denied'
    return Notification.permission
  }

  async requestPermission(): Promise<TSystemNotificationPermission> {
    // Keep the browser permission request in the original user-activation task.
    // iOS Home Screen apps reject requests made after an asynchronous boundary.
    if (!this.supportsNotifications()) return 'denied'
    try {
      return await Notification.requestPermission()
    } catch {
      return 'denied'
    }
  }

  async show(notification: TSystemNotification): Promise<boolean> {
    if ((await this.getPermission()) !== 'granted') return false

    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(notification.title, {
        body: notification.body,
        icon: '/pwa-192x192.png',
        badge: '/favicon-96x96.png',
        tag: notification.id,
        data: { target: notification.target }
      })
      return true
    } catch {
      return false
    }
  }

  onClick(listener: (target?: string) => void): () => void {
    if (!('serviceWorker' in navigator)) return () => undefined

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== NOTIFICATION_CLICK_MESSAGE) return
      listener(typeof event.data.target === 'string' ? event.data.target : undefined)
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }
}
