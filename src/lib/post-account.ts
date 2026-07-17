import { ISigner, TAccount } from '@/types'
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'

export type TResolvedPostAccount = {
  pubkey: string
  signer: ISigner
  ownerPubkey?: string
  skipAuthorRelayLookup?: boolean
}

// Runtime-only metadata keeps the temporary account structurally identical to a
// normal nsec account. Nothing is added to TAccount or written to account storage,
// and the key can be garbage-collected with the composer.
const ephemeralAccountOwners = new WeakMap<TAccount, string>()

export function createEphemeralNsecAccount(ownerPubkey: string): TAccount {
  const secretKey = generateSecretKey()
  // Use the regular nsec account shape so signer construction follows the same
  // path as every other locally signed account.
  const account: TAccount = {
    pubkey: getPublicKey(secretKey),
    signerType: 'nsec',
    nsec: nip19.nsecEncode(secretKey)
  }
  ephemeralAccountOwners.set(account, ownerPubkey)
  return account
}

export function isEphemeralPostAccount(account: TAccount | null | undefined): boolean {
  return !!account && ephemeralAccountOwners.has(account)
}

export function isPostAccountSignable(account: TAccount): boolean {
  return account.signerType !== 'npub'
}

export async function resolvePostAccount(
  account: TAccount,
  getSignerForAccount: (account: TAccount) => Promise<ISigner | null>
): Promise<TResolvedPostAccount | null> {
  const signer = await getSignerForAccount(account)
  if (!signer) return null
  const ownerPubkey = ephemeralAccountOwners.get(account)
  if (!ownerPubkey) return { pubkey: account.pubkey, signer }
  // A one-time pubkey has no relay list to discover. ownerPubkey keeps the draft
  // grouped under the logged-in account without changing the event author.
  return {
    pubkey: account.pubkey,
    signer,
    ownerPubkey,
    skipAuthorRelayLookup: true
  }
}

export function restorePostAccount(
  isAnonymous: boolean,
  fallbackAccount: TAccount | null,
  ownerPubkey?: string
): TAccount | null {
  if (isAnonymous && ownerPubkey) {
    // Drafts persist only the boolean mode, never the temporary nsec. Reopening
    // an anonymous draft therefore creates a new one-time identity.
    return createEphemeralNsecAccount(ownerPubkey)
  }
  return fallbackAccount
}

export function getPostAccountPreviewPubkey(
  account: TAccount | null | undefined
): string | undefined {
  // Do not trigger profile lookups for a one-time pubkey that has no metadata.
  return account && !isEphemeralPostAccount(account) ? account.pubkey : undefined
}
