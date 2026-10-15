const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
import { expect, test } from 'vitest'
import { NappletMedia } from './media-session'

class FakeAudio extends EventTarget {
  src = ''
  preload = ''
  volume = 1
  currentTime = 0
  duration = Infinity
  error = null
  paused = true
  denied = false
  loads = 0
  play() {
    if (this.denied) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'))
    this.paused = false
    this.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  }
  pause() {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }
  load() {
    this.loads++
  }
  removeAttribute() {
    this.src = ''
  }
  getAttribute() {
    return this.src
  }
}
function fixture() {
  const messages: any[] = [],
    players: FakeAudio[] = [],
    requests: { url: string; method: string }[] = []
  let activate: (() => void) | undefined
  const host = new NappletMedia({
    manifest: 'a'.repeat(64),
    send: (m) => messages.push(m),
    activate: (_, play) => {
      activate = play
    },
    audio: () => {
      const a = new FakeAudio()
      players.push(a)
      return a as unknown as HTMLAudioElement
    },
    fetch: (async (url: string, options: RequestInit) => {
      requests.push({ url, method: options.method! })
      return Response.json({ url: `/api/media?token=${crypto.randomUUID()}` })
    }) as typeof fetch
  })
  const create = async (overrides: Record<string, unknown> = {}) => {
    const id = crypto.randomUUID()
    host.handle({
      type: 'media.session.create',
      id,
      owner: 'shell',
      live: true,
      source: { url: 'https://audio.example/live.mp3', mimeType: 'audio/mpeg' },
      ...overrides
    })
    for (let i = 0; i < 50 && !messages.some((m) => m.id === id); i++) await sleep(1)
    return messages.find((m) => m.id === id)
  }
  return { host, messages, players, requests, create, activate: () => activate?.() }
}
test('canonical media sessions play, pause, stop and clean up without trusting frame state', async () => {
  const f = fixture()
  try {
    const result = await f.create({ sessionId: 'creator-hint' })
    expect(result.owner).toBe('shell')
    expect(result.sessionId).not.toBe('creator-hint')
    const id = result.sessionId
    await sleep(5)
    expect(f.messages.find((m) => m.type === 'media.capabilities').actions).toEqual([
      'play',
      'pause',
      'stop',
      'volume'
    ])
    f.host.handle({ type: 'media.command', sessionId: 'creator-hint', action: 'play' })
    expect(f.players[0].paused).toBe(true)
    f.host.handle({ type: 'media.command', sessionId: id, action: 'play' })
    expect(f.host.getSnapshot()[0].status).toBe('playing')
    f.host.handle({ type: 'media.state', sessionId: id, status: 'stopped' })
    expect(f.host.getSnapshot()[0].status).toBe('playing')
    f.host.command(id, 'volume', 0.4)
    f.host.command(id, 'volume', 99)
    expect(f.players[0].volume).toBe(0.4)
    f.host.command(id, 'seek', 30)
    expect(f.players[0].currentTime).toBe(0)
    f.host.command(id, 'pause')
    expect(f.players[0].paused).toBe(true)
    f.host.command(id, 'play')
    f.host.command(id, 'stop')
    expect(f.players[0].src).toBe('')
    f.host.command(id, 'play')
    expect(f.players[0].src).toBe('https://audio.example/live.mp3')
    f.host.handle({ type: 'media.session.destroy', sessionId: id })
    expect(f.host.getSnapshot()).toEqual([])
    expect(f.players[0].src).toBe('')
    expect(f.requests).toHaveLength(0)
  } finally {
    f.host.close()
  }
})
test('missing/unsupported sources, owner modes and excessive sessions return correlated errors', async () => {
  const f = fixture()
  try {
    for (const override of [
      { owner: undefined },
      { owner: 'napplet' },
      { source: undefined },
      { source: { url: 'http://audio.example' } },
      { metadata: { mediaType: 'video' } }
    ])
      expect((await f.create(override)).error).toBeTypeOf('string')
    expect(f.requests).toHaveLength(0)
    for (let i = 0; i < 4; i++) expect((await f.create()).sessionId).toBeTypeOf('string')
    expect((await f.create()).error).toBe('session limit exceeded')
  } finally {
    f.host.close()
  }
})
test('browser gesture denial is recoverable, focus pauses other sessions and stale gestures do nothing', async () => {
  const f = fixture()
  try {
    const first = (await f.create()).sessionId,
      second = (await f.create()).sessionId
    f.players[0].denied = true
    f.host.command(first, 'play')
    await sleep(1)
    expect(f.host.getSnapshot()[0].error).toContain('Play audio')
    f.players[0].denied = false
    f.activate()
    expect(f.players[0].paused).toBe(false)
    f.host.command(second, 'play')
    expect(f.players[0].paused).toBe(true)
    f.players[0].denied = true
    f.host.command(first, 'play')
    await sleep(1)
    f.host.close()
    f.players[0].denied = false
    f.activate()
    expect(f.players.every((p) => p.paused && !p.src)).toBe(true)
    expect(f.host.getSnapshot()).toEqual([])
  } finally {
    f.host.close()
  }
})
