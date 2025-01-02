/// <reference types="vite/client" />
import { TNip07 } from '@/types'

interface GitInfo {
  branch: string
  commit: string
}

declare global {
  interface Window {
    nostr?: TNip07
  }

  const __GIT_INFO__: GitInfo
}
