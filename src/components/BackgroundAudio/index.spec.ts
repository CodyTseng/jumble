import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BackgroundAudio from './index'

const harness = vi.hoisted(() => ({
  playback: undefined as unknown,
  effects: [] as (() => () => void)[],
  media: new EventTarget()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initial: unknown) => {
    if (harness.playback === undefined) harness.playback = initial
    return [
      harness.playback,
      (next: unknown) => {
        harness.playback = typeof next === 'function' ? next(harness.playback) : next
      }
    ]
  },
  useEffect: (effect: () => () => void) => harness.effects.push(effect)
}))
vi.mock('@/services/media-manager.service', () => ({ default: harness.media }))
vi.mock('../AudioPlayer', () => ({ default: 'audio-player' }))

const play = (src = 'https://example.com/audio.mp3', time = 12) => {
  harness.media.dispatchEvent(new CustomEvent('playAudioBackground', { detail: { src, time } }))
}

describe('responsive background audio', () => {
  let cleanup: () => void
  beforeEach(() => {
    harness.playback = undefined
    harness.effects = []
    BackgroundAudio({})
    cleanup = harness.effects[0]()
  })
  afterEach(() => cleanup())

  it('updates placement without replacing the current player or its playback position', () => {
    play()
    const desktop = BackgroundAudio({ className: 'desktop-position' })!
    const mobile = BackgroundAudio({ className: 'mobile-position' })!
    expect(mobile.type).toBe(desktop.type)
    expect(mobile.key).toBe(desktop.key)
    expect(mobile.props.startTime).toBe(12)
    expect(mobile.props.className).toBe('mobile-position')
  })

  it('transfers the same audio again at the updated inline playback position', () => {
    play()
    const first = BackgroundAudio({})!
    play(undefined, 30)
    const second = BackgroundAudio({})!
    expect(second.props.src).toBe(first.props.src)
    expect(second.props.startTime).toBe(30)
    expect(second.props.autoPlay).toBe(true)
    expect(second.key).not.toBe(first.key)
  })

  it('restarts a paused floating player even if the URL and requested time are unchanged', () => {
    play()
    const first = BackgroundAudio({})!
    play()
    const second = BackgroundAudio({})!
    expect(second.props.startTime).toBe(first.props.startTime)
    expect(second.props.autoPlay).toBe(true)
    expect(second.key).not.toBe(first.key)
  })

  it('allows the same audio to restart after stopping, including batched stop/play requests', () => {
    play()
    const first = BackgroundAudio({})!
    harness.media.dispatchEvent(new Event('stopAudioBackground'))
    play()
    expect(BackgroundAudio({})!.key).not.toBe(first.key)
    harness.media.dispatchEvent(new Event('stopAudioBackground'))
    expect(BackgroundAudio({})).toBeNull()
    play(undefined, 30)
    expect(BackgroundAudio({})!.props.startTime).toBe(30)
  })
})
