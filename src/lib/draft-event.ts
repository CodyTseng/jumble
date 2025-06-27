import { ApplicationDataKey, ExtendedKind } from '@/constants'
import client from '@/services/client.service'
import mediaUpload from '@/services/media-upload.service'
import { TDraftEvent, TEmoji, TMailboxRelay, TRelaySet } from '@/types'
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
export function createReactionDraftEvent(event: Event, emoji: TEmoji | string = '+'): TDraftEvent {
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

  let content: string
  if (typeof emoji === 'string') {
    content = emoji
  } else {
    content = `:${emoji.shortcode}:`
    tags.push(['emoji', emoji.shortcode, emoji.url])
  }

  return {
    kind: kinds.Reaction,
    content,
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

const shortTextNoteDraftEventCache: Map<string, TDraftEvent> = new Map()
export async function createShortTextNoteDraftEvent(
  content: string,
  mentions: string[],
  options: {
    parentEvent?: Event
    addClientTag?: boolean
    protectedEvent?: boolean
    isNsfw?: boolean
  } = {}
): Promise<TDraftEvent> {
  const { quoteEventIds, rootETag, parentETag } = await extractRelatedEventIds(
    content,
    options.parentEvent
  )
  const hashtags = extractHashtags(content)

  const tags = hashtags.map((hashtag) => ['t', hashtag])

  // imeta tags
  const { images } = extractImagesFromContent(content)
  if (images && images.length) {
    tags.push(...generateImetaTags(images))
  }

  // q tags
  tags.push(...quoteEventIds.map((eventId) => ['q', eventId, client.getEventHint(eventId)]))

  // e tags
  if (rootETag.length) {
    tags.push(rootETag)
  }

  if (parentETag.length) {
    tags.push(parentETag)
  }

  // p tags
  tags.push(...mentions.map((pubkey) => ['p', pubkey]))

  if (options.addClientTag) {
    tags.push(['client', 'jumble'])
  }

  if (options.isNsfw) {
    tags.push(['content-warning', 'NSFW'])
  }

  if (options.protectedEvent) {
    tags.push(['-'])
  }

  const baseDraft = {
    kind: kinds.ShortTextNote,
    content,
    tags
  }
  const cacheKey = JSON.stringify(baseDraft)
  const cache = shortTextNoteDraftEventCache.get(cacheKey)
  if (cache) {
    return cache
  }
  const draftEvent = { ...baseDraft, created_at: dayjs().unix() }
  shortTextNoteDraftEventCache.set(cacheKey, draftEvent)

  return draftEvent
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
    kind: ExtendedKind.PICTURE,
    content,
    tags,
    created_at: dayjs().unix()
  }
}

const commentDraftEventCache: Map<string, TDraftEvent> = new Map()
export async function createCommentDraftEvent(
  content: string,
  parentEvent: Event,
  mentions: string[],
  options: {
    addClientTag?: boolean
    protectedEvent?: boolean
    isNsfw?: boolean
  } = {}
): Promise<TDraftEvent> {
  const {
    quoteEventIds,
    rootEventId,
    rootCoordinateTag,
    rootKind,
    rootPubkey,
    rootUrl,
    parentEventId,
    parentCoordinate,
    parentKind,
    parentPubkey
  } = await extractCommentMentions(content, parentEvent)
  const hashtags = extractHashtags(content)

  const tags = hashtags
    .map((hashtag) => ['t', hashtag])
    .concat(quoteEventIds.map((eventId) => ['q', eventId, client.getEventHint(eventId)]))

  const { images } = extractImagesFromContent(content)
  if (images && images.length) {
    tags.push(...generateImetaTags(images))
  }

  tags.push(...mentions.filter((pubkey) => pubkey !== parentPubkey).map((pubkey) => ['p', pubkey]))

  if (rootCoordinateTag) {
    tags.push(rootCoordinateTag)
  } else if (rootEventId) {
    tags.push(
      rootPubkey
        ? ['E', rootEventId, client.getEventHint(rootEventId), rootPubkey]
        : ['E', rootEventId, client.getEventHint(rootEventId)]
    )
  }
  if (rootPubkey) {
    tags.push(['P', rootPubkey])
  }
  if (rootKind) {
    tags.push(['K', rootKind.toString()])
  }
  if (rootUrl) {
    tags.push(['I', rootUrl])
  }
  tags.push(
    ...[
      parentCoordinate
        ? ['a', parentCoordinate, client.getEventHint(parentEventId)]
        : ['e', parentEventId, client.getEventHint(parentEventId), parentPubkey],
      ['k', parentKind.toString()],
      ['p', parentPubkey]
    ]
  )

  if (options.addClientTag) {
    tags.push(['client', 'jumble'])
  }

  if (options.isNsfw) {
    tags.push(['content-warning', 'NSFW'])
  }

  if (options.protectedEvent) {
    tags.push(['-'])
  }

  const baseDraft = {
    kind: ExtendedKind.COMMENT,
    content,
    tags
  }
  const cacheKey = JSON.stringify(baseDraft)
  const cache = commentDraftEventCache.get(cacheKey)
  if (cache) {
    return cache
  }
  const draftEvent = { ...baseDraft, created_at: dayjs().unix() }
  commentDraftEventCache.set(cacheKey, draftEvent)

  return draftEvent
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

export function createFavoriteRelaysDraftEvent(
  favoriteRelays: string[],
  relaySetEvents: Event[]
): TDraftEvent {
  const tags: string[][] = []
  favoriteRelays.forEach((url) => {
    tags.push(['relay', url])
  })
  relaySetEvents.forEach((event) => {
    tags.push(['a', getEventCoordinate(event)])
  })
  return {
    kind: ExtendedKind.FAVORITE_RELAYS,
    content: '',
    tags,
    created_at: dayjs().unix()
  }
}

export function createSeenNotificationsAtDraftEvent(): TDraftEvent {
  return {
    kind: kinds.Application,
    content: 'Records read time to sync notification status across devices.',
    tags: [['d', ApplicationDataKey.NOTIFICATIONS_SEEN_AT]],
    created_at: dayjs().unix()
  }
}

export function createBookmarkDraftEvent(tags: string[][], content = ''): TDraftEvent {
  return {
    kind: kinds.BookmarkList,
    content,
    tags,
    created_at: dayjs().unix()
  }
}

function generateImetaTags(imageUrls: string[]) {
  return imageUrls
    .map((imageUrl) => {
      const tag = mediaUpload.getImetaTagByUrl(imageUrl)
      return tag ?? null
    })
    .filter(Boolean) as string[][]
}
