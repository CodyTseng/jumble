import { TDraftEvent } from '@common/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { getEventCoordinate, isReplaceable } from './event'

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
