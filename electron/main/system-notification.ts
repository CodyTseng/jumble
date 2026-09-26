import { BrowserWindow, Notification } from 'electron'
import { IPC_CHANNELS, type TSystemNotificationPayload } from '../shared/ipc-types.js'

export class ElectronSystemNotificationService {
  private activeNotifications = new Set<Notification>()

  isSupported(): boolean {
    return Notification.isSupported()
  }

  show(payload: TSystemNotificationPayload, window?: BrowserWindow | null): boolean {
    if (!this.isSupported()) return false
    if (!payload || typeof payload.title !== 'string' || payload.title.length === 0) return false
    if (payload.body !== undefined && typeof payload.body !== 'string') return false
    if (
      payload.target !== undefined &&
      (typeof payload.target !== 'string' ||
        !payload.target.startsWith('/') ||
        payload.target.startsWith('//'))
    ) {
      return false
    }

    try {
      const notification = new Notification({
        title: payload.title,
        body: payload.body
      })
      this.activeNotifications.add(notification)

      const release = () => this.activeNotifications.delete(notification)
      notification.once('close', release)
      notification.once('failed', release)
      notification.on('click', () => {
        release()
        if (!window || window.isDestroyed()) return
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
        if (payload.target) {
          window.webContents.send(IPC_CHANNELS.systemNotificationClick, payload.target)
        }
      })
      notification.show()
      return true
    } catch {
      return false
    }
  }
}
