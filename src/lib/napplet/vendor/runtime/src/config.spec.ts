import { expect, test } from 'vitest'
import {
  validateConfigSchema,
  resolveConfig,
  validConfigValue,
  withoutSecrets
} from './config-schema'
import { NappletConfig } from './config-session'
import type { KeyValueStorage } from './storage'

const schema = {
  type: 'object',
  $version: 1,
  properties: {
    speed: { type: 'number', minimum: 0.25, maximum: 3, default: 1 },
    color: {
      type: 'string',
      enum: ['mint', 'coral'],
      default: 'mint',
      'x-napplet-section': 'appearance'
    },
    muted: { type: 'boolean', default: true },
    token: { type: 'string', 'x-napplet-secret': true }
  }
}
function memory(): KeyValueStorage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    }
  }
}
function fixture(
  storage = memory(),
  identity = 'author:35129:toy:build',
  pubkey: string | null = null,
  declared: unknown = schema
) {
  const sent: Record<string, unknown>[] = []
  const config = new NappletConfig({
    storage,
    identity,
    pubkey,
    declaration: { schema: declared },
    send: (message) => sent.push(message),
    focused: () => true
  })
  return {
    config,
    sent,
    storage,
    call: (type: string, fields = {}) => config.handle({ type: `config.${type}`, ...fields })
  }
}
test('config core subset validates defaults, Unicode lengths and ignores format as a constraint', () => {
  const spec = validateConfigSchema({
    type: 'object',
    properties: {
      address: { type: 'string', format: 'email', minLength: 1, maxLength: 2, default: '🙂' },
      items: {
        type: 'array',
        items: { type: 'integer', minimum: 0 },
        minItems: 1,
        maxItems: 2,
        default: [1]
      }
    }
  })
  expect(resolveConfig(spec, {})).toEqual({ address: '🙂', items: [1] })
  expect(validConfigValue(spec, { address: '🙂', items: [0, 1] })).toBe(true)
  expect(validConfigValue(spec, { address: 'abc', items: [1.2] })).toBe(false)
  expect(validConfigValue(spec, { address: 'x', items: [1], foreign: true })).toBe(false)
})
test('default resolution prefers valid saved leaves, own defaults, then ancestor defaults', () => {
  const spec = validateConfigSchema({
    type: 'object',
    default: { one: 9, nested: { a: 4, b: 6 } },
    properties: {
      one: { type: 'integer', default: 2 },
      nested: {
        type: 'object',
        properties: { a: { type: 'integer', default: 3 }, b: { type: 'integer' } }
      }
    }
  })
  expect(resolveConfig(spec, { one: 'bad', nested: { a: 7 }, orphan: true })).toEqual({
    one: 2,
    nested: { a: 7, b: 6 }
  })
})
test('secret fields have no implicit values, even through ancestor defaults', () => {
  const spec = validateConfigSchema({ ...schema, default: { token: 'do-not-inherit' } })
  expect(resolveConfig(spec, {})).not.toHaveProperty('token')
  expect(withoutSecrets(spec, resolveConfig(spec, { token: 'explicit' }))).not.toHaveProperty(
    'token'
  )
})
for (const [property, code] of [
  [{ type: 'string', pattern: '(a+)+$' }, 'pattern-not-allowed'],
  [{ type: 'string', $ref: '#/something' }, 'ref-not-allowed'],
  [{ type: 'string', $defs: {} }, 'ref-not-allowed'],
  [{ type: 'string', 'x-napplet-secret': true, default: '' }, 'secret-with-default'],
  [{ type: 'string', oneOf: [] }, 'invalid-schema'],
  [{ type: 'array', items: [{ type: 'number' }] }, 'invalid-schema'],
  [{ type: 'array', items: { type: 'object', properties: {} } }, 'invalid-schema']
] as const)
  test(`config rejects ${code}: ${Object.keys(property).join(',')}`, () => {
    expect(() => validateConfigSchema({ type: 'object', properties: { value: property } })).toThrow(
      expect.objectContaining({ code })
    )
  })
test('config bounds nesting, versions, unknown drafts and unsafe property names', () => {
  let nested: unknown = { type: 'string' }
  for (let i = 0; i < 5; i++) nested = { type: 'object', properties: { nested } }
  expect(() => validateConfigSchema(nested)).toThrow(
    expect.objectContaining({ code: 'schema-too-deep' })
  )
  expect(() =>
    validateConfigSchema({ ...schema, $schema: 'https://untrusted.example/schema' })
  ).toThrow(expect.objectContaining({ code: 'unsupported-draft' }))
  expect(() => validateConfigSchema(schema, 2)).toThrow(
    expect.objectContaining({ code: 'version-conflict' })
  )
  expect(() =>
    validateConfigSchema(
      JSON.parse('{"type":"object","properties":{"__proto__":{"type":"string"}}}')
    )
  ).toThrow()
})
test('wire supports idless snapshot subscriptions, correlation and unsubscribe with no writable surface', () => {
  const f = fixture()
  f.call('subscribe')
  expect(f.sent.at(-1)).toEqual({
    type: 'config.values',
    values: { speed: 1, color: 'mint', muted: true }
  })
  f.call('get', { id: 'query' })
  expect(f.sent.at(-1)).toMatchObject({ type: 'config.values', id: 'query' })
  const count = f.sent.length
  f.call('set', { id: 'hack', values: { speed: 3 } })
  f.call('get', { id: 'spoof', dTag: 'another-napplet' })
  expect(f.sent.length).toBe(count)
  expect(f.config.commit({ speed: 2, color: 'coral', muted: false })).toBe(true)
  expect(f.sent.at(-1)).toEqual({
    type: 'config.values',
    values: { speed: 2, color: 'coral', muted: false }
  })
  f.call('unsubscribe')
  const unsubscribed = f.sent.length
  f.config.reset()
  expect(f.sent.length).toBe(unsubscribed)
})
test('no-schema subscriptions wait until registration applies and invalid registration retains the last valid schema', () => {
  const sent: Record<string, unknown>[] = []
  const config = new NappletConfig({
    storage: memory(),
    identity: 'toy',
    pubkey: null,
    send: (m) => sent.push(m),
    focused: () => true
  })
  config.handle({ type: 'config.subscribe' })
  expect(sent).toEqual([
    {
      type: 'config.schemaError',
      code: 'no-schema',
      error: 'This napplet has not declared settings.'
    }
  ])
  config.handle({ type: 'config.registerSchema', id: 'schema', schema })
  expect(sent.slice(-2)).toMatchObject([
    { type: 'config.registerSchema.result', id: 'schema', ok: true },
    { type: 'config.values', values: { speed: 1 } }
  ])
  config.handle({
    type: 'config.registerSchema',
    id: 'invalid',
    schema: { type: 'object', properties: { x: { type: 'string', pattern: 'x' } } }
  })
  expect(sent.at(-2)).toMatchObject({
    type: 'config.registerSchema.result',
    id: 'invalid',
    ok: false,
    code: 'pattern-not-allowed'
  })
  expect(config.getSnapshot().schema?.properties).toHaveProperty('speed')
})
test('settings persist only non-secrets and isolate creators, hashes, accounts and identity changes', () => {
  const f = fixture()
  f.call('subscribe')
  expect(f.config.commit({ speed: 2, color: 'coral', muted: false, token: 'session-secret' })).toBe(
    true
  )
  expect(f.storage.getItem(f.storage.key(0)!)).not.toContain('session-secret')
  const reload = fixture(f.storage)
  expect(reload.config.getSnapshot().values).toEqual({ speed: 2, color: 'coral', muted: false })
  for (const identity of ['other-author:35129:toy:build', 'author:35129:toy:other-build'])
    expect(fixture(f.storage, identity).config.getSnapshot().values.speed).toBe(1)
  f.config.open()
  f.config.updateIdentity('a'.repeat(64))
  expect(f.config.getSnapshot()).toMatchObject({
    open: false,
    values: { speed: 1, color: 'mint', muted: true }
  })
  expect(f.config.getSnapshot().values).not.toHaveProperty('token')
  expect(f.sent.at(-1)).toMatchObject({ type: 'config.values', values: { speed: 1 } })
  f.config.updateIdentity(null)
  expect(f.config.getSnapshot().values.speed).toBe(2)
  const sent = f.sent.length
  f.config.close()
  expect(f.config.commit({ speed: 1 })).toBe(false)
  f.call('get', { id: 'closed' })
  expect(f.sent.length).toBe(sent)
})
test('schema changes prune secrets/orphans and reject backwards versions without losing current values', () => {
  const f = fixture()
  f.config.commit({ speed: 2, color: 'mint', muted: true, token: 'secret' })
  f.call('registerSchema', {
    id: 'next',
    schema: {
      type: 'object',
      $version: 2,
      properties: { speed: { type: 'number', maximum: 1, default: 0.5 } }
    }
  })
  expect(f.config.getSnapshot().values).toEqual({ speed: 0.5 })
  f.call('registerSchema', { id: 'old', schema })
  expect(f.sent.at(-2)).toMatchObject({ ok: false, code: 'version-conflict' })
  expect(f.storage.getItem(f.storage.key(0)!)).toBe('{}')
})
test('required fields validate on user commit while unset values remain absent from initial snapshots', () => {
  const f = fixture(memory(), 'required', null, { ...schema, required: ['token'] })
  expect(f.config.getSnapshot().values).not.toHaveProperty('token')
  expect(f.config.commit({ speed: 1, color: 'mint', muted: true })).toBe(false)
  expect(f.config.commit({ speed: 1, color: 'mint', muted: true, token: 'explicit' })).toBe(true)
})

test('implicit defaults never become explicit secrets after schema changes, including nested enum defaults', () => {
  const f = fixture(memory(), 'defaults', null, {
    type: 'object',
    properties: { token: { type: 'string', default: 'public-default' } }
  })
  f.call('registerSchema', {
    id: 'secret',
    schema: { type: 'object', properties: { token: { type: 'string', 'x-napplet-secret': true } } }
  })
  expect(f.config.getSnapshot().values).toEqual({})
  const nested = validateConfigSchema({
    type: 'object',
    properties: {
      credentials: {
        type: 'object',
        properties: { token: { type: 'string', 'x-napplet-secret': true } },
        default: { token: 'implicit' },
        enum: [{ token: 'implicit' }]
      }
    }
  })
  expect(resolveConfig(nested, {})).toEqual({})
  expect(resolveConfig(nested, { credentials: { token: 'implicit' } })).toEqual({
    credentials: { token: 'implicit' }
  })
})

test('constrained root snapshots wait for a valid user choice instead of delivering invalid values', () => {
  const f = fixture(memory(), 'enum', null, {
    type: 'object',
    enum: [{ theme: 'mint' }],
    properties: { theme: { type: 'string' } }
  })
  f.call('subscribe')
  f.call('get', { id: 'waiting' })
  expect(f.sent).toEqual([])
  expect(f.config.commit({ theme: 'coral' })).toBe(false)
  expect(f.config.commit({ theme: 'mint' })).toBe(true)
  expect(f.sent).toEqual([
    { type: 'config.values', id: 'waiting', values: { theme: 'mint' } },
    { type: 'config.values', values: { theme: 'mint' } }
  ])
})

test('blocked persistence falls back to memory and openSettings requires focus with a cooldown', () => {
  let focused = false
  const config = new NappletConfig({
    identity: 'test',
    pubkey: null,
    declaration: { schema },
    storage: {
      ...memory(),
      getItem: () => {
        throw Error('disabled')
      },
      setItem: () => {
        throw Error('disabled')
      }
    },
    send: () => {},
    focused: () => focused
  })
  expect(config.getSnapshot().persistent).toBe(false)
  config.handle({ type: 'config.openSettings' })
  expect(config.getSnapshot().open).toBe(false)
  focused = true
  config.handle({ type: 'config.openSettings', section: 'unknown' })
  expect(config.getSnapshot().open).toBe(true)
  config.dismiss()
  config.handle({ type: 'config.openSettings' })
  expect(config.getSnapshot().open).toBe(false)
  expect(config.commit({ speed: 2 })).toBe(true)
  expect(config.getSnapshot().values.speed).toBe(2)
})
