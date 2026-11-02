import type { BackgroundNotificationConfig, BackgroundNotificationRunner } from './runner'
import type { NotificationCursor } from '@/lib/notification-processor'
import { NativeWebSocket, deliverSocket, socketUrl } from './websocket'

interface NativeHost {
  postMessage(message: string): void
  isForeground(): boolean
  isOnline(): boolean
}
declare global {
  interface Window {
    JumbleBackgroundHost: NativeHost
    JumbleBackground: {
      configure(config: BackgroundNotificationConfig, cursor: NotificationCursor | null): void
      result(id: number, value: unknown, error?: string): void
      socket(
        id: number,
        event: { type: string; data?: string; code?: number; reason?: string }
      ): void
      tick(): void
      network(online: boolean): void
    }
  }
}
let runner: BackgroundNotificationRunner | undefined
let sequence = 0
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>()
export function send(op: string, value: Record<string, unknown> = {}) {
  window.JumbleBackgroundHost.postMessage(JSON.stringify({ op, ...value }))
}
function request<T>(op: string, value: Record<string, unknown>): Promise<T> {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: (value) => resolve(value as T), reject })
    send(op, { ...value, id })
  })
}
const failed = () => send('error')
window.JumbleBackground = {
  configure: (config, cursor) => {
    runner?.stop()
    void import('./runner')
      .then(async ({ BackgroundNotificationRunner }) => {
        runner = new BackgroundNotificationRunner(
          config,
          {
            websocket: NativeWebSocket as unknown as typeof WebSocket,
            fetchJson: async (url, options) => {
              const response = await request<{ status: number; body: string }>('fetch', {
                url,
                ...options
              })
              if (response.status < 200 || response.status >= 300)
                throw new Error('Background HTTP request failed')
              return JSON.parse(response.body)
            },
            saveCursor: (cursor) => request('saveCursor', { cursor }),
            notify: (notificationId, body) => request('notify', { notificationId, body }),
            isForeground: () => window.JumbleBackgroundHost.isForeground(),
            isOnline: () => window.JumbleBackgroundHost.isOnline(),
            status: (connections, subscriptions) => send('status', { connections, subscriptions }),
            error: failed
          },
          cursor
        )
        await runner.start()
        send('started')
      })
      .catch(failed)
  },
  result: (id, value, error) => {
    const operation = pending.get(id)
    if (!operation) return
    pending.delete(id)
    if (error) operation.reject(new Error(error))
    else operation.resolve(value)
  },
  socket: (id, event) => {
    const url = socketUrl(id)
    deliverSocket(id, event)
    if (url && (event.type === 'open' || event.type === 'close'))
      runner?.transportChanged(url, event.type === 'open')
  },
  tick: () => runner?.tick(),
  network: (online) => runner?.setNetworkOnline(online)
}
window.addEventListener('error', failed)
window.addEventListener('unhandledrejection', failed)
send('ready')
