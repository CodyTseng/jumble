/// <reference types="vite/client" />
import { TNip07 } from '@/types'

declare global {
  interface Window {
    nostr?: TNip07
  }
}
