import { Event, kinds, nip19 } from 'nostr-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFetchEvent } from './useFetchEvent'

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  fetchEvent: vi.fn(),
  listeners: new Set<(event: globalThis.Event) => void>()
}))

// Run effect lifecycles directly to exercise asynchronous fetch/publish races
// without needing a browser or rendering the detail page's UI.
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.states.length
    harness.states.push(initial)
    return [
      initial,
      (next: unknown) => {
        harness.states[index] = next
      }
    ]
  },
  useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect)
}))
vi.mock('@/providers/DeletedEventProvider', () => ({
  useDeletedEvent: () => ({ isEventDeleted: () => false })
}))
vi.mock('@/services/client.service', () => ({
  default: {
    fetchEvent: harness.fetchEvent,
    addEventListener: (_: string, listener: (event: globalThis.Event) => void) =>
      harness.listeners.add(listener),
    removeEventListener: (_: string, listener: (event: globalThis.Event) => void) =>
      harness.listeners.delete(listener)
  }
}))
vi.mock('@/services/lightning.service', () => ({ default: {} }))
vi.mock('@/services/thread.service', () => ({ default: { addRepliesToThread: vi.fn() } }))

const original: Event = {
  id: 'ab'.repeat(32),
  pubkey: 'cd'.repeat(32),
  kind: kinds.LongFormArticle,
  created_at: 123,
  content: 'Original',
  tags: [['d', 'article']],
  sig: ''
}
const updated = { ...original, id: 'ef'.repeat(32), created_at: 124, content: 'Updated' }
const address = nip19.naddrEncode({
  kind: original.kind,
  pubkey: original.pubkey,
  identifier: 'article'
})

function emit(event: Event) {
  for (const listener of harness.listeners) {
    listener(new CustomEvent('newEvent', { detail: { event } }))
  }
}

function mount(id: string = address) {
  // This test harness supplies the mocked hook dispatcher and runs effect cleanup explicitly.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useFetchEvent(id)
  const cleanups = harness.effects.map((effect) => effect())
  return () => cleanups.forEach((cleanup) => cleanup?.())
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useFetchEvent published article updates', () => {
  beforeEach(() => {
    harness.states.length = 0
    harness.effects.length = 0
    harness.listeners.clear()
    harness.fetchEvent.mockReset().mockResolvedValue(original)
  })

  it('updates a mounted article without changing its address and cleans up its listener', async () => {
    const unmount = mount()
    await flush()
    expect(harness.states[2]).toEqual(original)
    emit(updated)
    expect(harness.states[2]).toEqual(updated)
    expect(harness.fetchEvent).toHaveBeenCalledOnce()
    unmount()
    expect(harness.listeners.size).toBe(0)
  })

  it('does not let a delayed fetch overwrite a newly published version', async () => {
    let resolve!: (event: Event) => void
    harness.fetchEvent.mockReturnValue(
      new Promise<Event>((done) => {
        resolve = done
      })
    )
    mount()
    emit(updated)
    resolve(original)
    await flush()
    expect(harness.states[2]).toEqual(updated)
    expect(harness.states[0]).toBe(false)
  })

  it('ignores older versions and other article coordinates', async () => {
    mount()
    await flush()
    emit(updated)
    emit(original)
    emit({ ...updated, created_at: 125, tags: [['d', 'another-article']] })
    emit({ ...updated, created_at: 125, pubkey: '12'.repeat(32) })
    expect(harness.states[2]).toEqual(updated)
  })

  it('keeps immutable event-ID links on their requested version', async () => {
    mount(nip19.neventEncode({ id: original.id }))
    await flush()
    emit(updated)
    expect(harness.states[2]).toEqual(original)
    expect(harness.listeners.size).toBe(0)
  })
})
