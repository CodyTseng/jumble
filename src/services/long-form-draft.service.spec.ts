import { StorageKey } from '@/constants'
import { TLongFormDraft } from '@/types/long-form-draft'
import { Event, kinds } from 'nostr-tools'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import longFormDraftService from './long-form-draft.service'

const values = new Map<string, string>()
const localStorage = {
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => values.set(key, value))
}

const article: Event = {
  id: 'ab'.repeat(32),
  pubkey: 'cd'.repeat(32),
  sig: '',
  kind: kinds.LongFormArticle,
  created_at: 200,
  content: 'Current published content',
  tags: [
    ['d', 'article'],
    ['title', 'Current title'],
    ['published_at', '100']
  ]
}

function createDraft(identifier: string, updatedAt: number): TLongFormDraft {
  return {
    identifier,
    title: identifier,
    summary: '',
    image: '',
    tags: [],
    content: `${identifier} content`,
    createdAt: updatedAt,
    updatedAt
  }
}

describe('LongFormDraftService', () => {
  beforeEach(() => {
    values.clear()
    vi.clearAllMocks()
    vi.stubGlobal('window', { localStorage })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('migrates the previous single-draft format without losing the draft', () => {
    const legacyDraft = createDraft('legacy', 1)
    values.set(StorageKey.LONG_FORM_DRAFT_MAP, JSON.stringify({ alice: legacyDraft }))

    expect(longFormDraftService.list('alice')).toEqual([legacyDraft])
    expect(JSON.parse(values.get(StorageKey.LONG_FORM_DRAFT_MAP) ?? '{}')).toEqual({
      alice: [legacyDraft]
    })
  })

  it('stores multiple drafts per account and sorts them by last update', () => {
    const older = createDraft('older', 1)
    const newer = createDraft('newer', 2)

    longFormDraftService.save('alice', older)
    longFormDraftService.save('alice', newer)

    expect(longFormDraftService.list('alice')).toEqual([newer, older])
  })

  it('updates and deletes only the matching draft', () => {
    const first = createDraft('first', 1)
    const second = createDraft('second', 2)
    longFormDraftService.save('alice', first)
    longFormDraftService.save('alice', second)

    const updatedFirst = { ...first, title: 'Updated', updatedAt: 3 }
    longFormDraftService.save('alice', updatedFirst)
    longFormDraftService.delete('alice', second.identifier)

    expect(longFormDraftService.list('alice')).toEqual([updatedFirst])
  })

  it('persists article edit metadata across draft reloads without affecting other accounts', () => {
    const draft = {
      ...createDraft('published-article', 2),
      publishedAt: 123,
      addClientTag: false,
      isNsfw: true,
      isProtectedEvent: true,
      minPow: 18,
      mentions: ['alice'],
      removedMentionPubkeys: ['bob'],
      additionalRelayUrls: ['wss://private.example.com'],
      postTargetItems: [{ type: 'relay' as const, url: 'wss://private.example.com' }],
      originalTags: [['d', 'published-article'], ['published_at', '123'], ['-']]
    }
    longFormDraftService.save('alice', draft)
    expect(longFormDraftService.get('alice', draft.identifier)).toEqual(draft)
    expect(longFormDraftService.get('bob', draft.identifier)).toBeUndefined()
  })

  it('loads the displayed article instead of edits based on an older published version', () => {
    const olderDraft = {
      ...createDraft('article', 300),
      publishedAt: 100,
      sourceEventId: '12'.repeat(32),
      originalTags: article.tags,
      content: 'Unpublished changes to an older version'
    }
    longFormDraftService.save(article.pubkey, olderDraft)

    const draft = longFormDraftService.startEditing(article)
    expect(draft).toMatchObject({
      identifier: 'article',
      content: article.content,
      title: 'Current title',
      sourceEventId: article.id
    })
    const saved = longFormDraftService.list(article.pubkey)
    expect(saved).toHaveLength(2)
    const preserved = saved.find((item) => item.identifier !== 'article')!
    expect(preserved.content).toBe(olderDraft.content)
    expect(preserved.publishedAt).toBeUndefined()
    expect(preserved.originalTags).toBeUndefined()
    expect(preserved.sourceEventId).toBeUndefined()
    expect(longFormDraftService.startEditing(article)).toEqual(draft)
    expect(longFormDraftService.list(article.pubkey)).toHaveLength(2)
  })

  it('resumes unsent edits only when they belong to the same source event', () => {
    const draft = longFormDraftService.startEditing(article)
    const edited = { ...draft, content: 'My unsent edits' }
    longFormDraftService.save(article.pubkey, edited)
    expect(longFormDraftService.startEditing(article)).toEqual(edited)
    expect(longFormDraftService.list(article.pubkey)).toHaveLength(1)
  })

  it('does not automatically restore legacy edit drafts without a source event ID', () => {
    longFormDraftService.save(article.pubkey, {
      ...createDraft('article', 300),
      publishedAt: 100
    })
    expect(longFormDraftService.startEditing(article).content).toBe(article.content)
    expect(longFormDraftService.list(article.pubkey)).toHaveLength(2)
  })
})
