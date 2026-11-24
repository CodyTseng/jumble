import { finalizeEvent, kinds, matchFilters, type NostrEvent } from 'nostr-tools'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BackgroundNotificationRunner,
  type BackgroundNotificationConfig,
  type BackgroundPorts
} from './runner'

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static urls: string[] = []
  static events: NostrEvent[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  constructor(url: string) {
    FakeWebSocket.urls.push(url)
    queueMicrotask(() => {
      this.readyState = 1
      this.onopen?.()
    })
  }
  send(message: string) {
    if (!message.startsWith('["REQ"')) return
    const [, id, ...filters] = JSON.parse(message)
    queueMicrotask(() => {
      for (const event of FakeWebSocket.events) {
        if (matchFilters(filters, event)) {
          this.onmessage?.({ data: JSON.stringify(['EVENT', id, event]) })
        }
      }
      this.onmessage?.({ data: JSON.stringify(['EOSE', id]) })
    })
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
}

afterEach(() => {
  FakeWebSocket.events = []
  vi.useRealTimers()
})

describe('background local relay permissions', () => {
  it.each([
    [['wss://LOCALHOST:7447'], ['wss://localhost:7447/', 'wss://public.example/']],
    [[], ['wss://public.example/']],
    [undefined, ['wss://public.example/']]
  ])('allows only configured local relays (%j)', async (configuredRelayUrls, expected) => {
    vi.useFakeTimers()
    FakeWebSocket.urls = []
    const config: BackgroundNotificationConfig = {
      pubkey: 'a'.repeat(64),
      relays: ['wss://localhost:7447/', 'wss://192.168.1.1/', 'wss://public.example/'],
      configuredRelayUrls,
      enabledAt: 0,
      filters: [],
      descriptions: {},
      muted: [],
      trusted: [],
      minTrustScore: 0,
      hideMutedMentions: false,
      zapIssuer: ''
    }
    const ports: BackgroundPorts = {
      websocket: FakeWebSocket as unknown as typeof WebSocket,
      fetchJson: vi.fn(),
      saveCursor: vi.fn(),
      notify: vi.fn(),
      isForeground: () => false,
      isOnline: () => true,
      status: vi.fn(),
      error: vi.fn()
    }
    const runner = new BackgroundNotificationRunner(config, ports)
    try {
      await runner.start()
      for (let i = 0; i < 20; i++) await Promise.resolve()
      expect(FakeWebSocket.urls).toEqual(expected)
    } finally {
      runner.stop()
    }
  })
})

it('resolves an article reaction by ID and persists its muted notification in the cursor', async () => {
  const created_at = Math.floor(Date.now() / 1000)
  const article = finalizeEvent(
    { kind: kinds.LongFormArticle, created_at, tags: [['d', 'article']], content: 'New revision' },
    new Uint8Array(32).fill(8)
  )
  const reaction = finalizeEvent(
    {
      kind: kinds.Reaction,
      created_at,
      tags: [
        ['e', article.id],
        ['p', article.pubkey],
        ['k', `${article.kind}`]
      ],
      content: '+'
    },
    new Uint8Array(32).fill(9)
  )
  FakeWebSocket.events = [article, reaction]
  const ports: BackgroundPorts = {
    websocket: FakeWebSocket as unknown as typeof WebSocket,
    fetchJson: vi.fn(),
    saveCursor: vi.fn(),
    notify: vi.fn(),
    isForeground: () => false,
    isOnline: () => true,
    status: vi.fn(),
    error: vi.fn()
  }
  const runner = new BackgroundNotificationRunner(
    {
      pubkey: article.pubkey,
      relays: ['wss://public.example/'],
      enabledAt: created_at,
      filters: ['likes'],
      descriptions: {},
      muted: [],
      mutedNoteKeys: [`${article.kind}:${article.pubkey}:article`],
      trusted: [],
      minTrustScore: 0,
      hideMutedMentions: false,
      zapIssuer: ''
    },
    ports
  )
  try {
    await runner.start()
    await vi.waitFor(() =>
      expect(ports.saveCursor).toHaveBeenCalledWith({ pubkey: article.pubkey, ids: [reaction.id] })
    )
    expect(ports.notify).not.toHaveBeenCalled()
    expect(ports.error).not.toHaveBeenCalled()
  } finally {
    runner.stop()
  }
})
