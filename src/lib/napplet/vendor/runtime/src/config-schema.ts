/** NAP-CONFIG Core Subset, pinned to naps/448013e. No references, regex or code. */
export type ConfigValue = string | number | boolean | ConfigValue[] | ConfigValues
export type ConfigValues = { [key: string]: ConfigValue }
export type ConfigSchema = {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'
  properties?: Record<string, ConfigSchema>
  items?: ConfigSchema
  required?: string[]
  enum?: ConfigValue[]
  enumDescriptions?: string[]
  default?: ConfigValue
  additionalProperties?: boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  title?: string
  description?: string
  markdownDescription?: string
  deprecationMessage?: string
  format?: string
  $schema?: string
  $version?: number
  'x-napplet-secret'?: boolean
  'x-napplet-section'?: string
  'x-napplet-order'?: number
}
export const MAX_CONFIG_BYTES = 65536
export class ConfigError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
  }
}
function fail(code: string, message: string): never {
  throw new ConfigError(code, message)
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const own = (value: object, key: string) => Object.hasOwn(value, key)
const safeKey = (key: string) => !['__proto__', 'prototype', 'constructor'].includes(key)
const types = ['object', 'string', 'number', 'integer', 'boolean', 'array']
const keywords = new Set([
  'type',
  'properties',
  'items',
  'required',
  'enum',
  'enumDescriptions',
  'default',
  'additionalProperties',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'title',
  'description',
  'markdownDescription',
  'deprecationMessage',
  'format',
  '$schema',
  '$version'
])
export function boundedJson(value: unknown): string {
  let text: string | undefined
  try {
    text = JSON.stringify(value)
  } catch {
    fail('invalid-schema', 'Settings must be JSON data.')
  }
  if (!text || new TextEncoder().encode(text).length > MAX_CONFIG_BYTES)
    fail('invalid-schema', 'Settings exceed the 64 KiB limit.')
  return text!
}
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => equal(v, b[i]))
  if (isRecord(a) && isRecord(b))
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((key) => own(b, key) && equal(a[key], b[key]))
    )
  return false
}
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 8) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value))
    return value.length <= 256 && value.every((item) => jsonValue(item, depth + 1))
  return (
    isRecord(value) &&
    Object.entries(value).every(([key, item]) => safeKey(key) && jsonValue(item, depth + 1))
  )
}
/** Value checks never coerce data or include its contents in an error. */
export function validConfigValue(
  schema: ConfigSchema,
  value: unknown,
  requireFields = true
): value is ConfigValue {
  let valid = false
  switch (schema.type) {
    case 'object':
      valid =
        isRecord(value) &&
        Object.entries(value).every(
          ([key, item]) =>
            safeKey(key) &&
            (own(schema.properties ?? {}, key)
              ? validConfigValue(schema.properties![key], item, requireFields)
              : schema.additionalProperties === true && jsonValue(item))
        ) &&
        (!requireFields || (schema.required ?? []).every((key) => own(value, key)))
      break
    case 'array':
      valid =
        Array.isArray(value) &&
        value.length <= 256 &&
        value.length >= (schema.minItems ?? 0) &&
        value.length <= (schema.maxItems ?? 256) &&
        value.every((item) => validConfigValue(schema.items!, item))
      break
    case 'string':
      valid =
        typeof value === 'string' &&
        [...value].length >= (schema.minLength ?? 0) &&
        [...value].length <= (schema.maxLength ?? MAX_CONFIG_BYTES)
      break
    case 'number':
    case 'integer':
      valid =
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (schema.type !== 'integer' || Number.isSafeInteger(value)) &&
        value >= (schema.minimum ?? -Infinity) &&
        value <= (schema.maximum ?? Infinity)
      break
    case 'boolean':
      valid = typeof value === 'boolean'
  }
  return valid && (!schema.enum || schema.enum.some((item) => equal(item, value)))
}
export function validateConfigSchema(input: unknown, version?: unknown): ConfigSchema {
  // Clone to prevent callers mutating a validated schema. Cyclic/non-JSON input is rejected.
  const schema: unknown = JSON.parse(boundedJson(input))
  let nodes = 0
  function visit(value: unknown, depth: number): asserts value is ConfigSchema {
    if (!isRecord(value) || !types.includes(String(value.type)))
      fail('invalid-schema', 'Each setting needs a supported type.')
    if (++nodes > 128) fail('invalid-schema', 'A schema may contain at most 128 settings.')
    for (const key of Object.keys(value)) {
      if (['$ref', '$defs', 'definitions', '$dynamicRef'].includes(key))
        fail('ref-not-allowed', 'Schema references are not allowed.')
      if (key === 'pattern') fail('pattern-not-allowed', 'Pattern validation is not supported.')
      if (!keywords.has(key) && !key.startsWith('x-'))
        fail('invalid-schema', `Unsupported schema keyword: ${key.slice(0, 60)}.`)
    }
    if (
      value.$schema !== undefined &&
      (typeof value.$schema !== 'string' ||
        ![
          'http://json-schema.org/draft-07/schema#',
          'https://json-schema.org/draft-07/schema#',
          'https://json-schema.org/draft/2019-09/schema',
          'https://json-schema.org/draft/2020-12/schema'
        ].includes(value.$schema))
    )
      fail(
        'unsupported-draft',
        'Use JSON Schema draft-07, 2019-09 or 2020-12 with the NAP Core Subset.'
      )
    for (const key of [
      'title',
      'description',
      'markdownDescription',
      'deprecationMessage',
      'format',
      'x-napplet-section'
    ])
      if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 2048))
        fail('invalid-schema', 'Schema labels must be bounded text.')
    if (
      value['x-napplet-secret'] !== undefined &&
      (typeof value['x-napplet-secret'] !== 'boolean' || value.type !== 'string')
    )
      fail('invalid-schema', 'Secret annotations apply to strings.')
    if (value['x-napplet-secret'] && own(value, 'default'))
      fail('secret-with-default', 'Secret settings cannot declare a default.')
    for (const key of ['$version', 'minLength', 'maxLength', 'minItems', 'maxItems'])
      if (value[key] !== undefined && (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0))
        fail('invalid-schema', `${key} must be a non-negative integer.`)
    for (const key of ['minimum', 'maximum', 'x-napplet-order'])
      if (
        value[key] !== undefined &&
        (typeof value[key] !== 'number' ||
          !Number.isFinite(value[key]) ||
          (key === 'x-napplet-order' && value[key] < 0))
      )
        fail('invalid-schema', 'Numeric constraints must be finite.')
    for (const [min, max] of [
      ['minimum', 'maximum'],
      ['minLength', 'maxLength'],
      ['minItems', 'maxItems']
    ])
      if (
        value[min] !== undefined &&
        value[max] !== undefined &&
        Number(value[min]) > Number(value[max])
      )
        fail('invalid-schema', 'Minimum cannot exceed maximum.')
    if (value.additionalProperties !== undefined && typeof value.additionalProperties !== 'boolean')
      fail('invalid-schema', 'additionalProperties must be boolean.')
    if (value.type === 'object') {
      if (depth > 4) fail('schema-too-deep', 'Settings may nest objects at most four levels.')
      if (value.properties === undefined) value.properties = {}
      if (!isRecord(value.properties))
        fail('invalid-schema', 'Object properties must be a schema map.')
      for (const [key, child] of Object.entries(value.properties)) {
        if (!safeKey(key) || key.length > 128) fail('invalid-schema', 'Invalid setting name.')
        visit(child, depth + 1)
      }
      if (
        value.required !== undefined &&
        (!Array.isArray(value.required) ||
          !value.required.every(
            (key) => typeof key === 'string' && own(value.properties as object, key)
          ) ||
          new Set(value.required).size !== value.required.length)
      )
        fail('invalid-schema', 'Required settings must name declared properties.')
    } else if (value.properties !== undefined || value.required !== undefined)
      fail('invalid-schema', 'Only objects declare properties and required fields.')
    if (value.type === 'array') {
      visit(value.items, depth)
      if (['object', 'array'].includes(value.items.type))
        fail('invalid-schema', 'Arrays must contain one primitive type.')
    } else if (value.items !== undefined) fail('invalid-schema', 'Only arrays declare items.')
    const typed = value as ConfigSchema
    if (
      value.enum !== undefined &&
      (!Array.isArray(value.enum) ||
        !value.enum.length ||
        value.enum.length > 256 ||
        !value.enum.every((item) => validConfigValue({ ...typed, enum: undefined }, item)))
    )
      fail('invalid-schema', 'Enum values must match the setting type.')
    if (
      value.enumDescriptions !== undefined &&
      (!Array.isArray(value.enumDescriptions) ||
        !value.enumDescriptions.every((item) => typeof item === 'string') ||
        value.enumDescriptions.length !== typed.enum?.length)
    )
      fail('invalid-schema', 'Enum descriptions must match the choices.')
    if (own(value, 'default') && !validConfigValue(typed, value.default, false))
      fail('invalid-schema', 'A default does not match its setting.')
  }
  visit(schema, 1)
  if (schema.type !== 'object') fail('invalid-schema', 'The schema root must be an object.')
  if (version !== undefined) {
    if (!Number.isSafeInteger(version) || Number(version) < 0)
      fail('invalid-schema', 'Schema version must be a non-negative integer.')
    if (schema.$version !== undefined && schema.$version !== version)
      fail('version-conflict', 'Schema and registration versions disagree.')
    schema.$version = Number(version)
  }
  return schema
}
/** Reconcile declared leaves only. Unset values are omitted, including unset required secrets. */
export function resolveConfig(
  schema: ConfigSchema,
  persisted: unknown,
  inherited?: unknown,
  defaults = true
): ConfigValues {
  const values: ConfigValues = {}
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    const saved = isRecord(persisted) && own(persisted, key) ? persisted[key] : undefined
    const ancestor = !defaults
      ? undefined
      : isRecord(schema.default) && own(schema.default, key)
        ? schema.default[key]
        : isRecord(inherited) && own(inherited, key)
          ? inherited[key]
          : undefined
    if (child.type === 'object') {
      const nested = resolveConfig(child, saved, ancestor, defaults)
      if (
        (Object.keys(nested).length ||
          isRecord(saved) ||
          (defaults && child.default !== undefined) ||
          ancestor !== undefined) &&
        validConfigValue(child, nested, false)
      )
        values[key] = nested
    } else {
      const candidate =
        saved !== undefined && validConfigValue(child, saved)
          ? saved
          : child['x-napplet-secret'] || !defaults
            ? undefined
            : child.default !== undefined
              ? child.default
              : ancestor
      if (candidate !== undefined && validConfigValue(child, candidate))
        values[key] = structuredClone(candidate)
    }
  }
  return values
}
export function withoutSecrets(schema: ConfigSchema, values: ConfigValues): ConfigValues {
  const output: ConfigValues = {}
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    if (!own(values, key) || child['x-napplet-secret']) continue
    output[key] =
      child.type === 'object' ? withoutSecrets(child, values[key] as ConfigValues) : values[key]
  }
  return output
}
/** Parse only inert template content from the already hash-verified document. */
export function declaredConfig(documentHtml: string): { schema?: unknown; error?: string } {
  const template = document.createElement('template')
  template.innerHTML = documentHtml
  const tags = template.content.querySelectorAll('meta[name="napplet-config-schema"]')
  if (!tags.length) return {}
  if (tags.length !== 1) return { error: 'The build contains multiple configuration schemas.' }
  const text = tags[0].getAttribute('content') ?? ''
  if (text.length > MAX_CONFIG_BYTES)
    return { error: 'Configuration schema exceeds the 64 KiB limit.' }
  try {
    return { schema: JSON.parse(text) }
  } catch {
    return { error: 'The build contains an invalid configuration schema.' }
  }
}
