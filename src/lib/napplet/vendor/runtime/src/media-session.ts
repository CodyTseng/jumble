import { resourceUrl } from '../../client/src/bytes'
import { z } from 'zod'

const metadataSchema = z.object({
  title: z.string().max(200).optional(),
  artist: z.string().max(200).optional(),
  album: z.string().max(200).optional(),
  mediaType: z.enum(['audio', 'video']).optional(),
  duration: z.number().nonnegative().finite().optional(),
  artwork: z.unknown().optional()
})
const createSchema = z.object({
  id: z.string().min(1).max(128),
  owner: z.enum(['shell', 'napplet']),
  source: z
    .object({ url: z.string().max(4096), mimeType: z.string().max(100).optional() })
    .optional(),
  metadata: metadataSchema.optional(),
  autoplay: z.boolean().optional(),
  live: z.boolean().optional()
})
const actions = ['play', 'pause', 'stop', 'volume']
type Status = 'playing' | 'paused' | 'stopped' | 'buffering'
export type AudioView = {
  id: string
  title: string
  status: Status
  volume: number
  error?: string
}
type Session = AudioView & {
  audio: HTMLAudioElement
  source: string
  live: boolean
  revision: number
  cleanup: () => void
  pause: () => void
  cancelPrompt?: () => void
}
let focused: { pause: () => void } | undefined

/** NAP-MEDIA shell-owned audio. All objects, URLs and callbacks belong to one frame/account. */
export class NappletMedia {
  private sessions = new Map<string, Session>()
  private pending = new Set<string>()
  private alive = true
  private lifetime = new AbortController()
  private listeners = new Set<() => void>()
  private snapshot: AudioView[] = []
  constructor(
    private options: {
      manifest: string
      send: (message: Record<string, unknown>) => void
      activate: (label: string, play: () => void) => (() => void) | void
      audio?: () => HTMLAudioElement
      fetch?: typeof fetch
    }
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.snapshot
  private changed() {
    this.snapshot = [...this.sessions.values()].map(({ id, title, status, volume, error }) => ({
      id,
      title,
      status,
      volume,
      error
    }))
    this.listeners.forEach((fn) => fn())
  }
  private sendState(session: Session) {
    if (!this.alive || !this.sessions.has(session.id)) return
    session.volume = session.audio.volume
    this.options.send({
      type: 'media.state',
      sessionId: session.id,
      status: session.status,
      position: Number.isFinite(session.audio.currentTime) ? session.audio.currentTime : 0,
      ...(!session.live && Number.isFinite(session.audio.duration)
        ? { duration: session.audio.duration }
        : {}),
      volume: session.volume
    })
    this.changed()
  }
  private async create(message: Record<string, unknown>) {
    const id = message.id
    if (typeof id !== 'string' || !id || id.length > 128 || this.pending.has(id)) return
    const result = (value: Record<string, unknown>) => {
      if (this.alive) this.options.send({ type: 'media.session.create.result', id, ...value })
    }
    if (this.sessions.size + this.pending.size >= 4) {
      result({ error: 'session limit exceeded' })
      return
    }
    this.pending.add(id)
    try {
      const input = createSchema.parse(message)
      if (input.owner !== 'shell') throw new Error('unsupported owner mode')
      if (!input.source) throw new Error('missing source')
      const url = resourceUrl(input.source.url)
      if (url.protocol !== 'https:' || url.username || url.password || url.hash)
        throw new Error('source blocked')
      if (
        input.metadata?.mediaType === 'video' ||
        (input.source.mimeType && !input.source.mimeType.startsWith('audio/'))
      )
        throw new Error('unsupported source')
      const audio = (this.options.audio ?? (() => new Audio()))()
      audio.preload = 'none'
      audio.src = url.href
      const session: Session = {
        id: crypto.randomUUID(),
        title: input.metadata?.title || 'Audio',
        audio,
        source: url.href,
        live: !!input.live,
        status: 'stopped',
        volume: audio.volume,
        revision: 0,
        cleanup: () => {},
        pause: () => {}
      }
      const events = new AbortController()
      const state = (status: Status) => {
        if (!this.sessions.has(session.id)) return
        session.status = status
        if (status === 'playing') session.error = undefined
        this.sendState(session)
      }
      audio.addEventListener('playing', () => state('playing'), { signal: events.signal })
      audio.addEventListener(
        'pause',
        () => {
          if (session.status !== 'stopped') state('paused')
        },
        { signal: events.signal }
      )
      audio.addEventListener(
        'waiting',
        () => {
          if (!audio.paused) state('buffering')
        },
        { signal: events.signal }
      )
      audio.addEventListener('ended', () => state('stopped'), { signal: events.signal })
      audio.addEventListener(
        'error',
        () => {
          session.error = 'Audio unavailable. Check the stream or retry.'
          state('stopped')
        },
        { signal: events.signal }
      )
      audio.addEventListener('volumechange', () => this.sendState(session), {
        signal: events.signal
      })
      let lastTime = 0
      audio.addEventListener(
        'timeupdate',
        () => {
          if (Date.now() - lastTime > 500) {
            lastTime = Date.now()
            this.sendState(session)
          }
        },
        { signal: events.signal }
      )
      session.cleanup = () => {
        session.cancelPrompt?.()
        events.abort()
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      this.sessions.set(session.id, session)
      result({ sessionId: session.id, owner: 'shell' })
      // Let the correlated create promise attach listeners before the initial snapshots.
      setTimeout(() => {
        if (!this.alive || !this.sessions.has(session.id)) return
        this.options.send({ type: 'media.capabilities', sessionId: session.id, actions })
        this.options.send({ type: 'media.controls', sessionId: session.id, controls: actions })
        this.sendState(session)
        if (input.autoplay) void this.play(session)
      }, 0)
      this.changed()
    } catch (error) {
      result({
        error:
          error instanceof z.ZodError
            ? 'invalid media request'
            : error instanceof Error
              ? error.message
              : 'media unavailable'
      })
    } finally {
      this.pending.delete(id)
    }
  }
  private async play(session: Session, activated = false) {
    if (!this.alive || !this.sessions.has(session.id)) return
    session.cancelPrompt?.()
    session.cancelPrompt = undefined
    const revision = ++session.revision
    if (focused && focused !== session) focused.pause()
    // Store a stable focus owner so sessions in other iframe hosts also pause.
    const owner = session as Session & { pause: () => void }
    owner.pause = () => this.command(session.id, 'pause')
    focused = owner
    session.error = undefined
    session.status = 'buffering'
    if (!session.audio.getAttribute('src') || session.audio.error) {
      session.audio.src = session.source
      session.audio.load()
    }
    this.sendState(session)
    try {
      await session.audio.play()
    } catch (error) {
      if (!this.alive || !this.sessions.has(session.id) || session.revision !== revision) return
      session.status = 'paused'
      if (error instanceof Error && error.name === 'NotAllowedError') {
        session.error = 'Press Play audio to allow sound.'
        if (!activated) {
          const cancel = this.options.activate(session.title, () => {
            if (session.revision === revision) void this.play(session, true)
          })
          if (typeof cancel === 'function') session.cancelPrompt = cancel
        }
      } else if (!(error instanceof Error && error.name === 'AbortError')) {
        session.status = 'stopped'
        session.error = 'Audio unavailable. Check the stream or retry.'
      }
      this.sendState(session)
    }
  }
  command = (id: string, action: string, value?: unknown) => {
    const session = this.sessions.get(id)
    if (!session || !this.alive) return
    if (action === 'play') {
      void this.play(session)
      return
    }
    if (action === 'volume') {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)
        session.audio.volume = value
      return
    }
    if (action !== 'pause' && action !== 'stop') return
    session.cancelPrompt?.()
    session.cancelPrompt = undefined
    session.revision++
    session.status = action === 'stop' ? 'stopped' : 'paused'
    session.audio.pause()
    if (action === 'stop') {
      session.audio.removeAttribute('src')
      session.audio.load()
    }
    if (focused === session) focused = undefined
    this.sendState(session)
  }
  handle(message: Record<string, unknown>) {
    if (!this.alive) return
    if (message.type === 'media.session.create') {
      void this.create(message)
      return
    }
    const session = this.sessions.get(String(message.sessionId))
    if (!session) return
    if (message.type === 'media.command')
      this.command(session.id, String(message.action), message.value)
    if (message.type === 'media.session.update') {
      const metadata = metadataSchema.safeParse(message.metadata)
      if (metadata.success && metadata.data.title !== undefined) {
        session.title = metadata.data.title
        this.changed()
      }
    }
    if (message.type === 'media.session.destroy') {
      this.sessions.delete(session.id)
      session.revision++
      session.cleanup()
      if (focused === session) focused = undefined
      this.changed()
    }
    // The shell owns state and capabilities. Forged reports never change them.
  }
  close() {
    this.alive = false
    this.lifetime.abort()
    for (const session of this.sessions.values()) {
      if (focused === session) focused = undefined
      session.cleanup()
    }
    this.sessions.clear()
    this.changed()
  }
}
