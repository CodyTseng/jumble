import { describe, expect, it, vi } from 'vitest'
import { BoundedMap } from './bounded-map'

describe('BoundedMap', () => {
  it('evicts the least recently used entry', () => {
    const cache = new BoundedMap<string, number>({ maxSize: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)

    expect(Array.from(cache.entries())).toEqual([
      ['a', 1],
      ['c', 3]
    ])
  })

  it('supports undefined values without treating them as misses', () => {
    const cache = new BoundedMap<string, number | undefined>({ maxSize: 2 })
    cache.set('a', undefined)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)

    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
  })

  it('disposes replaced, evicted, deleted, and cleared values', () => {
    const onDelete = vi.fn()
    const cache = new BoundedMap<string, number>({ maxSize: 2, onDelete })
    cache.set('a', 1)
    cache.set('a', 2)
    cache.set('b', 3)
    cache.set('c', 4)
    cache.delete('b')
    cache.set('c', 4)
    cache.clear()

    expect(onDelete.mock.calls).toEqual([
      [1, 'a'],
      [2, 'a'],
      [3, 'b'],
      [4, 'c']
    ])
  })
})
