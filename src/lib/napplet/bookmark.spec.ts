import { expect, it } from 'vitest'
import { finalizeEvent, getPublicKey } from 'nostr-tools'
import { isNappletBookmarked } from './bookmark'

const key = new Uint8Array(32).fill(9)
const pubkey = getPublicKey(key)
const manifest = (time: number, secret = key, identifier = 'app') =>
  finalizeEvent(
    {
      kind: 35129,
      created_at: time,
      content: 'App',
      tags: [
        ['d', identifier],
        ['x', 'a'.repeat(64)]
      ]
    },
    secret
  )

it('bookmarks app coordinates across upgrades but pins snapshot ids', () => {
  const event = manifest(1),
    upgraded = manifest(2)
  const snapshot = finalizeEvent(
    { kind: 5129, created_at: 1, content: 'Snapshot', tags: [['x', 'b'.repeat(64)]] },
    key
  )
  const list = finalizeEvent(
    {
      kind: 10003,
      created_at: 1,
      content: '',
      tags: [
        ['a', `35129:${pubkey}:app`],
        ['e', snapshot.id]
      ]
    },
    key
  )
  expect(isNappletBookmarked(event, list)).toBe(true)
  expect(isNappletBookmarked(upgraded, list)).toBe(true)
  expect(isNappletBookmarked(manifest(1, new Uint8Array(32).fill(10)), list)).toBe(false)
  expect(isNappletBookmarked(snapshot, list)).toBe(true)
  expect(isNappletBookmarked({ ...snapshot, id: 'f'.repeat(64) }, list)).toBe(false)
})
