import { expect, it, vi } from 'vitest'
import { finalizeEvent, getPublicKey } from 'nostr-tools'
import { signingRequest, type NappletSigningRequest } from './signing'
import { NappletActions } from './vendor/runtime/src/action-session'
import { NappletOutbox } from './vendor/runtime/src/outbox-session'

vi.mock('./relay', () => ({
  RelayPool: class {
    close() {}
  }
}))
const key = new Uint8Array(32).fill(13)
const pubkey = getPublicKey(key)

it('approval snapshots cannot mutate the event or relay plan being signed', () => {
  const template = { kind: 1, tags: [['t', 'original']], content: 'hello', created_at: 1 }
  const relays = ['wss://relay.example/']
  const request = signingRequest(pubkey, template, relays)
  request.event.tags[0][1] = 'changed'
  request.destinations.push('wss://other.example/')
  expect(template.tags).toEqual([['t', 'original']])
  expect(relays).toEqual(['wss://relay.example/'])
})

it('OUTBOX presents the actual signed payload and resolved publication destinations', async () => {
  const template = { kind: 1, tags: [['t', 'test']], content: 'hello', created_at: 1 }
  let shown: NappletSigningRequest | undefined
  const publish = vi.fn(async () => {})
  const outbox = new NappletOutbox({
    pubkey,
    signal: new AbortController().signal,
    consent: async (_text, _signal, request) => {
      shown = request
      return true
    },
    plan: async () => ['wss://resolved.example/'],
    sign: async (account, event) => {
      expect(shown).toEqual({
        accountPubkey: account,
        event,
        destinations: ['wss://resolved.example/'],
        operation: 'publish'
      })
      return finalizeEvent(event, key)
    },
    io: { publish }
  })
  try {
    expect(
      await outbox.handle({ type: 'outbox.publish', id: 'approved', event: template })
    ).toMatchObject({ ok: true })
    expect(publish).toHaveBeenCalledOnce()
  } finally {
    outbox.close()
  }
})

it('follow mutations sign the same timestamp and tags shown before a delayed approval', async () => {
  let shown: NappletSigningRequest | undefined
  let approve!: (value: boolean) => void
  const publish = vi.fn(async () => {})
  const sign = vi.fn(async (_account: string, event: Parameters<typeof finalizeEvent>[0]) => {
    expect(event).toEqual(shown?.event)
    return finalizeEvent(event, key)
  })
  const actions = new NappletActions({
    pubkey,
    sign,
    relays: ['wss://relay.example/'],
    signal: new AbortController().signal,
    consent: (_text, _signal, request) => {
      shown = request
      return new Promise((resolve) => {
        approve = resolve
      })
    },
    io: { query: async () => [], publish }
  })
  try {
    const result = actions.handle({ type: 'common.follow', pubkeys: ['a'.repeat(64)] })
    await vi.waitFor(() => expect(shown).toBeDefined())
    expect(shown).toMatchObject({
      event: { kind: 3, tags: [['p', 'a'.repeat(64)]] },
      accountPubkey: pubkey
    })
    expect(sign).not.toHaveBeenCalled()
    approve(true)
    expect(await result).toMatchObject({ ok: true })
    expect(sign).toHaveBeenCalledOnce()
  } finally {
    actions.close()
  }
})
