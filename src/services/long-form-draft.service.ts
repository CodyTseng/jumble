import { StorageKey } from '@/constants'
import { createLongFormDraftFromEvent } from '@/lib/long-form-article'
import { randomString } from '@/lib/random'
import { TLongFormDraft } from '@/types/long-form-draft'
import { Event } from 'nostr-tools'

type TStoredDraftMap = Record<string, TLongFormDraft[] | TLongFormDraft>
type TDraftMap = Record<string, TLongFormDraft[]>

class LongFormDraftService {
  startEditing(event: Event): TLongFormDraft {
    const articleDraft = createLongFormDraftFromEvent(event)
    const savedDraft = this.get(event.pubkey, articleDraft.identifier)
    if (savedDraft?.sourceEventId === event.id) {
      return { ...savedDraft, originalContent: event.content }
    }

    if (savedDraft) {
      // Preserve edits from an older (or unknown) version as a separate draft,
      // rather than silently applying them to the article currently displayed.
      const now = Date.now()
      this.save(event.pubkey, {
        ...savedDraft,
        identifier: randomString(16),
        createdAt: now,
        updatedAt: now,
        publishedAt: undefined,
        originalTags: undefined,
        originalContent: undefined,
        sourceEventId: undefined
      })
    }
    this.save(event.pubkey, articleDraft)
    return articleDraft
  }

  list(pubkey: string): TLongFormDraft[] {
    return [...(this.read()[pubkey] ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(pubkey: string, identifier: string): TLongFormDraft | undefined {
    return this.read()[pubkey]?.find((draft) => draft.identifier === identifier)
  }

  save(pubkey: string, draft: TLongFormDraft) {
    try {
      const drafts = this.read()
      const accountDrafts = drafts[pubkey] ?? []
      const index = accountDrafts.findIndex((item) => item.identifier === draft.identifier)
      drafts[pubkey] =
        index === -1
          ? [draft, ...accountDrafts]
          : accountDrafts.map((item, itemIndex) => (itemIndex === index ? draft : item))
      this.write(drafts)
    } catch (error) {
      console.error('Failed to save long-form draft', error)
    }
  }

  delete(pubkey: string, identifier: string) {
    try {
      const drafts = this.read()
      const remaining = (drafts[pubkey] ?? []).filter((draft) => draft.identifier !== identifier)
      if (remaining.length) drafts[pubkey] = remaining
      else delete drafts[pubkey]
      this.write(drafts)
    } catch (error) {
      console.error('Failed to delete long-form draft', error)
    }
  }

  private read(): TDraftMap {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(StorageKey.LONG_FORM_DRAFT_MAP) ?? '{}'
      ) as TStoredDraftMap
      const shouldMigrate = Object.values(stored).some((value) => !Array.isArray(value))
      const drafts = Object.fromEntries(
        Object.entries(stored).flatMap(([pubkey, value]) => {
          const drafts = (Array.isArray(value) ? value : [value]).filter(isLongFormDraft)
          return drafts.length ? [[pubkey, drafts]] : []
        })
      )
      if (shouldMigrate) this.write(drafts)
      return drafts
    } catch {
      return {}
    }
  }

  private write(drafts: TDraftMap) {
    window.localStorage.setItem(StorageKey.LONG_FORM_DRAFT_MAP, JSON.stringify(drafts))
  }
}

export default new LongFormDraftService()

function isLongFormDraft(value: unknown): value is TLongFormDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<TLongFormDraft>
  return (
    typeof draft.identifier === 'string' &&
    typeof draft.title === 'string' &&
    typeof draft.summary === 'string' &&
    typeof draft.image === 'string' &&
    Array.isArray(draft.tags) &&
    typeof draft.content === 'string' &&
    typeof draft.createdAt === 'number' &&
    typeof draft.updatedAt === 'number'
  )
}
