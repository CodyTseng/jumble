import { TLongFormDraft } from '@/types/long-form-draft'
import { Event } from 'nostr-tools'

export function createLongFormDraftFromEvent(event: Event): TLongFormDraft {
  const getTag = (name: string) => event.tags.find((tag) => tag[0] === name)?.[1]
  const publishedAt = Number(getTag('published_at') ?? event.created_at)
  return {
    identifier: getTag('d') ?? '',
    title: getTag('title') ?? '',
    summary: getTag('summary') ?? '',
    image: getTag('image') ?? '',
    tags: Array.from(new Set(event.tags.filter(([name]) => name === 't').map((tag) => tag[1]))),
    content: event.content,
    createdAt: event.created_at * 1000,
    updatedAt: Date.now(),
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : event.created_at,
    originalTags: event.tags,
    originalContent: event.content,
    sourceEventId: event.id,
    addClientTag: event.tags.some(([name]) => name === 'client'),
    isNsfw: event.tags.some(([name]) => name === 'content-warning'),
    isProtectedEvent: event.tags.some(([name]) => name === '-')
  }
}
