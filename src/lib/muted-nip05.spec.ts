import { describe, expect, it, vi } from 'vitest'
import {
  getPubkeysMutedByNip05Domain,
  isProfileMutedByNip05Domain,
  normalizeMutedNip05Domains
} from './muted-nip05'

describe('muted NIP-05 domains', () => {
  it('normalizes NIP-05 identifiers to lowercase domains', () => {
    expect(
      normalizeMutedNip05Domains([' Mostr.Pub ', '@Mostr.Pub/', 'alice@example.com'])
    ).toEqual(['mostr.pub', 'example.com'])
  })

  it('matches profiles by their NIP-05 domain', () => {
    expect(
      isProfileMutedByNip05Domain(
        { pubkey: 'pubkey1', nip05: 'alex_at_gleasonator.com@mostr.pub' },
        new Set(['mostr.pub']),
        new Set()
      )
    ).toBe(true)
  })

  it('does not mute followed profiles from a muted NIP-05 domain', () => {
    expect(
      isProfileMutedByNip05Domain(
        { pubkey: 'followed', nip05: 'friend@mostr.pub' },
        new Set(['mostr.pub']),
        new Set(['followed'])
      )
    ).toBe(false)
  })

  it('resolves muted pubkeys without checking followed profiles', async () => {
    const fetchProfile = vi.fn(async (pubkey: string) => ({
      pubkey,
      nip05: pubkey === 'bridge' ? 'bridge_user@mostr.pub' : 'user@example.com'
    }))

    const mutedPubkeys = await getPubkeysMutedByNip05Domain(
      ['bridge', 'regular', 'followed'],
      new Set(['mostr.pub']),
      new Set(['followed']),
      fetchProfile
    )

    expect(mutedPubkeys).toEqual(new Set(['bridge']))
    expect(fetchProfile).toHaveBeenCalledWith('bridge')
    expect(fetchProfile).toHaveBeenCalledWith('regular')
    expect(fetchProfile).not.toHaveBeenCalledWith('followed')
  })
})
