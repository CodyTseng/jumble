import type { Event } from 'nostr-tools'

// NIP-01: newer replaceable events win; equal timestamps retain the lowest id.
export function compareEvents(a: Event, b: Event): number {
  if (a.created_at !== b.created_at) {
    return a.created_at - b.created_at
  }
  if (a.id !== b.id) {
    return a.id < b.id ? 1 : -1
  }
  return 0
}
