/// <reference types="vite/client" />
import { TNip07 } from '@/types'

declare global {
  interface Window {
    nostr?: TNip07
  }

  const __GIT_COMMIT__: string
  const __APP_VERSION__: string
}

interface ImportMetaEnv {
  readonly VITE_DOMAIN_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
