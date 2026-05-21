/// <reference types="vite/client" />
import { TNip07 } from '@/types'

declare global {
  interface Window {
    nostr?: TNip07
  }
}

interface ImportMetaEnv {
  readonly VITE_RELAY_MODE?: string
  readonly VITE_RELAY_URL?: string
  readonly VITE_PROXY_SERVER?: string
  readonly VITE_KLIPY_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
