import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import { Event, kinds, nip19 } from 'nostr-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLongFormArticleDraftEvent } from './draft-event'
import { extractMentions } from './mentions'

vi.mock('@/services/client.service', () => ({
  default: { fetchEvent: vi.fn(), getEventHint: () => 'wss://relay.example.com' }
}))
vi.mock('@/services/lightning.service', () => ({
  default: { validateZapReceipt: vi.fn() }
}))
vi.mock('@/services/custom-emoji.service', () => ({ default: {} }))
vi.mock('@/services/media-upload.service', () => ({ default: {} }))

const pubkey = 'ab'.repeat(32)
const otherPubkey = 'ef'.repeat(32)
const event: Event = {
  id: 'cd'.repeat(32),
  pubkey,
  kind: kinds.ShortTextNote,
  content: '',
  tags: [],
  created_at: 123,
  sig: ''
}

describe('shared mention extraction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('adds embedded note authors to article p tags and deduplicates direct mentions', async () => {
    vi.mocked(client.fetchEvent).mockResolvedValue(event)
    const content = `${nip19.noteEncode(event.id)} ${nip19.neventEncode({ id: event.id })} ${nip19.npubEncode(pubkey)}`
    const { pubkeys } = await extractMentions(content)
    const article = createLongFormArticleDraftEvent({
      identifier: 'article',
      title: 'Article',
      content,
      mentions: pubkeys
    })

    expect(pubkeys).toEqual([pubkey])
    expect(client.fetchEvent).toHaveBeenCalledWith(nip19.noteEncode(event.id))
    expect(article.tags.filter(([name]) => name === 'p')).toEqual([['p', pubkey]])
    expect(article.tags).toContainEqual(['q', event.id, 'wss://relay.example.com'])
  })

  it('includes addressable article authors and uppercase profile references', async () => {
    const content = `[article](nostr:${nip19.naddrEncode({ kind: 30023, pubkey, identifier: 'article' })}) nostr:${nip19.nprofileEncode({ pubkey: otherPubkey }).toUpperCase()}`
    expect((await extractMentions(content)).pubkeys).toEqual([pubkey, otherPubkey])
    expect(client.fetchEvent).not.toHaveBeenCalled()
  })

  it('continues collecting direct mentions when an embedded event is unavailable', async () => {
    vi.mocked(client.fetchEvent).mockResolvedValue(undefined)
    const content = `nostr:${nip19.noteEncode(event.id)} nostr:${nip19.npubEncode(otherPubkey)}`
    expect((await extractMentions(content)).pubkeys).toEqual([otherPubkey])
  })

  it('preserves short-note parent and related-mention handling', async () => {
    const parent = { ...event, tags: [['p', otherPubkey]] }
    const result = await extractMentions(`nostr:${nip19.npubEncode(pubkey)}`, parent)
    expect(result).toEqual({
      pubkeys: [],
      relatedPubkeys: [otherPubkey],
      parentEventPubkey: pubkey
    })
  })

  it('does not mention authors from invalid zap receipts', async () => {
    vi.mocked(client.fetchEvent).mockResolvedValue({ ...event, kind: kinds.Zap })
    vi.mocked(lightning.validateZapReceipt).mockResolvedValue(false)
    expect((await extractMentions(`nostr:${nip19.noteEncode(event.id)}`)).pubkeys).toEqual([])
    expect(lightning.validateZapReceipt).toHaveBeenCalled()
  })
})
