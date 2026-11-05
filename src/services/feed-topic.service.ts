import { BoundedMap } from '@/lib/bounded-map'
import { compareFeedEvents } from '@/lib/event-core'
import { TFeedSummaryTopic } from '@/lib/feed-summary'
import { Event } from 'nostr-tools'

export type TFeedTopicSnapshot = { name: string; events: Event[] }

class FeedTopicService {
  private snapshots = new BoundedMap<string, TFeedTopicSnapshot>({ maxSize: 20 })

  createSnapshot(topic: TFeedSummaryTopic) {
    const id = crypto.randomUUID()
    this.snapshots.set(id, {
      name: topic.name,
      events: [...topic.events].sort((a, b) => compareFeedEvents(b, a))
    })
    return id
  }

  getSnapshot(id: string) {
    return this.snapshots.get(id)
  }
}

export default new FeedTopicService()
