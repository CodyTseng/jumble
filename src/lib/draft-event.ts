import { ApplicationDataKey, ExtendedKind, POLL_TYPE } from '@/constants'
import client from '@/services/client.service'
import mediaUpload from '@/services/media-upload.service'
import {
  TDraftEvent,
  TEmoji,
  TMailboxRelay,
  TMailboxRelayScope,
  TPollCreateData,
  TRelaySet
} from '@/types'
import dayjs from 'dayjs'
import { Event, kinds, nip19 } from 'nostr-tools'
import {
  getReplaceableEventCoordinate,
  getRootETag,
  isProtectedEvent,
  isReplaceableEvent
} from './event'
import { randomString } from './random'
import { generateBech32IdFromETag, tagNameEquals } from './tag'

// https://github.com/nostr-protocol/nips/blob/master/25.md
export function createReactionDraftEvent(event: Event, emoji: TEmoji | string = '+'): TDraftEvent {
  const tags: string[][] = []
  tags.push(buildETag(event.id, event.pubkey))
  tags.push(buildPTag(event.pubkey))
  if (event.kind !== kinds.ShortTextNote) {
    tags.push(buildKTag(event.kind))
  }

  if (isReplaceableEvent(event.kind)) {
    tags.push(buildATag(event))
  }

  let content: string
  if (typeof emoji === 'string') {
    content = emoji
  } else {
    content = `:${emoji.shortcode}:`
    tags.push(buildEmojiTag(emoji))
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
  const tags = [buildETag(event.id, event.pubkey), buildPTag(event.pubkey)]

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

  const tags = hashtags.map((hashtag) => buildTTag(hashtag))

  // imeta tags
  const images = extractImagesFromContent(content)
  if (images && images.length) {
    tags.push(...generateImetaTags(images))
  }

  // q tags
  tags.push(...quoteEventIds.map((eventId) => buildQTag(eventId)))

  // e tags
  if (rootETag.length) {
    tags.push(rootETag)
  }

  if (parentETag.length) {
    tags.push(parentETag)
  }

  // p tags
  tags.push(...mentions.map((pubkey) => buildPTag(pubkey)))

  if (options.addClientTag) {
    tags.push(buildClientTag())
  }

  if (options.isNsfw) {
    tags.push(buildNsfwTag())
  }

  if (options.protectedEvent) {
    tags.push(buildProtectedTag())
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
      buildDTag(relaySet.id),
      buildTitleTag(relaySet.name),
      ...relaySet.relayUrls.map((url) => buildRelayTag(url))
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
    .map((info) => buildImetaTag(info.tags))
    .concat(hashtags.map((hashtag) => buildTTag(hashtag)))
    .concat(quoteEventIds.map((eventId) => buildQTag(eventId)))
    .concat(mentions.map((pubkey) => buildPTag(pubkey)))

  if (options.addClientTag) {
    tags.push(buildClientTag())
  }

  if (options.protectedEvent) {
    tags.push(buildProtectedTag())
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
  const { quoteEventIds, rootEventId, rootCoordinateTag, rootKind, rootPubkey, rootUrl } =
    await extractCommentMentions(content, parentEvent)
  const hashtags = extractHashtags(content)

  const tags = hashtags
    .map((hashtag) => buildTTag(hashtag))
    .concat(quoteEventIds.map((eventId) => buildQTag(eventId)))

  const images = extractImagesFromContent(content)
  if (images && images.length) {
    tags.push(...generateImetaTags(images))
  }

  tags.push(
    ...mentions.filter((pubkey) => pubkey !== parentEvent.pubkey).map((pubkey) => buildPTag(pubkey))
  )

  if (rootCoordinateTag) {
    tags.push(rootCoordinateTag)
  } else if (rootEventId) {
    tags.push(buildETag(rootEventId, rootPubkey, '', true))
  }
  if (rootPubkey) {
    tags.push(buildPTag(rootPubkey, true))
  }
  if (rootKind) {
    tags.push(buildKTag(rootKind, true))
  }
  if (rootUrl) {
    tags.push(buildITag(rootUrl, true))
  }
  tags.push(
    ...[
      isReplaceableEvent(parentEvent.kind)
        ? buildATag(parentEvent)
        : buildETag(parentEvent.id, parentEvent.pubkey),
      buildKTag(parentEvent.kind),
      buildPTag(parentEvent.pubkey)
    ]
  )

  if (options.addClientTag) {
    tags.push(buildClientTag())
  }

  if (options.isNsfw) {
    tags.push(buildNsfwTag())
  }

  if (options.protectedEvent) {
    tags.push(buildProtectedTag())
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
    tags: mailboxRelays.map(({ url, scope }) => buildRTag(url, scope)),
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
    tags.push(buildRelayTag(url))
  })
  relaySetEvents.forEach((event) => {
    tags.push(buildATag(event))
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
    tags: [buildDTag(ApplicationDataKey.NOTIFICATIONS_SEEN_AT)],
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
    tags: servers.map((server) => buildServerTag(server)),
    created_at: dayjs().unix()
  }
}

const pollDraftEventCache: Map<string, TDraftEvent> = new Map()
export async function createPollDraftEvent(
  author: string,
  question: string,
  mentions: string[],
  { isMultipleChoice, relays, options, endsAt }: TPollCreateData,
  {
    addClientTag,
    isNsfw
  }: {
    addClientTag?: boolean
    isNsfw?: boolean
  } = {}
): Promise<TDraftEvent> {
  const { quoteEventIds } = await extractRelatedEventIds(question)
  const hashtags = extractHashtags(question)

  const tags = hashtags.map((hashtag) => buildTTag(hashtag))

  // imeta tags
  const images = extractImagesFromContent(question)
  if (images && images.length) {
    tags.push(...generateImetaTags(images))
  }

  // q tags
  tags.push(...quoteEventIds.map((eventId) => buildQTag(eventId)))

  // p tags
  tags.push(...mentions.map((pubkey) => buildPTag(pubkey)))

  const validOptions = options.filter((opt) => opt.trim())
  tags.push(...validOptions.map((option) => ['option', randomString(9), option.trim()]))
  tags.push(['polltype', isMultipleChoice ? POLL_TYPE.MULTIPLE_CHOICE : POLL_TYPE.SINGLE_CHOICE])

  if (endsAt) {
    tags.push(['endsAt', endsAt.toString()])
  }

  if (relays.length) {
    relays.forEach((relay) => tags.push(buildRelayTag(relay)))
  } else {
    const relayList = await client.fetchRelayList(author)
    relayList.read.slice(0, 4).forEach((relay) => {
      tags.push(buildRelayTag(relay))
    })
  }

  if (addClientTag) {
    tags.push(buildClientTag())
  }

  if (isNsfw) {
    tags.push(buildNsfwTag())
  }

  const baseDraft = {
    content: question.trim(),
    kind: ExtendedKind.POLL,
    tags
  }
  const cacheKey = JSON.stringify(baseDraft)
  const cache = pollDraftEventCache.get(cacheKey)
  if (cache) {
    return cache
  }
  const draftEvent = { ...baseDraft, created_at: dayjs().unix() }
  pollDraftEventCache.set(cacheKey, draftEvent)

  return draftEvent
}

export function createPollResponseDraftEvent(
  pollEvent: Event,
  selectedOptionIds: string[]
): TDraftEvent {
  return {
    content: '',
    kind: ExtendedKind.POLL_RESPONSE,
    tags: [
      buildETag(pollEvent.id, pollEvent.pubkey),
      ...selectedOptionIds.map((optionId) => buildResponseTag(optionId))
    ],
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
      parentETag = buildETagWithMarker(parentEvent.id, parentEvent.pubkey, '', 'reply')

      const [, rootEventHexId, hint, , rootEventPubkey] = _rootETag
      if (rootEventPubkey) {
        rootETag = buildETagWithMarker(rootEventHexId, rootEventPubkey, hint, 'root')
      } else {
        const rootEventId = generateBech32IdFromETag(_rootETag)
        const rootEvent = rootEventId ? await client.fetchEvent(rootEventId) : undefined
        rootETag = rootEvent
          ? buildETagWithMarker(rootEvent.id, rootEvent.pubkey, hint, 'root')
          : buildETagWithMarker(rootEventHexId, rootEventPubkey, hint, 'root')
      }
    } else {
      // reply to root event
      rootETag = buildETagWithMarker(parentEvent.id, parentEvent.pubkey, '', 'root')
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
  const rootCoordinateTag =
    parentEvent.kind === ExtendedKind.COMMENT
      ? parentEvent.tags.find(tagNameEquals('A'))
      : isReplaceableEvent(parentEvent.kind)
        ? buildATag(parentEvent, true)
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
    parentEvent
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

function buildATag(event: Event, upperCase: boolean = false) {
  const coordinate = getReplaceableEventCoordinate(event)
  const hint = client.getEventHint(event.id)
  return trimTagEnd([upperCase ? 'A' : 'a', coordinate, hint])
}

function buildDTag(identifier: string) {
  return ['d', identifier]
}

function buildETag(
  eventHexId: string,
  pubkey: string = '',
  hint: string = '',
  upperCase: boolean = false
) {
  if (!hint) {
    hint = client.getEventHint(eventHexId)
  }
  return trimTagEnd([upperCase ? 'E' : 'e', eventHexId, hint, pubkey])
}

function buildETagWithMarker(
  eventHexId: string,
  pubkey: string = '',
  hint: string = '',
  marker: 'root' | 'reply' | '' = ''
) {
  if (!hint) {
    hint = client.getEventHint(eventHexId)
  }
  return trimTagEnd(['e', eventHexId, hint, marker, pubkey])
}

function buildITag(url: string, upperCase: boolean = false) {
  return [upperCase ? 'I' : 'i', url]
}

function buildKTag(kind: number | string, upperCase: boolean = false) {
  return [upperCase ? 'K' : 'k', kind.toString()]
}

function buildPTag(pubkey: string, upperCase: boolean = false) {
  return [upperCase ? 'P' : 'p', pubkey]
}

function buildQTag(eventHexId: string) {
  return trimTagEnd(['q', eventHexId, client.getEventHint(eventHexId)]) // TODO: pubkey
}

function buildRTag(url: string, scope: TMailboxRelayScope) {
  return scope === 'both' ? ['r', url, scope] : ['r', url]
}

function buildTTag(hashtag: string) {
  return ['t', hashtag]
}

function buildEmojiTag(emoji: TEmoji) {
  return ['emoji', emoji.shortcode, emoji.url]
}

function buildTitleTag(title: string) {
  return ['title', title]
}

function buildRelayTag(url: string) {
  return ['relay', url]
}

function buildServerTag(url: string) {
  return ['server', url]
}

function buildImetaTag(nip94Tags: string[][]) {
  return ['imeta', ...nip94Tags.map(([n, v]) => `${n} ${v}`)]
}

function buildResponseTag(value: string) {
  return ['response', value]
}

function buildClientTag() {
  return ['client', 'jumble']
}

function buildNsfwTag() {
  return ['content-warning', 'NSFW']
}

function buildProtectedTag() {
  return ['-']
}

function trimTagEnd(tag: string[]) {
  let endIndex = tag.length - 1
  while (endIndex >= 0 && tag[endIndex] === '') {
    endIndex--
  }

  return tag.slice(0, endIndex + 1)
}
