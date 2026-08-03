/**
 * Lightweight cross-tab sync for Jumble (BroadcastChannel + localStorage fallback).
 * Used so follow/mute state updates in one tab appear in others without a full reload.
 */

export type TTabSyncMessage = {
  type: string
  accountPubkey?: string
  payload?: unknown
  ts: number
}

const CHANNEL_NAME = 'jumble-tab-sync'
const STORAGE_KEY = 'jumble:tab-sync'

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
    } catch {
      channel = null
    }
  }
  return channel
}

/** Publish a message to other tabs in this origin. */
export function publishTabSync(message: Omit<TTabSyncMessage, 'ts'>): void {
  const full: TTabSyncMessage = { ...message, ts: Date.now() }
  const ch = getChannel()
  if (ch) {
    try {
      ch.postMessage(full)
    } catch {
      // ignore closed channel
    }
  }
  // localStorage fallback for environments without BroadcastChannel
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full))
    // clear so same payload can fire again later
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // private mode / quota
  }
}

/** Subscribe to cross-tab messages. Returns unsubscribe. */
export function subscribeTabSync(handler: (msg: TTabSyncMessage) => void): () => void {
  const ch = getChannel()
  const onMessage = (ev: MessageEvent) => {
    const data = ev.data as TTabSyncMessage
    if (data && typeof data === 'object' && typeof data.type === 'string') {
      handler(data)
    }
  }
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY || !ev.newValue) return
    try {
      const data = JSON.parse(ev.newValue) as TTabSyncMessage
      if (data && typeof data.type === 'string') handler(data)
    } catch {
      // ignore
    }
  }

  ch?.addEventListener('message', onMessage)
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }

  return () => {
    ch?.removeEventListener('message', onMessage)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

export const TabSyncType = {
  FOLLOW_LIST_UPDATED: 'follow-list-updated',
  MUTE_LIST_UPDATED: 'mute-list-updated'
} as const
