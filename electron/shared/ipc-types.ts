import type { Event as NEvent, EventTemplate, Filter, VerifiedEvent } from 'nostr-tools'

export const IPC_CHANNELS = {
  checkRelays: 'relay:check-relays',
  setNetworkOnline: 'relay:set-network-online',
  publish: 'relay:publish',
  subscribe: 'relay:subscribe',
  closeSub: 'relay:closeSub',
  auth: 'relay:auth',
  close: 'relay:close',
  subEvent: 'relay:sub:event',
  subEose: 'relay:sub:eose',
  subClose: 'relay:sub:close',
  authRequest: 'relay:auth-request',
  authResponse: 'relay:auth-response',
  setAllowInsecure: 'relay:set-allow-insecure',
  setTrustedInsecureUrls: 'relay:set-trusted-insecure-urls',
  secretsLoad: 'secrets:load',
  secretsSave: 'secrets:save',
  secretsAvailable: 'secrets:available',
  securityGetStatus: 'security:get-status',
  securitySetupPassword: 'security:setup-password',
  securityUnlock: 'security:unlock',
  securityReset: 'security:reset',
  localStorageLoad: 'local-storage:load',
  localStorageSave: 'local-storage:save',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  updateGetState: 'update:get-state',
  updateState: 'update:state',
  updateSetAuto: 'update:set-auto',
  systemNotificationSupported: 'system-notification:supported',
  systemNotificationShow: 'system-notification:show',
  systemNotificationClick: 'system-notification:click',
  proxyFetch: 'proxy:fetch',
  mediaGetShimOrigin: 'media:get-shim-origin',
  pomegranateAuthenticate: 'pomegranate:authenticate',
  pomegranateRecover: 'pomegranate:recover'
} as const

export type TSecretsBundle = {
  nsec?: Record<string, string>
  ncryptsec?: Record<string, string>
  bunkerClientSecretKey?: Record<string, string>
  encryptionKeyPrivkey?: Record<string, string>
  retiredEncryptionKeyPrivkey?: Record<string, { privkey: string; retiredAt: number }[]>
}

export type TSecretsBridge = {
  isAvailable: () => Promise<boolean>
  load: () => Promise<TSecretsBundle>
  save: (bundle: TSecretsBundle) => Promise<void>
}

export type TLocalStorageSnapshot = {
  version: 1
  revision: number
  entries: Record<string, string>
}

export type TLocalStorageBridge = {
  load: () => Promise<TLocalStorageSnapshot | null>
  save: (snapshot: TLocalStorageSnapshot) => Promise<void>
}

export type TSecurityBackend = 'safeStorage' | 'password'

export type TSecurityStatus = {
  /** Which encryption layer backs the on-disk stores. */
  backend: TSecurityBackend
  /** Password backend only: the key has been derived and is held in memory. */
  unlocked: boolean
  /** Password backend only: no password has been created on this machine yet. */
  needsSetup: boolean
}

export type TSecurityBridge = {
  getStatus: () => Promise<TSecurityStatus>
  /** Create the initial password (needsSetup only) and unlock. */
  setupPassword: (password: string) => Promise<void>
  /** Derive and verify the key. Resolves false on a wrong password. */
  unlock: (password: string) => Promise<boolean>
  /**
   * Forget the password and delete every encrypted store. Used as the escape
   * hatch for a forgotten password — all persisted secrets are lost.
   */
  reset: () => Promise<void>
}

export type TSubEventPayload = {
  subId: string
  event: NEvent
  relayUrl: string
}

export type TSubEosePayload = {
  subId: string
}

export type TSubClosePayload = {
  subId: string
  reason: string
}

export type TAuthRequestPayload = {
  requestId: string
  url: string
  authEvent: EventTemplate
}

export type TAuthResponsePayload = {
  requestId: string
  signedEvent?: VerifiedEvent
  error?: string
}

export type TElectronRelayBridge = {
  checkRelays: () => Promise<void>
  setNetworkOnline: (online: boolean) => Promise<void>
  publish: (url: string, event: NEvent, timeoutMs: number) => Promise<void>
  subscribe: (subId: string, url: string, filters: Filter[]) => Promise<void>
  closeSub: (subId: string) => Promise<void>
  auth: (url: string) => Promise<void>
  close: (urls?: string[]) => Promise<void>
  setAllowInsecure: (allow: boolean) => Promise<void>
  setTrustedInsecureRelayUrls: (urls: string[]) => Promise<void>
  onSubEvent: (cb: (payload: TSubEventPayload) => void) => () => void
  onSubEose: (cb: (payload: TSubEosePayload) => void) => () => void
  onSubClose: (cb: (payload: TSubClosePayload) => void) => () => void
  onAuthRequest: (cb: (payload: TAuthRequestPayload) => void) => () => void
  sendAuthResponse: (payload: TAuthResponsePayload) => void
}

export type TUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'download-error'
  | 'downloaded'
  | 'error'

export type TUpdateState = {
  status: TUpdateStatus
  /** Current app version (always present) */
  currentVersion: string
  /** Version reported by the update server when status is `available`/`downloading`/`downloaded` */
  newVersion?: string
  /** Download progress 0-100 (also retained after a failed download) */
  progressPercent?: number
  bytesPerSecond?: number
  releaseNotes?: string
  /** Last error message when status is `error` */
  error?: string
  /** Whether the platform supports auto-update at all (false on web/dev) */
  supported: boolean
  /** User preference: when false, the app does not auto-check or auto-download */
  autoUpdateEnabled: boolean
}

export type TUpdateBridge = {
  /** Trigger an explicit check (user-initiated). Returns the new state. */
  check: () => Promise<TUpdateState>
  /** Force download (only needed when autoDownload is off). */
  download: () => Promise<void>
  /** Quit and install the downloaded update immediately. */
  install: () => Promise<void>
  /** Pull the latest known state without triggering anything. */
  getState: () => Promise<TUpdateState>
  /** Subscribe to state changes pushed by the main process. */
  onState: (cb: (state: TUpdateState) => void) => () => void
  /** Toggle the periodic background check + autoDownload behavior. */
  setAutoUpdate: (enabled: boolean) => Promise<TUpdateState>
}

export type TSystemNotificationPayload = {
  id: string
  title: string
  body?: string
  target?: string
}

export type TSystemNotificationBridge = {
  isSupported: () => Promise<boolean>
  show: (notification: TSystemNotificationPayload) => Promise<boolean>
  onClick: (cb: (target?: string) => void) => () => void
}

export type TProxyFetchOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string
  /** Override the default 15s timeout. Clamped by the main process. */
  timeoutMs?: number
}

export type TProxyFetchResponse = {
  ok: boolean
  status: number
  statusText: string
  /** Final URL after redirects */
  url: string
  headers: Record<string, string>
  /** Response body decoded as UTF-8 text (HTML/JSON/etc.) */
  body: string
}

export type TProxyBridge = {
  fetch: (url: string, options?: TProxyFetchOptions) => Promise<TProxyFetchResponse>
}

export type TMediaBridge = {
  /**
   * Origin (e.g. http://127.0.0.1:54321) of the local HTTP server that hosts
   * the YouTube IFrame API shim page. Returns null if the server isn't running
   * (e.g. dev mode where the renderer is served by Vite over http already).
   */
  getShimOrigin: () => Promise<string | null>
}

export type TPomegranateAuthPurpose = 'login' | 'bind' | 'disconnect' | 'recovery'

export type TPomegranateBridge = {
  /** Opens Pomegranate authentication in the system browser and returns its postMessage result. */
  authenticate: (url: string, purpose: TPomegranateAuthPurpose) => Promise<string>
  /** Runs central + operator recovery from one system-browser coordinator page. */
  recover: (centralLoginUrl: string, expectedPubkey: string) => Promise<{ shards: string[] }>
}

export type TElectronBridge = {
  relay: TElectronRelayBridge
  secrets: TSecretsBridge
  localStorage: TLocalStorageBridge
  security: TSecurityBridge
  update: TUpdateBridge
  notification: TSystemNotificationBridge
  proxy: TProxyBridge
  media: TMediaBridge
  pomegranate: TPomegranateBridge
}
