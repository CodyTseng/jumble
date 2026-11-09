import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  matchFilter,
  type Filter
} from 'nostr-tools'
import { BunkerSigner } from 'nostr-tools/nip46'
import { v2 as nip44 } from 'nostr-tools/nip44'
import { Nip46Pool } from './nip46-pool'
import { SmartPool } from './smart-pool'

vi.mock('./nostr-verifier', async () => {
  const { verifyEvent } = await import('nostr-tools/pure')
  return { initializeNostrVerifier: async () => true, verifyEvent }
})

const URL = 'wss://signer.example/'
const remoteSecret = generateSecretKey()
const remotePubkey = getPublicKey(remoteSecret)
const clientSecret = generateSecretKey()
const conversationKey = nip44.utils.getConversationKey(remoteSecret, getPublicKey(clientSecret))

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  readyState = 0
  subscriptions = new Map<string, Filter[]>()
  sent: unknown[][] = []
  onopen: (() => void) | null = null
  onclose: ((event: { message: string }) => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  constructor(_url: string | URL) {
    FakeWebSocket.instances.push(this)
    queueMicrotask(() => {
      this.readyState = 1
      this.onopen?.()
    })
  }

  send(message: string) {
    const frame = JSON.parse(message)
    this.sent.push(frame)
    const [type, payload, ...filters] = frame
    if (type === 'REQ') {
      this.subscriptions.set(payload, filters)
      this.receive(['EOSE', payload])
    } else if (type === 'CLOSE') {
      this.subscriptions.delete(payload)
    } else if (type === 'EVENT') {
      this.receive(['OK', payload.id, true, 'accepted'])
      if (payload.kind !== 24133) return
      const { id, method, params } = JSON.parse(nip44.decrypt(payload.content, conversationKey))
      const result =
        method === 'sign_event'
          ? JSON.stringify(finalizeEvent(JSON.parse(params[0]), remoteSecret))
          : method === 'get_public_key'
            ? remotePubkey
            : 'pong'
      const response = finalizeEvent(
        {
          kind: 24133,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', payload.pubkey]],
          content: nip44.encrypt(JSON.stringify({ id, result }), conversationKey)
        },
        remoteSecret
      )
      for (const [subId, subFilters] of this.subscriptions) {
        if (subFilters.some((filter) => matchFilter(filter, response))) {
          this.receive(['EVENT', subId, response])
        }
      }
    }
  }

  receive(frame: unknown[]) {
    queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(frame) }))
  }

  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.subscriptions.clear()
    this.onclose?.({ message: 'connection lost' })
  }
}

describe('NIP-46 managed relay transport', () => {
  let pool: SmartPool
  let signer: BunkerSigner
  let listeners: Map<string, () => void>

  beforeEach(() => {
    vi.useFakeTimers()
    listeners = new Map()
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('addEventListener', (type: string, listener: () => void) => {
      listeners.set(type, listener)
    })
    FakeWebSocket.instances = []
    pool = new SmartPool({ websocketImplementation: FakeWebSocket as unknown as typeof WebSocket })
    signer = BunkerSigner.fromBunker(
      clientSecret,
      {
        pubkey: remotePubkey,
        relays: [URL],
        secret: null
      },
      { pool: new Nip46Pool(pool) }
    )
  })

  afterEach(async () => {
    await signer.close()
    pool.close([URL])
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each(['wss://localhost:7447/', 'ws://localhost:7447/'])(
    'connects an explicitly configured local signer at %s and releases its grants',
    async (url) => {
      await signer.close()
      let grants = 0
      const release = vi.fn(() => {
        if (--grants === 0) pool.setTrustedInsecureRelayUrls([])
      })
      const acquire = vi.fn((urls: string[]) => {
        expect(urls).toEqual([url])
        grants++
        pool.setTrustedInsecureRelayUrls(urls)
        return release
      })
      const adapter = new Nip46Pool(pool, { urls: [url], acquire })
      signer = BunkerSigner.fromBunker(
        clientSecret,
        {
          pubkey: remotePubkey,
          relays: [url],
          secret: null
        },
        { pool: adapter }
      )
      try {
        expect(await signer.getPublicKey()).toBe(remotePubkey)
        await flushPromises()
        expect(grants).toBe(1)
        await signer.close()
        expect(grants).toBe(0)
        const calls = release.mock.calls.length
        adapter.dispose()
        // Closing an already closed adapter must not release a grant twice.
        expect(release).toHaveBeenCalledTimes(calls)
      } finally {
        adapter.dispose()
        pool.close([url])
      }
    }
  )

  it('does not grant exceptions to relays outside the signer configuration', async () => {
    await signer.close()
    await flushPromises()
    FakeWebSocket.instances = []
    const release = vi.fn()
    const acquire = vi.fn(() => release)
    const adapter = new Nip46Pool(pool, { urls: [URL], acquire })
    const sub = adapter.subscribe(['wss://localhost:7447/'], { kinds: [24133] }, {})
    await flushPromises()
    expect(acquire).toHaveBeenCalledWith([])
    expect(FakeWebSocket.instances).toHaveLength(0)
    sub.close()
    adapter.dispose()
    expect(release).toHaveBeenCalledOnce()
  })

  it('restores the response subscription on native resume and signs through the new socket', async () => {
    await signer.ping()
    const oldSocket = FakeWebSocket.instances[0]
    listeners.get('offline')?.()
    oldSocket.close()
    await flushPromises()
    expect(FakeWebSocket.instances).toHaveLength(1)

    listeners.get('online')?.()
    listeners.get('jumble:resume')?.()
    await flushPromises()
    expect(FakeWebSocket.instances).toHaveLength(2)
    const signed = await signer.signEvent({
      kind: 1,
      created_at: 1,
      tags: [],
      content: 'after resume'
    })
    expect(signed.pubkey).toBe(remotePubkey)
    expect(signed.content).toBe('after resume')
    expect(FakeWebSocket.instances[1].subscriptions.size).toBe(1)
  })

  it('shares the content socket and closing a signer leaves content subscribed', async () => {
    const content = pool.getRelay(URL).subscribe([{ kinds: [1] }], {})
    await signer.ping()
    expect(FakeWebSocket.instances).toHaveLength(1)
    const socket = FakeWebSocket.instances[0]
    expect(socket.subscriptions.size).toBe(2)
    await signer.close()
    await flushPromises()
    expect(socket.readyState).toBe(1)
    expect(socket.subscriptions.size).toBe(1)
    expect([...socket.subscriptions.values()][0]).toEqual([{ kinds: [1] }])
    content.close()
  })

  it('supports nostrconnect pairing and restores its subscription on native resume', async () => {
    await signer.close()
    await flushPromises()
    const connecting = BunkerSigner.fromURI(
      clientSecret,
      `nostrconnect://${getPublicKey(clientSecret)}?relay=${encodeURIComponent(URL)}&secret=pairing-secret`,
      { pool: new Nip46Pool(pool), skipSwitchRelays: true }
    )
    await flushPromises()
    const socket = FakeWebSocket.instances.at(-1)!
    const response = finalizeEvent(
      {
        kind: 24133,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', getPublicKey(clientSecret)]],
        content: nip44.encrypt(JSON.stringify({ result: 'pairing-secret' }), conversationKey)
      },
      remoteSecret
    )
    for (const subId of socket.subscriptions.keys()) {
      socket.receive(['EVENT', subId, response])
    }
    signer = await connecting
    expect(await signer.getPublicKey()).toBe(remotePubkey)
    socket.close()
    listeners.get('jumble:resume')?.()
    await flushPromises()
    await signer.ping()
    expect(FakeWebSocket.instances.at(-1)).not.toBe(socket)
    expect(FakeWebSocket.instances.at(-1)!.subscriptions.size).toBe(1)
  })

  it('resubscribes on the next request after a terminal CLOSED response', async () => {
    await signer.ping()
    const socket = FakeWebSocket.instances[0]
    const [subId] = socket.subscriptions.keys()
    socket.subscriptions.delete(subId)
    socket.receive(['CLOSED', subId, 'error: subscription expired'])
    await flushPromises()
    await signer.ping()
    expect(socket.subscriptions.size).toBe(1)
  })
})

async function flushPromises() {
  for (let index = 0; index < 50; index++) await Promise.resolve()
}
