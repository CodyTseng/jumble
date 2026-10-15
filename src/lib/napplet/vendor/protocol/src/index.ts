/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
import { nip19 } from 'nostr-tools'
import { z } from 'zod'
import { normalizeTopic } from './topics'
import { verifySignature } from './verify'

export const NAPPLET_KIND = 35129
export const ROOT_NAPPLET_KIND = 15129
export const SNAPSHOT_KIND = 5129
export { MAX_ARTIFACT_BYTES, MAX_READ_ARTIFACT_BYTES, sha256 } from './artifact'
import { sha256 } from './artifact'
const hex = z.string().regex(/^[a-f0-9]{64}$/)
export const eventSchema = z.object({
  id: hex,
  pubkey: hex,
  sig: z.string().regex(/^[a-f0-9]{128}$/),
  kind: z.number().int().nonnegative(),
  created_at: z.number().int().nonnegative(),
  content: z.string().max(65536),
  tags: z.array(z.array(z.string().max(4096)).max(16)).max(256)
})
export type SignedEvent = z.infer<typeof eventSchema>
export type NappletIdentity = {
  kind: typeof NAPPLET_KIND | typeof ROOT_NAPPLET_KIND
  pubkey: string
  identifier: string
}

export function identityAddress(identity: NappletIdentity) {
  if (
    ![NAPPLET_KIND, ROOT_NAPPLET_KIND].includes(identity.kind) ||
    !hex.safeParse(identity.pubkey).success ||
    identity.identifier.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(identity.identifier) ||
    (identity.kind === ROOT_NAPPLET_KIND && identity.identifier !== '')
  )
    throw new Error('Invalid napplet identity')
  return `${identity.kind}:${identity.pubkey}:${identity.identifier}`
}
export function encodeAddress(identity: NappletIdentity, relays: string[] = []) {
  identityAddress(identity)
  return nip19.naddrEncode({ ...identity, relays })
}
export function decodeAddress(value: string): NappletIdentity {
  if (value.length > 4096) throw new Error('Address is too long')
  const decoded = nip19.decode(value)
  if (decoded.type !== 'naddr' || ![NAPPLET_KIND, ROOT_NAPPLET_KIND].includes(decoded.data.kind))
    throw new Error('Expected a napplet naddr')
  const identity = {
    kind: decoded.data.kind as NappletIdentity['kind'],
    pubkey: decoded.data.pubkey,
    identifier: decoded.data.identifier
  } as const
  identityAddress(identity)
  return identity
}
export async function aggregateHash(paths: Array<{ path: string; hash: string }>) {
  if (!paths.length || new Set(paths.map((p) => p.path)).size !== paths.length)
    throw new Error('Missing or duplicate paths')
  for (const { path, hash } of paths) {
    if (
      !hex.safeParse(hash).success ||
      !path.startsWith('/') ||
      /[\s\\]/.test(path) ||
      path.split('/').some((s) => s === '..' || s === '.')
    )
      throw new Error('Invalid path mapping')
  }
  return sha256(
    paths
      .map((p) => `${p.hash} ${p.path}\n`)
      .sort()
      .join('')
  )
}
export function verifiedEvent(input: unknown): SignedEvent {
  const event = eventSchema.parse(input)
  if (new TextEncoder().encode(JSON.stringify(event)).length > 65536 || !verifySignature(event))
    throw new Error('Invalid Nostr signature')
  return event
}
export { validateRelease } from './manifest'
export { enableWasmVerification, verifySignature } from './verify'

export const gallerySearchSchema = z.object({
  tag: z.string().max(256).transform(normalizeTopic).catch(''),
  sort: z.enum(['curated', 'new', 'updated', 'featured']).catch('new'),
  q: z.string().max(100).catch(''),
  unavailable: z.boolean().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
  archetype: z
    .string()
    .trim()
    .max(256)
    .regex(/^[^\u0000-\u001f\u007f]*$/)
    .optional()
    .catch(undefined),
  intent: z
    .string()
    .max(1024)
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s?#\u0000-\u001f\u007f]+$/)
    .optional()
    .catch(undefined),
  requiredDomain: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,39}$/)
    .optional()
    .catch(undefined),
  optionalDomain: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,39}$/)
    .optional()
    .catch(undefined)
})
export type GallerySearch = z.infer<typeof gallerySearchSchema>
