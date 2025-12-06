import { createShortTextNoteDraftEvent } from '@/lib/draft-event'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { describe, expect, it, vi } from 'vitest'
import { TestSigner } from './fixtures'
import { loadSchema } from './schemata'

vi.mock('@/services/client.service', () => ({
  __esModule: true,
  default: {
    getEventHint: () => undefined,
    fetchEvent: async () => undefined,
    fetchEmojiSetEvents: async () => [],
    replaceableEventDataLoader: { load: async () => undefined, clear: () => {} },
    fetchReplaceableEvent: async () => undefined,
    fetchReplaceableEventsFromBigRelays: async () => []
  }
}))

vi.mock('@/services/media-upload.service', () => ({
  __esModule: true,
  default: {
    getImetaTagByUrl: () => null
  }
}))

vi.mock('@/services/custom-emoji.service', () => ({
  __esModule: true,
  default: {
    getEmojiById: () => undefined
  }
}))

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

// Base schemas registered so downstream $refs resolve in-memory.
const secp256k1Schema = loadSchema('secp256k1/schema.yaml', '@/secp256k1.yaml')
const tagSchema = loadSchema('tag/schema.yaml', '@/tag.yaml')
const noteSchema = loadSchema('note/schema.yaml', '@/note.yaml')

ajv.addSchema(secp256k1Schema)
ajv.addSchema(tagSchema)
ajv.addSchema(noteSchema)

const validateKind1 = ajv.compile(loadSchema('kind-1/schema.yaml', '@/kind-1/schema.yaml'))

const signer = new TestSigner()

describe('nostrability schemata - kind 1', () => {
  it('produces kind 1 note events that satisfy schema', async () => {
    const draft = await createShortTextNoteDraftEvent('hello nostrability', [])
    const event = await signer.signEvent(draft)

    expect(validateKind1(event)).toBe(true)
  })
})
