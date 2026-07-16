import { LRUCache } from 'lru-cache'

export type TBoundedMapOptions<K, V> = {
  maxSize: number
  onDelete?: (value: V, key: K) => void
}

type TCacheEntry<V> = { value: V }
type TCacheKey = string | number | bigint | boolean | symbol | object

/**
 * A Map-compatible adapter backed by the well-tested lru-cache package.
 *
 * Values are wrapped so this retains normal Map semantics for `undefined`,
 * which lru-cache itself reserves as a cache miss. Iteration is exposed from
 * least-recently-used to most-recently-used, matching the insertion order the
 * previous Map implementation presented.
 */
export class BoundedMap<K extends TCacheKey, V> implements Map<K, V> {
  readonly [Symbol.toStringTag] = 'BoundedMap'
  private readonly cache: LRUCache<K, TCacheEntry<V>>

  constructor({ maxSize, onDelete }: TBoundedMapOptions<K, V>) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new RangeError('BoundedMap maxSize must be a positive integer')
    }

    this.cache = new LRUCache<K, TCacheEntry<V>>({
      max: maxSize,
      dispose: onDelete ? (entry, key) => onDelete(entry.value, key) : undefined
    })
  }

  get size(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  get(key: K): V | undefined {
    return this.cache.get(key)?.value
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  set(key: K, value: V): this {
    const existing = this.cache.peek(key)
    if (existing && Object.is(existing.value, value)) {
      // Refresh recency without replacing/disposal (important for object URLs).
      this.cache.get(key)
      return this
    }
    this.cache.set(key, { value })
    return this
  }

  *entries(): MapIterator<[K, V]> {
    for (const key of this.cache.rkeys()) {
      const entry = this.cache.peek(key)
      if (entry) yield [key, entry.value]
    }
  }

  *keys(): MapIterator<K> {
    yield* this.cache.rkeys()
  }

  *values(): MapIterator<V> {
    for (const key of this.cache.rkeys()) {
      const entry = this.cache.peek(key)
      if (entry) yield entry.value
    }
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void {
    for (const [key, value] of this) {
      callbackfn.call(thisArg, value, key, this)
    }
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries()
  }
}
