import { ExtendedKind } from '@/constants'
import { Event } from 'nostr-tools'
import { describe, expect, it } from 'vitest'
import { getPeopleListInfo, getPeopleListPubkeys, getPeopleListTitle } from './people-list'

const author = 'a'.repeat(64)
const pubkeyA = 'b'.repeat(64)
const pubkeyB = 'c'.repeat(64)

function listEvent(tags: string[][]): Event {
  return {
    id: 'd'.repeat(64),
    pubkey: author,
    created_at: 1,
    kind: ExtendedKind.PEOPLE_LIST,
    tags,
    content: '',
    sig: 'e'.repeat(128)
  }
}

describe('people-list helpers', () => {
  it('reads a title and unique pubkeys from kind 30000 people lists', () => {
    const event = listEvent([
      ['d', 'builders'],
      ['title', 'Solana Builders'],
      ['p', pubkeyA],
      ['p', pubkeyB],
      ['p', pubkeyA]
    ])

    expect(getPeopleListTitle(event)).toBe('Solana Builders')
    expect(getPeopleListPubkeys(event)).toEqual([pubkeyA, pubkeyB])
  })

  it('creates naddr-backed list info when a d tag exists', () => {
    const event = listEvent([
      ['d', 'builders'],
      ['p', pubkeyA]
    ])

    const info = getPeopleListInfo(event, ['wss://relay.example.com'])
    expect(info?.naddr.startsWith('naddr1')).toBe(true)
    expect(info?.title).toBe('builders')
    expect(info?.pubkeys).toEqual([pubkeyA])
  })
})
