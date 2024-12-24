import { TDraftEvent } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { extractHashtags, extractMentions, getEventCoordinate, isReplaceable } from './event'

// https://github.com/nostr-protocol/nips/blob/master/25.md
export function createReactionDraftEvent(event: Event): TDraftEvent {
  const tags = event.tags.filter((tag) => tag.length >= 2 && ['e', 'p'].includes(tag[0]))
  tags.push(['e', event.id])
  tags.push(['p', event.pubkey])
  tags.push(['k', event.kind.toString()])

  if (isReplaceable(event.kind)) {
    tags.push(['a', getEventCoordinate(event)])
  }

  return {
    kind: kinds.Reaction,
    content: '+',
    tags,
    created_at: dayjs().unix()
  }
}

// https://github.com/nostr-protocol/nips/blob/master/18.md
export function createRepostDraftEvent(event: Event): TDraftEvent {
  const tags = [
    ['e', event.id], // TODO: url
    ['p', event.pubkey]
  ]

  return {
    kind: kinds.Repost,
    content: JSON.stringify(event),
    tags,
    created_at: dayjs().unix()
  }
}

export async function createShortTextNoteDraftEvent(
  content: string,
  options: {
    parentEvent?: Event
    addClientTag?: boolean
  } = {}
): Promise<TDraftEvent> {
  const { pubkeys, otherRelatedEventIds, quoteEventIds, rootEventId, parentEventId } =
    await extractMentions(content, options.parentEvent)
  const hashtags = extractHashtags(content)

  const tags = pubkeys
    .map((pubkey) => ['p', pubkey])
    .concat(otherRelatedEventIds.map((eventId) => ['e', eventId]))
    .concat(quoteEventIds.map((eventId) => ['q', eventId]))
    .concat(hashtags.map((hashtag) => ['t', hashtag]))

  if (rootEventId) {
    tags.push(['e', rootEventId, '', 'root'])
  }

  if (parentEventId) {
    tags.push(['e', parentEventId, '', 'reply'])
  }

  if (options.addClientTag) {
    tags.push(['client', 'jumble'])
  }

  return {
    kind: kinds.ShortTextNote,
    content,
    tags,
    created_at: dayjs().unix()
  }
}
