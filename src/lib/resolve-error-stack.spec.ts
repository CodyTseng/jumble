import { afterEach, expect, it, vi } from 'vitest'
import { resolveErrorStacks } from './resolve-error-stack'

const map = {
  version: 3,
  sources: ['../src/lib/event.ts'],
  sourcesContent: [''],
  names: ['getParentETag'],
  mappings: 'KAyCIA'
}

afterEach(() => vi.unstubAllGlobals())

it.each(['https://jumble.social', 'app://renderer'])(
  'maps Chrome and Firefox locations at %s, sharing each map request',
  async (origin) => {
    vi.stubGlobal('window', { location: { href: `${origin}/` } })
    const fetchMap = vi.fn().mockResolvedValue({ ok: true, json: async () => map })
    vi.stubGlobal('fetch', fetchMap)
    const location = `${origin}/assets/app.js:1:6`
    const resolved = await resolveErrorStacks([
      `TypeError: broken\n    at x (${location})`,
      `x@${location}`
    ])
    expect(resolved).toEqual([
      'TypeError: broken\n    at x (../src/lib/event.ts:42:5 [getParentETag])',
      'x@../src/lib/event.ts:42:5 [getParentETag]'
    ])
    expect(fetchMap).toHaveBeenCalledTimes(1)
    expect(fetchMap.mock.calls[0][0]).toBe(`${origin}/assets/app.js.map`)
  }
)

it.each(['missing', 'invalid', 'offline', 'unmapped'])(
  'preserves original locations when the map is %s',
  async (mode) => {
    vi.stubGlobal('window', { location: { href: 'https://jumble.social/' } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (mode === 'offline') throw new Error('offline')
        return {
          ok: mode !== 'missing',
          json: async () => {
            if (mode === 'invalid') throw new Error('invalid json')
            return { ...map, mappings: '' }
          }
        }
      })
    )
    const stack = 'Error: broken\n    at x (https://jumble.social/assets/app.js:1:6)'
    expect(await resolveErrorStacks([stack])).toEqual([stack])
  }
)

it('does not fetch external frames or non-JS locations', async () => {
  vi.stubGlobal('window', { location: { href: 'https://jumble.social/' } })
  const fetchMap = vi.fn()
  vi.stubGlobal('fetch', fetchMap)
  const stack = 'x@https://extension.example/script.js:1:6\nx@https://jumble.social/profile:1:6'
  expect(await resolveErrorStacks([stack])).toEqual([stack])
  expect(fetchMap).not.toHaveBeenCalled()
})

it('falls back after a map download times out', async () => {
  vi.useFakeTimers()
  try {
    vi.stubGlobal('window', { location: { href: 'https://jumble.social/' } })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')))
          })
      )
    )
    const stack = 'x@https://jumble.social/assets/app.js:1:6'
    const pending = resolveErrorStacks([stack])
    await vi.advanceTimersByTimeAsync(8000)
    expect(await pending).toEqual([stack])
  } finally {
    vi.useRealTimers()
  }
})
