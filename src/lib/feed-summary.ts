import { Event, kinds, verifyEvent } from 'nostr-tools'
import { EmbeddedHashtagParser, EmbeddedUrlParser, parseContent } from './content-parser'
import {
  compareEvents,
  getEventAuthorPubkey,
  getEventKey,
  getEventFeedTimestamp
} from './event-core'

export type TFeedSummaryItem = { event: Event; reposters?: readonly string[] }
export type TFeedSummaryTopic = { name: string; notes: number; people: number; events: Event[] }
export type TFeedSummaryNote = {
  key: string
  event?: Event
  reposters: Set<string>
  quoters: Set<string>
  people: number
  replyCount: number
  score: number
}

const inlineTargets = new WeakMap<Event, Event | null>()
const eventTopics = new WeakMap<Event, readonly string[]>()
export const FEED_POPULARITY_WEIGHTS = { repost: 1, quote: 2, reply: 1 } as const

function isRepost(event: Event) {
  return event.kind === kinds.Repost || event.kind === kinds.GenericRepost
}

function getInlineTarget(event: Event) {
  if (inlineTargets.has(event)) return inlineTargets.get(event) ?? undefined
  let target: Event | undefined
  try {
    const candidate = JSON.parse(event.content)
    if (candidate && verifyEvent(candidate) && !isRepost(candidate)) target = candidate
  } catch {
    // Invalid or omitted inline content is normal; the reference can still be counted.
  }
  inlineTargets.set(event, target ?? null)
  return target
}

export function isSummaryReference(value: string) {
  if (/^[0-9a-f]{64}$/.test(value)) return true
  const coordinate = value.match(/^(\d+):[0-9a-f]{64}:.*$/)
  if (!coordinate) return false
  const kind = Number(coordinate[1])
  return (
    Number.isSafeInteger(kind) && (kinds.isReplaceableKind(kind) || kinds.isAddressableKind(kind))
  )
}

function getTopics(event: Event) {
  const cached = eventTopics.get(event)
  if (cached) return cached
  const tags = new Set(
    event.tags
      .filter(([name, value]) => name === 't' && value?.trim())
      .map(([, value]) => value.trim().replace(/^#/, '').normalize('NFC').toLowerCase())
  )
  // URLs claim their fragments first, so https://example.com/#section is not a topic.
  for (const node of parseContent(event.content, [EmbeddedUrlParser, EmbeddedHashtagParser])) {
    if (node.type === 'hashtag') tags.add(node.data.slice(1).normalize('NFC').toLowerCase())
  }
  const result = [...tags].filter((name) => name && name.length <= 100)
  eventTopics.set(event, result)
  return result
}

/** Aggregate the loaded sample only. No interaction queries or network access. */
export function summarizeFeed(
  items: readonly TFeedSummaryItem[],
  isAllowed: (event: Event) => boolean = () => true,
  getReplyCount: (key: string, event?: Event) => number = () => 0
) {
  const uniqueItems = new Map<string, { event: Event; reposters: Set<string> }>()
  for (const { event, reposters = [] } of items) {
    const key = getEventKey(event)
    const previous = uniqueItems.get(key)
    uniqueItems.set(key, {
      event: previous && compareEvents(previous.event, event) > 0 ? previous.event : event,
      reposters: new Set([...(previous?.reposters ?? []), ...reposters])
    })
  }
  const knownEvents = new Map<string, Event>()
  const aliases = new Map<string, string>()
  // Older revisions may still be quoted by ID while the feed shows the latest revision.
  for (const { event } of items) {
    if (!isRepost(event)) aliases.set(event.id, getEventKey(event))
  }
  const remember = (event: Event) => {
    const key = getEventKey(event)
    const previous = knownEvents.get(key)
    if (!previous || compareEvents(event, previous) > 0) knownEvents.set(key, event)
    aliases.set(event.id, key)
    aliases.set(key, key)
  }
  for (const { event } of uniqueItems.values()) {
    if (!isRepost(event)) remember(event)
    else {
      const target = getInlineTarget(event)
      if (target) remember(target)
    }
  }

  const notes = new Map<string, Event | undefined>()
  const people = new Set<string>()
  const popularity = new Map<string, TFeedSummaryNote>()
  let oldest: number | undefined
  let newest: number | undefined
  const getPopular = (reference: string) => {
    if (!isSummaryReference(reference)) return
    const key = aliases.get(reference) ?? reference
    const target = knownEvents.get(key)
    if (target && !isAllowed(target)) return
    let entry = popularity.get(key)
    if (!entry) {
      entry = {
        key,
        event: target,
        reposters: new Set(),
        quoters: new Set(),
        people: 0,
        replyCount: 0,
        score: 0
      }
      popularity.set(key, entry)
    }
    return entry
  }

  for (const { event, reposters } of uniqueItems.values()) {
    if (!isAllowed(event)) continue
    let key = getEventKey(event)
    let target: Event | undefined = knownEvents.get(key)
    if (isRepost(event)) {
      const reference =
        event.tags.find(([name]) => name === 'a')?.[1] ??
        event.tags.find(([name]) => name === 'e')?.[1]
      const inline = getInlineTarget(event)
      const targetKey = reference ?? (inline ? getEventKey(inline) : undefined)
      if (!targetKey || !isSummaryReference(targetKey)) continue
      key = aliases.get(targetKey) ?? targetKey
      target = knownEvents.get(key)
      if (target && !isAllowed(target)) continue
      const popular = getPopular(key)
      popular?.reposters.add(event.pubkey)
      people.add(event.pubkey)
    }
    if (target && !isAllowed(target)) continue
    // A loaded note can become popular through replies alone.
    getPopular(key)
    notes.set(key, target)
    if (target) people.add(getEventAuthorPubkey(target))
    const timestamp = getEventFeedTimestamp(target ?? event)
    if (Number.isSafeInteger(timestamp) && timestamp >= 0 && timestamp <= 8_640_000_000_000) {
      oldest = Math.min(oldest ?? timestamp, timestamp)
      newest = Math.max(newest ?? timestamp, timestamp)
    }

    if (reposters.size) {
      const popular = getPopular(key)
      for (const pubkey of reposters) {
        popular?.reposters.add(pubkey)
        people.add(pubkey)
      }
    }
    // Only explicit quote tags count. Reply/root e/a tags are not quotes.
    if (!isRepost(event)) {
      for (const [name, reference] of event.tags) {
        if (name === 'q' && reference)
          getPopular(reference)?.quoters.add(getEventAuthorPubkey(event))
      }
    }
  }

  const topics = new Map<string, { events: Event[]; authors: Set<string> }>()
  for (const event of notes.values()) {
    if (!event) continue
    for (const name of getTopics(event)) {
      const topic = topics.get(name) ?? { events: [], authors: new Set<string>() }
      topic.events.push(event)
      topic.authors.add(getEventAuthorPubkey(event))
      topics.set(name, topic)
    }
  }

  return {
    notes: notes.size,
    people: people.size,
    oldest,
    newest,
    topics: Array.from(topics, ([name, { events, authors }]): TFeedSummaryTopic => ({
      name,
      notes: events.length,
      people: authors.size,
      events
    })).sort((a, b) => b.notes - a.notes || b.people - a.people || a.name.localeCompare(b.name)),
    popularNotes: Array.from(popularity.values())
      .map((entry) => {
        const participants = new Set([...entry.reposters, ...entry.quoters])
        const replyCount = getReplyCount(entry.key, entry.event)
        // A person's quote supersedes their repost instead of counting both actions.
        const shareScore = [...participants].reduce(
          (sum, pubkey) =>
            sum +
            (entry.quoters.has(pubkey)
              ? FEED_POPULARITY_WEIGHTS.quote
              : FEED_POPULARITY_WEIGHTS.repost),
          0
        )
        return {
          ...entry,
          people: participants.size,
          replyCount,
          score: shareScore + replyCount * FEED_POPULARITY_WEIGHTS.reply
        }
      })
      .filter((entry) => entry.people >= 2 || entry.replyCount >= 3)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.people - a.people ||
          b.replyCount - a.replyCount ||
          a.key.localeCompare(b.key)
      )
  }
}
