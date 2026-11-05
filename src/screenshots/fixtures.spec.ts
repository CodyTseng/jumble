import { describe, expect, it } from 'vitest'
import { verifyEvent } from 'nostr-tools'
import { Invoice } from '@getalby/lightning-tools'
import { getNotificationFilterType, NOTIFICATION_KINDS } from '@/lib/notification'
import { getZapInfoFromEvent } from '@/lib/zap-info'
import { events, thread, users } from './fixtures'
import { queryFixtures, SmartPool } from './pool'

describe('offline screenshot fixtures', () => {
  it('uses signed, internally linked events for every supported notification category', () => {
    expect(events.every((event) => verifyEvent(event))).toBe(true)
    const ids = new Set(events.map((event) => event.id))
    for (const profile of events.filter((event) => event.kind === 0)) {
      expect(JSON.parse(profile.content).lud16).toMatch(/@wallet\.jumble\.social$/)
    }
    for (const event of events) {
      for (const tag of event.tags.filter(([name]) => name === 'e')) {
        expect(ids.has(tag[1]), `Missing target ${tag[1]} in ${event.id}`).toBe(true)
        expect(event.created_at).toBeGreaterThanOrEqual(
          events.find((target) => target.id === tag[1])!.created_at
        )
      }
    }
    const notifications = queryFixtures([
      { '#p': [users.mira.pubkey], kinds: NOTIFICATION_KINDS }
    ]).filter((event) => event.pubkey !== users.mira.pubkey)
    expect(
      new Set(notifications.map((event) => getNotificationFilterType(event, users.mira.pubkey)))
    ).toEqual(
      new Set([
        'replies',
        'likes',
        'reposts',
        'mentions',
        'quotes',
        'zaps',
        'highlights',
        'pollResponses'
      ])
    )
    expect(queryFixtures([{ '#e': [thread.id], kinds: [1] }]).length).toBeGreaterThan(4)
    const zap = events.find((event) => event.kind === 9735)!
    const info = getZapInfoFromEvent(zap)!
    expect(info.amount).toBe(21)
    expect(new Invoice({ pr: info.invoice! }).validatePreimage(info.preimage!)).toBe(true)
  })

  it('honors filters and limits, completes empty subscriptions and refuses publishing', async () => {
    const expected = queryFixtures([{ kinds: [1], authors: [users.theo.pubkey], limit: 1 }])
    expect(expected).toHaveLength(1)
    expect(expected[0].pubkey).toBe(users.theo.pubkey)
    const relay = await new SmartPool().ensureRelay('wss://never-connect.example/')
    await expect(relay.publish(thread)).rejects.toThrow('Publishing is disabled')
    await new Promise<void>((resolve) =>
      relay.subscribe([{ ids: ['0'.repeat(64)] }], {
        onevent: () => {
          throw new Error('An empty fixture query emitted an event')
        },
        oneose: resolve
      })
    )
  })
})
