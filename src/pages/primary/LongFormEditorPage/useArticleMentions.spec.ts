import { describe, expect, it, vi } from 'vitest'
import { kinds, nip19 } from 'nostr-tools'
import { createLongFormDraftFromEvent } from '@/lib/long-form-article'
import { createLongFormArticleDraftEvent } from '@/lib/draft-event'
import { resolveArticleMentions, selectArticleMentions } from './useArticleMentions'

vi.mock('@/services/client.service', () => ({
  default: { fetchEvent: vi.fn(), getEventHint: () => '' }
}))
vi.mock('@/services/lightning.service', () => ({ default: {} }))
vi.mock('@/services/custom-emoji.service', () => ({ default: {} }))
vi.mock('@/services/media-upload.service', () => ({ default: {} }))

const author = '34'.repeat(32)
const alice = 'ab'.repeat(32)
const bob = 'cd'.repeat(32)
const carol = 'ef'.repeat(32)
const content = (...pubkeys: string[]) => pubkeys.map((p) => nip19.npubEncode(p)).join(' ')
const original = {
  id: '12'.repeat(32),
  pubkey: author,
  kind: kinds.LongFormArticle,
  created_at: 1,
  sig: '',
  content: content(alice, bob),
  tags: [
    ['d', 'article'],
    ['title', 'Article'],
    ['p', alice]
  ]
}

describe('article mention selection and published p tags', () => {
  it('selects every detected mention for a new article, excluding the author', async () => {
    const draft = {
      ...createLongFormDraftFromEvent(original),
      originalTags: undefined,
      originalContent: undefined,
      content: content(alice, author, bob),
      // A stale derived empty array must not act as manual deselection.
      mentions: [],
      removedMentionPubkeys: [alice, bob]
    }
    const resolved = await resolveArticleMentions(draft, author)
    const mentions = selectArticleMentions(resolved, draft)
    expect(resolved.potentialMentions).toEqual([alice, bob])
    expect(mentions).toEqual([alice, bob])
    const event = createLongFormArticleDraftEvent({ ...draft, mentions })
    expect(event.tags.filter(([name]) => name === 'p')).toEqual([
      ['p', alice],
      ['p', bob]
    ])
  })

  it('excludes self even when original p tags and saved selections include self', async () => {
    const draft = {
      ...createLongFormDraftFromEvent({
        ...original,
        content: content(author, alice),
        tags: [...original.tags, ['p', author]]
      }),
      mentionSelections: { [author]: true }
    }
    const resolved = await resolveArticleMentions(draft, author)
    expect(resolved.potentialMentions).toEqual([alice])
    const mentions = selectArticleMentions(resolved, draft)
    expect(mentions).toEqual([alice])
    expect(
      createLongFormArticleDraftEvent({ ...draft, mentions }).tags.filter(([n]) => n === 'p')
    ).toEqual([['p', alice]])
  })

  it('restores existing mentions from p tags and selects only newly added mentions by default', async () => {
    const draft = { ...createLongFormDraftFromEvent(original), content: content(alice, bob, carol) }
    const resolved = await resolveArticleMentions(draft, author)
    expect(resolved.potentialMentions).toEqual([alice, bob, carol])
    const mentions = selectArticleMentions(resolved, draft)
    expect(mentions).toEqual([alice, carol])
    expect(
      createLongFormArticleDraftEvent({ ...draft, mentions }).tags.filter(([n]) => n === 'p')
    ).toEqual([
      ['p', alice],
      ['p', carol]
    ])
  })

  it('keeps all original mentions unchecked when the existing article has no p tags', async () => {
    const draft = createLongFormDraftFromEvent({ ...original, tags: [['d', 'article']] })
    expect(selectArticleMentions(await resolveArticleMentions(draft, author), draft)).toEqual([])
    draft.content += ` ${content(carol)}`
    expect(selectArticleMentions(await resolveArticleMentions(draft, author), draft)).toEqual([
      carol
    ])
  })

  it('preserves manual choices through saving and reopening a draft', async () => {
    const draft = JSON.parse(
      JSON.stringify({
        ...createLongFormDraftFromEvent(original),
        content: content(alice, bob, carol),
        mentionSelections: { [alice]: false, [bob]: true, [carol]: false }
      })
    )
    const mentions = selectArticleMentions(await resolveArticleMentions(draft, author), draft)
    expect(mentions).toEqual([bob])
    expect(
      createLongFormArticleDraftEvent({ ...draft, mentions }).tags.filter(([n]) => n === 'p')
    ).toEqual([['p', bob]])
  })

  it('retains manually deselected users when their references are removed and reinserted', async () => {
    const draft = {
      ...createLongFormDraftFromEvent(original),
      content: content(alice),
      mentionSelections: { [carol]: false }
    }
    expect(selectArticleMentions(await resolveArticleMentions(draft, author), draft)).toEqual([
      alice
    ])
    draft.content = content(alice, carol)
    expect(selectArticleMentions(await resolveArticleMentions(draft, author), draft)).toEqual([
      alice
    ])
  })

  it('excludes original p-tag recipients that do not appear in the current text', async () => {
    const draft = createLongFormDraftFromEvent({ ...original, content: '' })
    const resolved = await resolveArticleMentions(draft, author)
    expect(resolved.potentialMentions).toEqual([])
    expect(selectArticleMentions(resolved, draft)).toEqual([])
  })

  it('removes deleted mentions from the list and p tags even when previously selected', async () => {
    const draft = {
      ...createLongFormDraftFromEvent(original),
      mentionSelections: { [alice]: true, [bob]: true }
    }
    expect(selectArticleMentions(await resolveArticleMentions(draft, author), draft)).toEqual([
      alice,
      bob
    ])
    draft.content = content(bob)
    const resolved = await resolveArticleMentions(draft, author)
    expect(resolved.potentialMentions).toEqual([bob])
    const mentions = selectArticleMentions(resolved, draft)
    expect(mentions).toEqual([bob])
    expect(
      createLongFormArticleDraftEvent({ ...draft, mentions }).tags.filter(([n]) => n === 'p')
    ).toEqual([['p', bob]])
  })

  it('keeps a mention until its last reference is removed', async () => {
    const draft = createLongFormDraftFromEvent(original)
    draft.content = content(alice, alice)
    expect((await resolveArticleMentions(draft, author)).potentialMentions).toEqual([alice])
    draft.content = content(alice)
    expect((await resolveArticleMentions(draft, author)).potentialMentions).toEqual([alice])
    draft.content = ''
    expect((await resolveArticleMentions(draft, author)).potentialMentions).toEqual([])
  })
})
