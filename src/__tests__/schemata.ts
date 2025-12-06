import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import YAML from 'yaml'

const require = createRequire(import.meta.url)

const schemataPackageJsonPath = require.resolve('@nostrability/schemata/package.json')
const schemataRoot = path.dirname(schemataPackageJsonPath)
const schemasRoot = path.join(schemataRoot, 'nips', 'nip-01')

const refBase = 'https://nostrability.local/'

function normalizeRef(ref: string) {
  return ref.startsWith('@/') ? `${refBase}${ref.slice(2)}` : ref
}

function normalizeRefs(schema: any): any {
  // Rewrite nostrability $ref shortcuts so AJV can resolve everything in-memory.
  if (Array.isArray(schema)) return schema.map(normalizeRefs)
  if (schema && typeof schema === 'object') {
    for (const [key, value] of Object.entries(schema)) {
      if (key === '$ref' && typeof value === 'string') {
        // eslint-disable-next-line no-param-reassign
        schema[key] = normalizeRef(value)
      } else {
        // @ts-expect-error recursive normalization
        schema[key] = normalizeRefs(value)
      }
    }
  }
  return schema
}

export function loadSchema(relativePath: string, id: string) {
  const file = path.join(schemasRoot, relativePath)
  const schema = YAML.parse(fs.readFileSync(file, 'utf8'))
  schema.$id = normalizeRef(id)
  return normalizeRefs(schema)
}
