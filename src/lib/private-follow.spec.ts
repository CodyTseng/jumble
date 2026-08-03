import { describe, expect, it } from 'vitest'
import { canStorePrivateFollowsInContent } from './private-follow'

describe('canStorePrivateFollowsInContent (#141)', () => {
  it('allows empty content', () => {
    expect(canStorePrivateFollowsInContent(undefined)).toBe(true)
    expect(canStorePrivateFollowsInContent('')).toBe(true)
    expect(canStorePrivateFollowsInContent('   ')).toBe(true)
  })

  it('blocks classic NIP-02 relay preference maps', () => {
    expect(canStorePrivateFollowsInContent('{"wss://relay.example":{"read":true}}')).toBe(false)
  })

  it('allows ciphertext-looking content (nip04 style iv marker)', () => {
    expect(canStorePrivateFollowsInContent('abc?iv=xyz')).toBe(true)
  })

  it('allows non-JSON content', () => {
    expect(canStorePrivateFollowsInContent('{not-json')).toBe(true)
    expect(canStorePrivateFollowsInContent('encrypted-blob')).toBe(true)
  })
})
