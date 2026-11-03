/** Web/Electron substitute: native-only calls must stay behind isAndroid(). */
export interface PluginListenerHandle {
  remove(): Promise<void>
}

export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web'
}

function unavailable(): never {
  throw new Error('Capacitor is only available in Android builds')
}

export function registerPlugin<T>(name: string): T {
  return new Proxy(
    {},
    { get: () => () => Promise.reject(new Error(`${name} requires Android`)) }
  ) as T
}

export const CapacitorHttp = {
  async request(_options: {
    url: string
    method: string
    headers?: Record<string, string>
    data?: string
    responseType: string
    connectTimeout: number
    readTimeout: number
  }): Promise<{ data: unknown; status: number; url: string; headers: Record<string, string> }> {
    return unavailable()
  }
}

type AppEvents = {
  appStateChange: { isActive: boolean }
  appUrlOpen: { url: string }
  backButton: { canGoBack: boolean }
}

export const App = {
  async addListener<K extends keyof AppEvents>(
    _event: K,
    _listener: (event: AppEvents[K]) => void
  ): Promise<PluginListenerHandle> {
    return unavailable()
  },
  async minimizeApp(): Promise<void> {
    return unavailable()
  },
  async getLaunchUrl(): Promise<{ url: string } | undefined> {
    return unavailable()
  }
}

export const LocalNotifications = {
  async checkPermissions(): Promise<{ display: string }> {
    return unavailable()
  },
  async requestPermissions(): Promise<{ display: string }> {
    return unavailable()
  },
  async createChannel(_channel: {
    id: string
    name: string
    importance: number
    visibility: number
  }): Promise<void> {
    return unavailable()
  },
  async schedule(_options: {
    notifications: {
      id: number
      title: string
      body: string
      channelId: string
      extra: { target?: string }
    }[]
  }): Promise<void> {
    return unavailable()
  },
  async addListener(
    _event: 'localNotificationActionPerformed',
    _listener: (event: { notification: { extra?: { target?: unknown } } }) => void
  ): Promise<PluginListenerHandle> {
    return unavailable()
  }
}
