import type { Event as NEvent, EventTemplate, Filter, VerifiedEvent } from 'nostr-tools'

export const IPC_CHANNELS = {
  ensure: 'relay:ensure',
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
  secretsLoad: 'secrets:load',
  secretsSave: 'secrets:save',
  secretsAvailable: 'secrets:available',
  proxyFetch: 'proxy:fetch'
} as const

export type TSecretsBundle = {
  nsec?: Record<string, string>
  ncryptsec?: Record<string, string>
  bunkerClientSecretKey?: Record<string, string>
  encryptionKeyPrivkey?: Record<string, string>
  clientKeyPrivkey?: Record<string, string>
}

export type TSecretsBridge = {
  isAvailable: () => Promise<boolean>
  load: () => Promise<TSecretsBundle>
  save: (bundle: TSecretsBundle) => Promise<void>
}

export type TProxyFetchOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
  maxBodySize?: number
  redirect?: 'follow' | 'manual' | 'error'
}

export type TProxyFetchResponse = {
  ok: boolean
  status: number
  statusText: string
  url: string
  headers: Record<string, string>
  body: string
}

/**
 * Generic main-process fetch proxy. Anything in the renderer that hits a
 * remote origin and would otherwise be blocked by CORS should call this.
 */
export type TProxyBridge = {
  fetch: (url: string, options?: TProxyFetchOptions) => Promise<TProxyFetchResponse>
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
  ensure: (url: string) => Promise<{ ok: boolean; error?: string }>
  publish: (url: string, event: NEvent, timeoutMs: number) => Promise<void>
  subscribe: (subId: string, url: string, filters: Filter[]) => Promise<void>
  closeSub: (subId: string) => Promise<void>
  auth: (url: string) => Promise<void>
  close: (urls?: string[]) => Promise<void>
  setAllowInsecure: (allow: boolean) => Promise<void>
  onSubEvent: (cb: (payload: TSubEventPayload) => void) => () => void
  onSubEose: (cb: (payload: TSubEosePayload) => void) => () => void
  onSubClose: (cb: (payload: TSubClosePayload) => void) => () => void
  onAuthRequest: (cb: (payload: TAuthRequestPayload) => void) => () => void
  sendAuthResponse: (payload: TAuthResponsePayload) => void
}

export type TElectronBridge = {
  relay: TElectronRelayBridge
  secrets: TSecretsBridge
  proxy: TProxyBridge
}
