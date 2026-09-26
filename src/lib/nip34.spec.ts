import { Event, nip19 } from 'nostr-tools'
import { describe, expect, it } from 'vitest'
import { ALLOWED_FILTER_KINDS, NIP_34_KINDS } from '@/constants'
import {
  getGitWorkshopUrl,
  getGitWorkshopRepositoryUrl,
  getNip34EventMetadata,
  getPatchSubject,
  isNip34EventKind
} from './nip34'

function createFakeEvent(event: Partial<Event>): Event {
  return {
    id: '0'.repeat(64),
    kind: 1,
    pubkey: '1'.repeat(64),
    content: '',
    created_at: 0,
    tags: [],
    sig: '2'.repeat(128),
    ...event
  }
}

describe('NIP-34 event metadata', () => {
  it('extracts repository announcement metadata and multi-value tags', () => {
    const event = createFakeEvent({
      kind: 30617,
      tags: [
        ['d', 'jumble'],
        ['name', 'Jumble'],
        ['description', 'A Nostr client'],
        ['web', 'https://example.com', 'https://mirror.example.com'],
        ['clone', 'https://example.com/jumble.git'],
        ['t', 'nostr']
      ]
    })

    expect(getNip34EventMetadata(event)).toMatchObject({
      type: 'repository',
      title: 'Jumble',
      repositoryId: 'jumble',
      description: 'A Nostr client',
      webUrls: ['https://example.com', 'https://mirror.example.com'],
      cloneUrls: ['https://example.com/jumble.git']
    })
  })

  it('extracts and cleans a folded git format-patch subject', () => {
    const event = createFakeEvent({
      kind: 1617,
      content:
        'From: Dev <dev@example.com>\nSubject: [PATCH v2 1/2] render NIP-34\n events\n\n---\n file | 1 +'
    })

    expect(getPatchSubject(event)).toBe('render NIP-34 events')
    expect(getNip34EventMetadata(event)?.title).toBe('render NIP-34 events')
  })

  it('extracts repository refs and status targets', () => {
    const repositoryState = createFakeEvent({
      kind: 30618,
      tags: [
        ['d', 'jumble'],
        ['HEAD', 'ref: refs/heads/main'],
        ['refs/heads/main', 'abc123'],
        ['refs/tags/v1.0.0', 'def456']
      ]
    })
    const status = createFakeEvent({
      kind: 1631,
      tags: [
        ['e', 'event-id', '', 'root'],
        ['merge-commit', 'abc123']
      ]
    })

    expect(getNip34EventMetadata(repositoryState)).toMatchObject({
      type: 'repository-state',
      head: 'ref: refs/heads/main',
      refs: [
        { name: 'refs/heads/main', commit: 'abc123' },
        { name: 'refs/tags/v1.0.0', commit: 'def456' }
      ]
    })
    expect(getNip34EventMetadata(status)).toMatchObject({
      type: 'status-applied',
      targetEventId: 'event-id',
      mergeCommit: 'abc123'
    })
  })

  it('recognizes every NIP-34 kind without treating arbitrary kinds as supported', () => {
    ;[1617, 1618, 1619, 1621, 1630, 1631, 1632, 1633, 10317, 30617, 30618].forEach((kind) =>
      expect(isNip34EventKind(kind)).toBe(true)
    )
    expect(isNip34EventKind(1)).toBe(false)
  })

  it('does not add NIP-34 kinds to feed filters', () => {
    NIP_34_KINDS.forEach((kind) => expect(ALLOWED_FILTER_KINDS).not.toContain(kind))
  })

  it('builds canonical GitWorkshop issue and pull request URLs', () => {
    const repoOwner = '3'.repeat(64)
    const npub = nip19.npubEncode(repoOwner)
    const issue = createFakeEvent({
      kind: 1621,
      tags: [['a', `30617:${repoOwner}:armada`, 'wss://relay.ditto.pub/']]
    })
    const pullRequest = createFakeEvent({
      kind: 1618,
      tags: [['a', `30617:${repoOwner}:my repo`, 'wss://relay.example.com']]
    })

    expect(getGitWorkshopUrl(issue, 'nevent1issue')).toBe(
      `https://gitworkshop.dev/${npub}/relay.ditto.pub/armada/issues/nevent1issue`
    )
    expect(getGitWorkshopUrl(pullRequest, 'nevent1pr')).toBe(
      `https://gitworkshop.dev/${npub}/relay.example.com/my%20repo/prs/nevent1pr`
    )
    expect(getGitWorkshopRepositoryUrl(issue)).toBe(
      `https://gitworkshop.dev/${npub}/relay.ditto.pub/armada`
    )
  })

  it('uses the GitWorkshop event resolver when a canonical item route is unavailable', () => {
    const status = createFakeEvent({ kind: 1631 })
    const graspList = createFakeEvent({ kind: 10317, tags: [['g', 'wss://grasp.example.com']] })

    expect(getGitWorkshopUrl(status, 'nevent1status')).toBe('https://gitworkshop.dev/nevent1status')
    expect(getGitWorkshopUrl(graspList, 'nevent1grasp')).toBe(
      'https://gitworkshop.dev/nevent1grasp'
    )
  })
})
