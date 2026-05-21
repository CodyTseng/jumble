import { describe, expect, it } from 'vitest'
import { Event } from 'nostr-tools'

import { filterFollowedAuthors } from './feed-filter'

function makeEvent(pubkey: string): Event {
  return {
    id: `${pubkey}0`.slice(0, 64).padEnd(64, '0'),
    pubkey,
    created_at: 1,
    kind: 1,
    tags: [],
    content: '',
    sig: '0'.repeat(128)
  }
}

describe('filterFollowedAuthors', () => {
  it('keeps relay-set notes from unknown authors and removes notes from followed authors', () => {
    const followedAuthor = '1'.repeat(64)
    const unknownAuthor = '2'.repeat(64)

    const result = filterFollowedAuthors(
      [makeEvent(followedAuthor), makeEvent(unknownAuthor)],
      new Set([followedAuthor])
    )

    expect(result.map((event) => event.pubkey)).toEqual([unknownAuthor])
  })
})
