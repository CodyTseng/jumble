/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
/** Public application-data convention over NIP-78, not a new NAP domain. */
export const APP_DATA_PROFILE = 'soy.app-data/1'
export const APP_DATA_KIND = 30078
export const APP_DATA_MAX_BYTES = 16 * 1024
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type DataEvent = {
  kind: number
  content: string
  tags: string[][]
  created_at: number
  id: string
  pubkey: string
  sig: string
}
export type DataTemplate = Pick<DataEvent, 'kind' | 'content' | 'tags' | 'created_at'>
export type DataBody = {
  schema: string
  version: number
  title: string
  previous: string | null
  deleted: boolean
  data: Json
}
export type DataPolicy = {
  profile: typeof APP_DATA_PROFILE
  scope: string
  maxContentBytes: number
  relays: string[]
  defaultRelays: string[]
}
const hex = /^[a-f0-9]{64}$/
export function dataIdentifier(scope: string, collection: string, id: string) {
  if (
    typeof scope !== 'string' ||
    typeof collection !== 'string' ||
    typeof id !== 'string' ||
    !hex.test(scope) ||
    !/^[a-z][a-z0-9_-]{0,47}$/.test(collection) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(id)
  )
    throw new Error('app-data-invalid-id: use a collection name and a stable record ID.')
  return `${APP_DATA_PROFILE}:${scope}:${collection}:${id}`
}

/** JSON only, bounded before serialization; errors never echo rejected payloads. */
export function validateDataJson(value: unknown): asserts value is Json {
  let nodes = 0
  const seen = new Set<object>()
  const visit = (item: unknown, depth: number) => {
    if (++nodes > 4096 || depth > 12)
      throw new Error('app-data-too-complex: simplify the data or use Blossom.')
    if (item === null || typeof item === 'boolean') return
    if (typeof item === 'number' && Number.isFinite(item)) return
    if (typeof item === 'string' && item.length <= APP_DATA_MAX_BYTES) return
    if (typeof item !== 'object' || item === null || seen.has(item))
      throw new Error('app-data-invalid-json: data must contain only finite JSON values.')
    seen.add(item)
    if (Array.isArray(item)) {
      if (item.length > 1024)
        throw new Error('app-data-too-complex: arrays are limited to 1024 items.')
      for (const child of item) visit(child, depth + 1)
    } else {
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)
        throw new Error('app-data-invalid-json: use plain JSON objects.')
      const keys = Object.keys(item)
      if (
        keys.length > 128 ||
        keys.some(
          (key) => key.length > 128 || ['__proto__', 'constructor', 'prototype'].includes(key)
        )
      )
        throw new Error('app-data-invalid-json: invalid object keys or too many fields.')
      for (const key of keys) visit((item as Record<string, unknown>)[key], depth + 1)
    }
    seen.delete(item)
  }
  visit(value, 0)
}

export function dataTags(
  scope: string,
  collection: string,
  id: string,
  schema: string,
  version: number
) {
  return [
    ['d', dataIdentifier(scope, collection, id)],
    ['s', scope],
    ['c', collection],
    ['L', APP_DATA_PROFILE],
    ['l', schema, APP_DATA_PROFILE],
    ['v', String(version)]
  ]
}

export function decodeDataRecord(event: Pick<DataEvent, 'kind' | 'content' | 'tags'>) {
  if (
    event.kind !== APP_DATA_KIND ||
    typeof event.content !== 'string' ||
    new TextEncoder().encode(event.content).length > APP_DATA_MAX_BYTES
  )
    throw new Error('app-data-invalid-record: expected a kind-30078 record of at most 16 KiB.')
  let body: DataBody
  try {
    body = JSON.parse(event.content)
  } catch {
    throw new Error('app-data-invalid-json: record content must be JSON.')
  }
  validateDataJson(body)
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== 'object' ||
    Object.keys(body).sort().join(',') !== 'data,deleted,previous,schema,title,version' ||
    typeof body.schema !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,95}$/.test(body.schema) ||
    !Number.isSafeInteger(body.version) ||
    body.version < 1 ||
    body.version > 1000000 ||
    typeof body.title !== 'string' ||
    !body.title.trim() ||
    body.title.length > 160 ||
    /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(body.title) ||
    (body.previous !== null && (typeof body.previous !== 'string' || !hex.test(body.previous))) ||
    typeof body.deleted !== 'boolean' ||
    (body.deleted && (body.data !== null || body.previous === null))
  )
    throw new Error(
      'app-data-invalid-record: check schema, version, title, previous revision and deletion fields.'
    )
  if (!Array.isArray(event.tags) || event.tags.length !== 6)
    throw new Error('app-data-invalid-tags: use the documented application-data tags.')
  const d = event.tags.find((t) => t[0] === 'd')?.[1] ?? ''
  const parts = d.split(':')
  const [profile, scope, collection, id] = parts
  if (parts.length !== 4 || profile !== APP_DATA_PROFILE)
    throw new Error('app-data-invalid-id: unsupported record identifier.')
  const expected = dataTags(scope, collection, id, body.schema, body.version)
  if (
    !expected.every(
      (tag) => event.tags.filter((t) => JSON.stringify(t) === JSON.stringify(tag)).length === 1
    )
  )
    throw new Error('app-data-invalid-tags: record tags must match its schema and namespace.')
  return { scope, collection, id, identifier: d, body }
}
