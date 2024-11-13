/// <reference types="vite/client" />
import { TDraftEvent } from '@common/types'
import { Event } from 'nostr-tools'

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string | null>
      signEvent: (draftEvent: TDraftEvent) => Promise<Event | null>
    }
  }
}
