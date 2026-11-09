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
    const id = JSON.parse(message)[1]
    queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(['EOSE', id]) }))
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
}

afterEach(() => vi.useRealTimers())

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
