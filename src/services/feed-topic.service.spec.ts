import { Event } from 'nostr-tools'
import { describe, expect, it } from 'vitest'
import feedTopicService from './feed-topic.service'
import { summarizeFeed } from '@/lib/feed-summary'

const event = (id: number, pubkey = id, content = '#Nostr'): Event => ({
  id: id.toString(16).padStart(64, '0'),
  pubkey: pubkey.toString(16).padStart(64, '0'),
  kind: 1,
  created_at: id,
  content,
  tags: [],
  sig: ''
})

describe('feed topic snapshots', () => {
  it('stores exactly the deduplicated notes used to calculate the topic count', () => {
    const a = event(1),
      b = event(2),
      c = event(3),
      d = event(4, 1)
    const summary = summarizeFeed(
      [a, a, b, c, d, event(5, 5, '#other')].map((event) => ({ event }))
    )
    const topic = summary.topics.find((topic) => topic.name === 'nostr')!
    const snapshot = feedTopicService.getSnapshot(feedTopicService.createSnapshot(topic))!
    expect(topic.people).toBe(3)
    expect(topic.notes).toBe(4)
    expect(snapshot.events).toHaveLength(topic.notes)
    expect(snapshot.events).toEqual([d, c, b, a])
    topic.events.push(event(6))
    expect(snapshot.events).toHaveLength(4)
  })

  it('does not fetch or substitute another feed when a snapshot is unavailable', () => {
    expect(feedTopicService.getSnapshot('missing-snapshot')).toBeUndefined()
  })
})
