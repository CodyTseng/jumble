/// <reference types="vite/client" />
import { TNip07 } from '@/types'

declare global {
  interface Window {
    nostr?: TNip07
  }
}

interface ImportMetaEnv {
  readonly VITE_DEFAULT_RELAY_SETS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
