import { finalizeEvent, getPublicKey, kinds, nip19 } from 'nostr-tools'
import { describe, expect, it, vi } from 'vitest'
import { NotificationProcessor } from './notification-processor'
import { getNotificationFilterType, notificationFilter } from './notification'

const key = new Uint8Array(32).fill(7),
  pubkey = getPublicKey(new Uint8Array(32).fill(8))
const event = () =>
  finalizeEvent(
    {
      kind: 1,
      created_at: 1700000000,
      tags: [['p', pubkey]],
      content: `nostr:${nip19.npubEncode(pubkey)}`
    },
    key
  )
function create(options: Partial<ConstructorParameters<typeof NotificationProcessor>[0]> = {}) {
  const notify = vi.fn(async () => {}),
    saveCursor = vi.fn(async () => {})
  const processor = new NotificationProcessor({
    pubkey,
    filters: new Set(['mentions']),
    filter: (value) =>
      notificationFilter(value, {
        pubkey,
        mutePubkeySet: new Set(),
        meetsMinTrustScore: async () => true,
        validateZapReceipt: async () => false
      }),
    canNotify: () => true,
    notify,
    saveCursor,
    now: () => 1700000010,
    maxAgeSeconds: 300,
    ...options
  })
  return { processor, notify, saveCursor }
}
describe('shared notification processor', () => {
  it('uses the same classification/filter rules and deduplicates concurrent relay deliveries', async () => {
    const { processor, notify, saveCursor } = create()
    const signed = event()
    expect(getNotificationFilterType(signed, pubkey)).toBe('mentions')
    await Promise.all([processor.process(signed), processor.process(signed)])
    expect(notify).toHaveBeenCalledExactlyOnceWith(signed, 'mentions')
    expect(saveCursor).toHaveBeenCalledOnce()
  })
  it('rejects invalid signatures and events outside the replay window', async () => {
    const { processor, notify } = create()
    await processor.process(JSON.parse(JSON.stringify({ ...event(), content: 'tampered' })))
    const expired = create({ now: () => 1800000000 })
    await expired.processor.process(event())
    expect(expired.notify).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })
  it('persists foreground-seen events without displaying an alert', async () => {
    const { processor, notify, saveCursor } = create({ canNotify: () => false })
    await processor.process(event())
    expect(notify).not.toHaveBeenCalled()
    expect(saveCursor).toHaveBeenCalledOnce()
  })
  it('restores the cursor only for its owner account', async () => {
    const signed = event()
    const same = create({ cursor: { pubkey, ids: [signed.id] } })
    await same.processor.process(signed)
    expect(same.notify).not.toHaveBeenCalled()
    const other = create({ cursor: { pubkey: '0'.repeat(64), ids: [signed.id] } })
    await other.processor.process(signed)
    expect(other.notify).toHaveBeenCalledOnce()
  })
  it('does not emit work that finishes after the account/session stops', async () => {
    let finish!: (value: boolean) => void
    const { processor, notify, saveCursor } = create({
      filter: () =>
        new Promise((resolve) => {
          finish = resolve
        })
    })
    const pending = processor.process(event())
    processor.stop()
    finish(true)
    await pending
    expect(notify).not.toHaveBeenCalled()
    expect(saveCursor).not.toHaveBeenCalled()
  })
  it('honors the shared muted-author and supported-target-kind filters', async () => {
    const signed = event()
    const muted = create({
      filter: (value) =>
        notificationFilter(value, {
          pubkey,
          mutePubkeySet: new Set([signed.pubkey]),
          meetsMinTrustScore: async () => true,
          validateZapReceipt: async () => false
        })
    })
    await muted.processor.process(signed)
    expect(muted.notify).not.toHaveBeenCalled()
    const reaction = finalizeEvent(
      {
        kind: kinds.Reaction,
        created_at: 1700000000,
        tags: [
          ['p', pubkey],
          ['k', '0']
        ],
        content: '+'
      },
      key
    )
    const unsupported = create({ filters: new Set(['likes']) })
    await unsupported.processor.process(reaction)
    expect(unsupported.notify).not.toHaveBeenCalled()
  })
})
