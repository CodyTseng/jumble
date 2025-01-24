/// <reference types="vite/client" />
import { TNip07 } from '@/types'

interface NstartModalProps {
  baseUrl: string
  an: string
  // Callbacks
  onComplete: (result: { nostrLogin: string | null }) => void
  onCancel: () => void
}

declare global {
  interface Window {
    nostr?: TNip07
    NstartModal: new (props: NstartModalProps) => { open: () => void }
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
