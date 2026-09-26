export type TSystemNotificationPermission = 'default' | 'denied' | 'granted'

export type TSystemNotification = {
  id: string
  title: string
  body?: string
  target?: string
}

export interface ISystemNotificationAdapter {
  isSupported(): Promise<boolean>
  getPermission(): Promise<TSystemNotificationPermission>
  requestPermission(): Promise<TSystemNotificationPermission>
  show(notification: TSystemNotification): Promise<boolean>
  onClick(listener: (target?: string) => void): () => void
}
