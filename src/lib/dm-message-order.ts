import type { Event } from 'nostr-tools'

export const DM_MESSAGE_ORDER_TAG = 'ms'

let lastRumorTimestampMs = 0

export type TDmRumorTimestamp = {
  createdAt: number
  millisecond: number
}

/**
 * Allocate a monotonic timestamp for an outgoing private rumor.
 *
 * Nostr's `created_at` only has second precision. The millisecond component is
 * carried separately in an authenticated `ms` tag so rapid sends stay ordered
 * without pushing each following rumor one whole second into the future.
 */
export function nextDmRumorTimestamp(nowMs = Date.now()): TDmRumorTimestamp {
  lastRumorTimestampMs = Math.max(nowMs, lastRumorTimestampMs + 1)
  return {
    createdAt: Math.floor(lastRumorTimestampMs / 1000),
    millisecond: lastRumorTimestampMs % 1000
  }
}

/** Add a fresh millisecond ordering tag, replacing any stale copy. */
export function withDmMessageOrderTag(tags: string[][], millisecond: number): string[][] {
  return [
    ...tags.filter((tag) => tag[0] !== DM_MESSAGE_ORDER_TAG),
    [DM_MESSAGE_ORDER_TAG, String(millisecond)]
  ]
}

/**
 * Convert a rumor's second timestamp and optional `ms` tag to Jumble's local
 * ordering timestamp. Invalid or missing tags retain the legacy second value.
 */
export function getDmMessageCreatedAt(rumor: Pick<Event, 'created_at' | 'tags'>): number {
  const raw = rumor.tags.find((tag) => tag[0] === DM_MESSAGE_ORDER_TAG)?.[1]
  if (!raw || !/^\d+$/.test(raw)) return rumor.created_at

  const millisecond = Number(raw)
  if (!Number.isSafeInteger(millisecond) || millisecond < 0 || millisecond > 999) {
    return rumor.created_at
  }
  return rumor.created_at + millisecond / 1000
}
