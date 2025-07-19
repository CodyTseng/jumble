import { ApplicationDataKey, ExtendedKind } from '@/constants'
import client from '@/services/client.service'
import mediaUpload from '@/services/media-upload.service'
import { TDraftEvent, TEmoji, TMailboxRelay, TRelaySet } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds, nip19 } from 'nostr-tools'
import {
  getReplaceableEventCoordinate,
  getRootETag,
  isProtectedEvent,
  isReplaceableEvent
} from './event'
import { generateBech32IdFromETag, tagNameEquals } from './tag'
import { normalizeHttpUrl } from './url'

// https://github.com/nostr-protocol/nips/blob/master/25.md
export function createReactionDraftEvent(event: Event, emoji: TEmoji | string = '+'): TDraftEvent {
  const tags: string[][] = []
  const hint = client.getEventHint(event.id)
  tags.push(['e', event.id, hint, event.pubkey])
  tags.push(['p', event.pubkey])
  if (event.kind !== kinds.ShortTextNote) {
    tags.push(['k', event.kind.toString()])
  }

  if (isReplaceableEvent(event.kind)) {
    tags.push(
      hint
        ? ['a', getReplaceableEventCoordinate(event), hint]
        : ['a', getReplaceableEventCoordinate(event)]
    )
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
  const images = extractImagesFromContent(content)
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

  const images = extractImagesFromContent(content)
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
    tags.push(['a', getReplaceableEventCoordinate(event)])
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

export function createBlossomServerListDraftEvent(servers: string[]): TDraftEvent {
  return {
    kind: ExtendedKind.BLOSSOM_SERVER_LIST,
    content: '',
    tags: servers.map((server) => ['server', normalizeHttpUrl(server)]),
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

async function extractRelatedEventIds(content: string, parentEvent?: Event) {
  const quoteEventIds: string[] = []
  let rootETag: string[] = []
  let parentETag: string[] = []
  const matches = content.match(/nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g)

  const addToSet = (arr: string[], item: string) => {
    if (!arr.includes(item)) arr.push(item)
  }

  for (const m of matches || []) {
    try {
      const id = m.split(':')[1]
      const { type, data } = nip19.decode(id)
      if (type === 'nevent') {
        addToSet(quoteEventIds, data.id)
      } else if (type === 'note') {
        addToSet(quoteEventIds, data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (parentEvent) {
    const _rootETag = getRootETag(parentEvent)
    if (_rootETag) {
      parentETag = [
        'e',
        parentEvent.id,
        client.getEventHint(parentEvent.id),
        'reply',
        parentEvent.pubkey
      ]

      const [, rootEventHexId, hint, , rootEventPubkey] = _rootETag
      if (rootEventPubkey) {
        rootETag = [
          'e',
          rootEventHexId,
          hint ?? client.getEventHint(rootEventHexId),
          'root',
          rootEventPubkey
        ]
      } else {
        const rootEventId = generateBech32IdFromETag(_rootETag)
        const rootEvent = rootEventId ? await client.fetchEvent(rootEventId) : undefined
        rootETag = rootEvent
          ? ['e', rootEvent.id, hint ?? client.getEventHint(rootEvent.id), 'root', rootEvent.pubkey]
          : ['e', rootEventHexId, hint ?? client.getEventHint(rootEventHexId), 'root']
      }
    } else {
      // reply to root event
      rootETag = [
        'e',
        parentEvent.id,
        client.getEventHint(parentEvent.id),
        'root',
        parentEvent.pubkey
      ]
    }
  }

  return {
    quoteEventIds,
    rootETag,
    parentETag
  }
}

async function extractCommentMentions(content: string, parentEvent: Event) {
  const quoteEventIds: string[] = []
  const parentEventIsReplaceable = isReplaceableEvent(parentEvent.kind)
  const rootCoordinateTag =
    parentEvent.kind === ExtendedKind.COMMENT
      ? parentEvent.tags.find(tagNameEquals('A'))
      : isReplaceableEvent(parentEvent.kind)
        ? ['A', getReplaceableEventCoordinate(parentEvent), client.getEventHint(parentEvent.id)]
        : undefined
  const rootEventId =
    parentEvent.kind === ExtendedKind.COMMENT
      ? parentEvent.tags.find(tagNameEquals('E'))?.[1]
      : parentEvent.id
  const rootKind =
    parentEvent.kind === ExtendedKind.COMMENT
      ? parentEvent.tags.find(tagNameEquals('K'))?.[1]
      : parentEvent.kind
  const rootPubkey =
    parentEvent.kind === ExtendedKind.COMMENT
      ? parentEvent.tags.find(tagNameEquals('P'))?.[1]
      : parentEvent.pubkey
  const rootUrl =
    parentEvent.kind === ExtendedKind.COMMENT
      ? parentEvent.tags.find(tagNameEquals('I'))?.[1]
      : undefined

  const parentEventId = parentEvent.id
  const parentCoordinate = parentEventIsReplaceable
    ? getReplaceableEventCoordinate(parentEvent)
    : undefined
  const parentKind = parentEvent.kind
  const parentPubkey = parentEvent.pubkey

  const addToSet = (arr: string[], item: string) => {
    if (!arr.includes(item)) arr.push(item)
  }

  const matches = content.match(/nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g)
  for (const m of matches || []) {
    try {
      const id = m.split(':')[1]
      const { type, data } = nip19.decode(id)
      if (type === 'nevent') {
        addToSet(quoteEventIds, data.id)
      } else if (type === 'note') {
        addToSet(quoteEventIds, data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return {
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
  }
}

function extractHashtags(content: string) {
  const hashtags: string[] = []
  const matches = content.match(/#[\p{L}\p{N}\p{M}]+/gu)
  matches?.forEach((m) => {
    const hashtag = m.slice(1).toLowerCase()
    if (hashtag) {
      hashtags.push(hashtag)
    }
  })
  return hashtags
}

function extractImagesFromContent(content: string) {
  return content.match(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp|heic)/gi)
}
