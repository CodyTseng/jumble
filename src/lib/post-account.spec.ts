import { describe, expect, it, vi } from 'vitest'
import { NsecSigner } from '@/providers/NostrProvider/nsec.signer'
import { TAccount } from '@/types'
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import {
  createEphemeralNsecAccount,
  getPostAccountPreviewPubkey,
  resolvePostAccount,
  restorePostAccount
} from './post-account'

function createNsecAccount(): TAccount {
  const secretKey = generateSecretKey()
  return {
    pubkey: getPublicKey(secretKey),
    signerType: 'nsec',
    nsec: nip19.nsecEncode(secretKey)
  }
}

function createSigner(account: TAccount) {
  const signer = new NsecSigner()
  signer.login(account.nsec!)
  return signer
}

describe('post account', () => {
  it('uses a normal nsec account for a one-time identity', async () => {
    const account = createEphemeralNsecAccount('owner-pubkey')
    const signer = createSigner(account)
    const getSignerForAccount = vi.fn(async () => signer)

    const resolved = await resolvePostAccount(account, getSignerForAccount)

    expect(account).toMatchObject({ signerType: 'nsec', nsec: expect.any(String) })
    expect(getSignerForAccount).toHaveBeenCalledWith(account)
    expect(resolved).toMatchObject({
      pubkey: account.pubkey,
      signer,
      ownerPubkey: 'owner-pubkey',
      skipAuthorRelayLookup: true
    })
    expect(getPostAccountPreviewPubkey(account)).toBeUndefined()
  })

  it('restores a fresh identity from the draft boolean', () => {
    const account = createEphemeralNsecAccount('owner-pubkey')
    const restored = restorePostAccount(true, null, 'owner-pubkey')

    expect(restored).toMatchObject({ signerType: 'nsec', nsec: expect.any(String) })
    expect(restored?.pubkey).not.toBe(account.pubkey)
  })

  it('resolves a stored account through the provided signer lookup', async () => {
    const account = createNsecAccount()
    const signer = createSigner(account)
    const getSignerForAccount = vi.fn(async () => signer)

    const resolved = await resolvePostAccount(account, getSignerForAccount)

    expect(getSignerForAccount).toHaveBeenCalledWith(account)
    expect(resolved).toEqual({ pubkey: account.pubkey, signer })
    expect(getPostAccountPreviewPubkey(account)).toBe(account.pubkey)
  })
})
