import type { TAccountPointer } from '@/types'

const sessions = new Set<() => void>()

export function nappletAccountKey(account: TAccountPointer | null) {
  return account ? `${account.pubkey}:${account.signerType}` : 'guest'
}

/** Retire sessions synchronously, before an account transition starts awaiting a signer. */
export function closeNappletSessions() {
  for (const close of [...sessions]) close()
}

export function registerNappletSession(close: () => void) {
  sessions.add(close)
  return () => sessions.delete(close)
}
