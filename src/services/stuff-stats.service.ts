import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { getEventKey, getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import { getEmojiInfosFromEmojiTags, tagNameEquals } from '@/lib/tag'
import client from '@/services/client.service'
import { TEmoji } from '@/types'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'

export type TStuffStats = {
  likeIdSet: Set<string>
  likes: { id: string; pubkey: string; created_at: number; emoji: TEmoji | string }[]
  repostPubkeySet: Set<string>
  reposts: { id: string; pubkey: string; created_at: number }[]
  zapPrSet: Set<string>
  zaps: { pr: string; pubkey: string; amount: number; created_at: number; comment?: string }[]
  updatedAt?: number
}

class StuffStatsService {
  static instance: StuffStatsService
  private stuffStatsMap: Map<string, Partial<TStuffStats>> = new Map()
  private stuffStatsSubscribers = new Map<string, Set<() => void>>()

  constructor() {
    if (!StuffStatsService.instance) {
      StuffStatsService.instance = this
    }
    return StuffStatsService.instance
  }

  async fetchStuffStats(stuff: Event | string, pubkey?: string | null) {
    const { event, externalContent } =
      typeof stuff === 'string'
        ? { event: undefined, externalContent: stuff }
        : { event: stuff, externalContent: undefined }
    const key = event ? getEventKey(event) : externalContent
    const oldStats = this.stuffStatsMap.get(key)
    let since: number | undefined
    if (oldStats?.updatedAt) {
      since = oldStats.updatedAt
    }
    const [relayList, authorProfile] = event
      ? await Promise.all([client.fetchRelayList(event.pubkey), client.fetchProfile(event.pubkey)])
      : []

    const replaceableCoordinate =
      event && isReplaceableEvent(event.kind) ? getReplaceableCoordinateFromEvent(event) : undefined

    const filters: Filter[] = []

    if (event) {
      filters.push(
        {
          '#e': [event.id],
          kinds: [kinds.Reaction],
          limit: 500
        },
        {
          '#e': [event.id],
          kinds: [kinds.Repost],
          limit: 100
        }
      )
    } else {
      filters.push({
        '#i': [externalContent],
        kinds: [ExtendedKind.EXTERNAL_CONTENT_REACTION],
        limit: 500
      })
    }

    if (replaceableCoordinate) {
      filters.push(
        {
          '#a': [replaceableCoordinate],
          kinds: [kinds.Reaction],
          limit: 500
        },
        {
          '#a': [replaceableCoordinate],
          kinds: [kinds.Repost],
          limit: 100
        }
      )
    }

    if (event && authorProfile?.lightningAddress) {
      filters.push({
        '#e': [event.id],
        kinds: [kinds.Zap],
        limit: 500
      })

      if (replaceableCoordinate) {
        filters.push({
          '#a': [replaceableCoordinate],
          kinds: [kinds.Zap],
          limit: 500
        })
      }
    }

    if (pubkey) {
      filters.push(
        event
          ? {
              '#e': [event.id],
              authors: [pubkey],
              kinds: [kinds.Reaction, kinds.Repost]
            }
          : {
              '#i': [externalContent],
              authors: [pubkey],
              kinds: [ExtendedKind.EXTERNAL_CONTENT_REACTION]
            }
      )

      if (replaceableCoordinate) {
        filters.push({
          '#a': [replaceableCoordinate],
          authors: [pubkey],
          kinds: [kinds.Reaction, kinds.Repost]
        })
      }

      if (event && authorProfile?.lightningAddress) {
        filters.push({
          '#e': [event.id],
          '#P': [pubkey],
          kinds: [kinds.Zap]
        })

        if (replaceableCoordinate) {
          filters.push({
            '#a': [replaceableCoordinate],
            '#P': [pubkey],
            kinds: [kinds.Zap]
          })
        }
      }
    }

    if (since) {
      filters.forEach((filter) => {
        filter.since = since
      })
    }

    const relays = relayList ? relayList.read.concat(BIG_RELAY_URLS).slice(0, 5) : BIG_RELAY_URLS

    const events: Event[] = []
    await client.fetchEvents(relays, filters, {
      onevent: (evt) => {
        this.updateStuffStatsByEvents([evt])
        events.push(evt)
      }
    })
    this.stuffStatsMap.set(key, {
      ...(this.stuffStatsMap.get(key) ?? {}),
      updatedAt: dayjs().unix()
    })
    return this.stuffStatsMap.get(key) ?? {}
  }

  subscribeStuffStats(stuffKey: string, callback: () => void) {
    let set = this.stuffStatsSubscribers.get(stuffKey)
    if (!set) {
      set = new Set()
      this.stuffStatsSubscribers.set(stuffKey, set)
    }
    set.add(callback)
    return () => {
      set?.delete(callback)
      if (set?.size === 0) this.stuffStatsSubscribers.delete(stuffKey)
    }
  }

  private notifyStuffStats(stuffKey: string) {
    const set = this.stuffStatsSubscribers.get(stuffKey)
    if (set) {
      set.forEach((cb) => cb())
    }
  }

  getStuffStats(stuffKey: string): Partial<TStuffStats> | undefined {
    return this.stuffStatsMap.get(stuffKey)
  }

  addZap(
    pubkey: string,
    eventId: string,
    pr: string,
    amount: number,
    comment?: string,
    created_at: number = dayjs().unix(),
    notify: boolean = true
  ) {
    const old = this.stuffStatsMap.get(eventId) || {}
    const zapPrSet = old.zapPrSet || new Set()
    const zaps = old.zaps || []
    if (zapPrSet.has(pr)) return

    zapPrSet.add(pr)
    zaps.push({ pr, pubkey, amount, comment, created_at })
    this.stuffStatsMap.set(eventId, { ...old, zapPrSet, zaps })
    if (notify) {
      this.notifyStuffStats(eventId)
    }
    return eventId
  }

  updateStuffStatsByEvents(events: Event[]) {
    const targetKeySet = new Set<string>()
    events.forEach((evt) => {
      let targetKey: string | undefined
      if (evt.kind === kinds.Reaction) {
        targetKey = this.addLikeByEvent(evt)
      } else if (evt.kind === ExtendedKind.EXTERNAL_CONTENT_REACTION) {
        targetKey = this.addExternalContentLikeByEvent(evt)
      } else if (evt.kind === kinds.Repost) {
        targetKey = this.addRepostByEvent(evt)
      } else if (evt.kind === kinds.Zap) {
        targetKey = this.addZapByEvent(evt)
      }
      if (targetKey) {
        targetKeySet.add(targetKey)
      }
    })
    targetKeySet.forEach((targetKey) => {
      this.notifyStuffStats(targetKey)
    })
  }

  private addLikeByEvent(evt: Event) {
    const targetEventId = evt.tags.findLast(tagNameEquals('e'))?.[1]
    if (!targetEventId) return

    const old = this.stuffStatsMap.get(targetEventId) || {}
    const likeIdSet = old.likeIdSet || new Set()
    const likes = old.likes || []
    if (likeIdSet.has(evt.id)) return

    let emoji: TEmoji | string = evt.content.trim()
    if (!emoji) return

    if (emoji.startsWith(':') && emoji.endsWith(':')) {
      const emojiInfos = getEmojiInfosFromEmojiTags(evt.tags)
      const shortcode = emoji.split(':')[1]
      const emojiInfo = emojiInfos.find((info) => info.shortcode === shortcode)
      if (emojiInfo) {
        emoji = emojiInfo
      } else {
        emoji = '+'
      }
    }

    likeIdSet.add(evt.id)
    likes.push({ id: evt.id, pubkey: evt.pubkey, created_at: evt.created_at, emoji })
    this.stuffStatsMap.set(targetEventId, { ...old, likeIdSet, likes })
    return targetEventId
  }

  private addExternalContentLikeByEvent(evt: Event) {
    const target = evt.tags.findLast(tagNameEquals('i'))?.[1]
    if (!target) return

    const old = this.stuffStatsMap.get(target) || {}
    const likeIdSet = old.likeIdSet || new Set()
    const likes = old.likes || []
    if (likeIdSet.has(evt.id)) return

    let emoji: TEmoji | string = evt.content.trim()
    if (!emoji) return

    if (emoji.startsWith(':') && emoji.endsWith(':')) {
      const emojiInfos = getEmojiInfosFromEmojiTags(evt.tags)
      const shortcode = emoji.split(':')[1]
      const emojiInfo = emojiInfos.find((info) => info.shortcode === shortcode)
      if (emojiInfo) {
        emoji = emojiInfo
      } else {
        emoji = '+'
      }
    }

    likeIdSet.add(evt.id)
    likes.push({ id: evt.id, pubkey: evt.pubkey, created_at: evt.created_at, emoji })
    this.stuffStatsMap.set(target, { ...old, likeIdSet, likes })
    return target
  }

  private addRepostByEvent(evt: Event) {
    const eventId = evt.tags.find(tagNameEquals('e'))?.[1]
    if (!eventId) return

    const old = this.stuffStatsMap.get(eventId) || {}
    const repostPubkeySet = old.repostPubkeySet || new Set()
    const reposts = old.reposts || []
    if (repostPubkeySet.has(evt.pubkey)) return

    repostPubkeySet.add(evt.pubkey)
    reposts.push({ id: evt.id, pubkey: evt.pubkey, created_at: evt.created_at })
    this.stuffStatsMap.set(eventId, { ...old, repostPubkeySet, reposts })
    return eventId
  }

  private addZapByEvent(evt: Event) {
    const info = getZapInfoFromEvent(evt)
    if (!info) return
    const { originalEventId, senderPubkey, invoice, amount, comment } = info
    if (!originalEventId || !senderPubkey) return

    return this.addZap(
      senderPubkey,
      originalEventId,
      invoice,
      amount,
      comment,
      evt.created_at,
      false
    )
  }
}

const instance = new StuffStatsService()

export default instance
