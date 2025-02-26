import { COMMENT_EVENT_KIND, PICTURE_EVENT_KIND } from '@/constants'
import client from '@/services/client.service'
import { TDraftEvent, TMailboxRelay, TRelaySet } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import {
  extractCommentMentions,
  extractHashtags,
  extractImagesFromContent,
  extractRelatedEventIds,
  getEventCoordinate,
  isProtectedEvent,
  isReplaceable
} from './event'

// https://github.com/nostr-protocol/nips/blob/master/25.md
export function createReactionDraftEvent(event: Event): TDraftEvent {
  const tags: string[][] = []
  const hint = client.getEventHint(event.id)
  tags.push(['e', event.id, hint, event.pubkey])
  tags.push(['p', event.pubkey])
  if (event.kind !== kinds.ShortTextNote) {
    tags.push(['k', event.kind.toString()])
  }

  if (isReplaceable(event.kind)) {
    tags.push(hint ? ['a', getEventCoordinate(event), hint] : ['a', getEventCoordinate(event)])
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
  const isProtected = isProtectedEvent(event)
  const tags = [
    ['e', event.id, client.getEventHint(event.id), '', event.pubkey],
    ['p', event.pubkey]
  ]

  return {
    kind: kinds.Repost,
    content: isProtected ? '' : JSON.stringify(event),
    tags,
    created_at: dayjs().unix()
  }
}

export async function createShortTextNoteDraftEvent(
  content: string,
  pictureInfos: { url: string; tags: string[][] }[],
  mentions: string[],
  options: {
    parentEvent?: Event
    addClientTag?: boolean
    protectedEvent?: boolean
  } = {}
): Promise<TDraftEvent> {
  const { otherRelatedEventIds, quoteEventIds, rootEventId, parentEventId } =
    await extractRelatedEventIds(content, options.parentEvent)
  const hashtags = extractHashtags(content)

  const tags = hashtags.map((hashtag) => ['t', hashtag])

  // imeta tags
  const { images } = extractImagesFromContent(content)
  if (images && images.length) {
    tags.push(...generateImetaTags(images, pictureInfos))
  }

  // q tags
  tags.push(...quoteEventIds.map((eventId) => ['q', eventId, client.getEventHint(eventId)]))

  // e tags
  if (rootEventId) {
    tags.push(['e', rootEventId, client.getEventHint(rootEventId), 'root'])
  }

  tags.push(...otherRelatedEventIds.map((eventId) => ['e', eventId, client.getEventHint(eventId)]))

  if (parentEventId) {
    tags.push(['e', parentEventId, client.getEventHint(parentEventId), 'reply'])
  }

  // p tags
  tags.push(...mentions.map((pubkey) => ['p', pubkey]))

  if (options.addClientTag) {
    tags.push(['client', 'jumble'])
  }

  if (options.protectedEvent) {
    tags.push(['-'])
  }

  return {
    kind: kinds.ShortTextNote,
    content,
    tags,
    created_at: dayjs().unix()
  }
}

// https://github.com/nostr-protocol/nips/blob/master/51.md
export function createRelaySetDraftEvent(relaySet: TRelaySet): TDraftEvent {
  return {
    kind: kinds.Relaysets,
    content: '',
    tags: [
      ['d', relaySet.id],
      ['title', relaySet.name],
      ...relaySet.relayUrls.map((url) => ['relay', url])
    ],
    created_at: dayjs().unix()
  }
}

export async function createPictureNoteDraftEvent(
  content: string,
  pictureInfos: { url: string; tags: string[][] }[],
  mentions: string[],
  options: {
    addClientTag?: boolean
    protectedEvent?: boolean
  } = {}
): Promise<TDraftEvent> {
  const { quoteEventIds } = await extractRelatedEventIds(content)
  const hashtags = extractHashtags(content)
  if (!pictureInfos.length) {
    throw new Error('No images found in content')
  }

  const tags = pictureInfos
    .map((info) => ['imeta', ...info.tags.map(([n, v]) => `${n} ${v}`)])
    .concat(hashtags.map((hashtag) => ['t', hashtag]))
    .concat(quoteEventIds.map((eventId) => ['q', eventId, client.getEventHint(eventId)]))
    .concat(mentions.map((pubkey) => ['p', pubkey]))

  if (options.addClientTag) {
    tags.push(['client', 'jumble'])
  }

  if (options.protectedEvent) {
    tags.push(['-'])
  }

  return {
    kind: PICTURE_EVENT_KIND,
    content,
    tags,
    created_at: dayjs().unix()
  }
}

export async function createCommentDraftEvent(
  content: string,
  parentEvent: Event,
  pictureInfos: { url: string; tags: string[][] }[],
  mentions: string[],
  options: {
    addClientTag?: boolean
    protectedEvent?: boolean
  } = {}
): Promise<TDraftEvent> {
  const {
    quoteEventIds,
    rootEventId,
    rootEventKind,
    rootEventPubkey,
    parentEventId,
    parentEventKind,
    parentEventPubkey
  } = await extractCommentMentions(content, parentEvent)
  const hashtags = extractHashtags(content)

  const tags = hashtags
    .map((hashtag) => ['t', hashtag])
    .concat(quoteEventIds.map((eventId) => ['q', eventId, client.getEventHint(eventId)]))

  const { images } = extractImagesFromContent(content)
  if (images && images.length) {
    tags.push(...generateImetaTags(images, pictureInfos))
  }

  tags.push(
    ...mentions.filter((pubkey) => pubkey !== parentEventPubkey).map((pubkey) => ['p', pubkey])
  )
  tags.push(
    ...[
      ['E', rootEventId, client.getEventHint(rootEventId), rootEventPubkey],
      ['K', rootEventKind.toString()],
      ['P', rootEventPubkey],
      ['e', parentEventId, client.getEventHint(parentEventId), parentEventPubkey],
      ['k', parentEventKind.toString()],
      ['p', parentEventPubkey]
    ]
  )

  if (options.addClientTag) {
    tags.push(['client', 'jumble'])
  }

  if (options.protectedEvent) {
    tags.push(['-'])
  }

  return {
    kind: COMMENT_EVENT_KIND,
    content,
    tags,
    created_at: dayjs().unix()
  }
}

export function createRelayListDraftEvent(mailboxRelays: TMailboxRelay[]): TDraftEvent {
  return {
    kind: kinds.RelayList,
    content: '',
    tags: mailboxRelays.map(({ url, scope }) =>
      scope === 'both' ? ['r', url] : ['r', url, scope]
    ),
    created_at: dayjs().unix()
  }
}

export function createFollowListDraftEvent(tags: string[][], content?: string): TDraftEvent {
  return {
    kind: kinds.Contacts,
    content: content ?? '',
    created_at: dayjs().unix(),
    tags
  }
}

export function createMuteListDraftEvent(tags: string[][], content?: string): TDraftEvent {
  return {
    kind: kinds.Mutelist,
    content: content ?? '',
    created_at: dayjs().unix(),
    tags
  }
}

export function createProfileDraftEvent(content: string, tags: string[][] = []): TDraftEvent {
  return {
    kind: kinds.Metadata,
    content,
    tags,
    created_at: dayjs().unix()
  }
}

function generateImetaTags(imageUrls: string[], pictureInfos: { url: string; tags: string[][] }[]) {
  return imageUrls.map((imageUrl) => {
    const pictureInfo = pictureInfos.find((info) => info.url === imageUrl)
    return pictureInfo
      ? ['imeta', ...pictureInfo.tags.map(([n, v]) => `${n} ${v}`)]
      : ['imeta', `url ${imageUrl}`]
  })
}
