/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
import {
  aggregateHash,
  encodeAddress,
  identityAddress,
  verifiedEvent,
  type NappletIdentity,
  type SignedEvent
} from './index'

export type ManifestFormat = 'legacy' | 'standalone'
export type ManifestIcon = { hash: string; mime: 'image/png' | 'image/jpeg' | 'image/webp' }
export type ManifestIntent = { intent: string; parameters: string[] }
type TaggedManifest = Pick<SignedEvent, 'tags'>
const hashPattern = /^[a-f0-9]{64}$/
const legacyAddressPattern =
  /^(?:35129:[a-f0-9]{64}:[^\u0000-\u001f\u007f]{0,256}|15129:[a-f0-9]{64}:)$/

/** Select one contract before validating it; a failed standalone parse never retries legacy. */
export function manifestFormat(event: TaggedManifest): ManifestFormat {
  if (event.tags.some((t) => t[0] === 'x' && t.length === 2)) return 'standalone'
  return event.tags.some((t) => t[0] === 'path' || (t[0] === 'x' && t[2] === 'aggregate'))
    ? 'legacy'
    : 'standalone'
}

/** Only old snapshots used a same-author a tag to name the snapshotted napplet. */
export function legacySnapshotAddress(
  event: Pick<SignedEvent, 'kind' | 'pubkey' | 'tags'>
): string | null {
  if (event.kind !== 5129 || manifestFormat(event) !== 'legacy') return null
  const tags = event.tags.filter((t) => t[0] === 'a')
  const address = tags[0]?.[1]
  return tags.length === 1 &&
    tags[0].length >= 2 &&
    legacyAddressPattern.test(address ?? '') &&
    address.split(':')[1] === event.pubkey
    ? address
    : null
}

export function manifestDescription(event: Pick<SignedEvent, 'tags' | 'content'>): string {
  return manifestFormat(event) === 'standalone'
    ? event.content
    : (event.tags.find((t) => t[0] === 'description')?.[1] ?? '')
}

function manifestDomains(event: TaggedManifest, name: string) {
  return [
    ...new Set(
      event.tags
        .filter((t) => t[0] === name)
        .map((t) => {
          if (t.length !== 2 || !/^[a-z][a-z0-9-]{0,39}$/.test(t[1]))
            throw new Error(`Invalid ${name === 'O' ? 'optional' : 'required'} domain`)
          return t[1]
        })
    )
  ]
}

/** A normalized signed icon claim; callers must still verify and decode its bytes. */
export function manifestIcon(event: TaggedManifest): ManifestIcon | null {
  const icons = event.tags.filter((t) => t[0] === 'icon')
  const candidate = icons[0]
  return icons.length === 1 &&
    candidate.length === 3 &&
    hashPattern.test(candidate[1]) &&
    ['image/png', 'image/jpeg', 'image/webp'].includes(candidate[2])
    ? { hash: candidate[1], mime: candidate[2] as ManifestIcon['mime'] }
    : null
}

function optionalMetadata(event: TaggedManifest) {
  const archetypes = [
    ...new Set(
      event.tags
        .filter(
          (t) =>
            t[0] === 'z' &&
            t.length === 2 &&
            t[1].trim() &&
            t[1].length <= 256 &&
            !/[\u0000-\u001f\u007f]/.test(t[1])
        )
        .map((t) => t[1])
    )
  ]
  const intents = new Map<string, ManifestIntent>()
  for (const tag of event.tags) {
    if (
      tag[0] !== 'i' ||
      tag.length < 2 ||
      tag[1].length > 1024 ||
      !/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s?#\u0000-\u001f\u007f]+$/.test(tag[1]) ||
      tag.slice(2).some((p) => !p || p.length > 128 || /[\s?&#=/\u0000-\u001f\u007f]/.test(p))
    )
      continue
    const existing = intents.get(tag[1])
    intents.set(tag[1], {
      intent: tag[1],
      parameters: [...new Set([...(existing?.parameters ?? []), ...tag.slice(2)])]
    })
  }
  return { icon: manifestIcon(event), archetypes, intents: [...intents.values()] }
}

export function manifestIdentity(event: SignedEvent): NappletIdentity | null {
  const d = event.tags.filter((t) => t[0] === 'd')
  if (event.kind === 5129) {
    if (d.length) throw new Error('Snapshots must not contain d tags')
    return null
  }
  if (event.kind !== 35129 && event.kind !== 15129) throw new Error('Not a napplet manifest')
  if (event.kind === 35129 ? d.length !== 1 || d[0].length !== 2 : d.length !== 0)
    throw new Error('Invalid manifest identifier')
  const identity: NappletIdentity = {
    kind: event.kind,
    pubkey: event.pubkey,
    identifier: d[0]?.[1] ?? ''
  }
  identityAddress(identity)
  return identity
}

/** Shared NIP-5D single-file validation, independent of publisher or gallery metadata. */
export async function validateManifest(input: unknown) {
  const manifest = verifiedEvent(input)
  const identity = manifestIdentity(manifest)
  const format = manifestFormat(manifest)
  const x = manifest.tags.filter((t) => t[0] === 'x')
  let artifactHash: string
  if (format === 'standalone') {
    if (x.length !== 1 || x[0].length !== 2 || !hashPattern.test(x[0][1]))
      throw new Error('Manifest requires exactly one artifact x hash')
    if (manifest.tags.some((t) => ['path', 'requires', 'description'].includes(t[0])))
      throw new Error('Standalone manifest must not mix legacy path, requires or description tags')
    if (!manifest.content.trim())
      throw new Error('Manifest requires a nonempty plain-text description')
    artifactHash = x[0][1]
    for (const name of ['a', 'A']) {
      const tags = manifest.tags.filter((t) => t[0] === name)
      if (
        tags.length > 1 ||
        (tags.length &&
          (manifest.kind !== 5129 ||
            tags[0].length !== 2 ||
            !legacyAddressPattern.test(tags[0][1])))
      )
        throw new Error('Lineage requires at most one parent/root address on snapshots only')
    }
  } else {
    if (manifest.tags.some((t) => t[0] === 'R' || t[0] === 'O'))
      throw new Error('Legacy manifest must not mix standalone capability declarations')
    const paths = manifest.tags.filter((t) => t[0] === 'path')
    if (paths.length !== 1 || paths[0].length !== 3 || paths[0][1] !== '/index.html')
      throw new Error('This client supports one self-contained /index.html')
    artifactHash = paths[0][2]
    if (manifest.kind === 5129) {
      const a = manifest.tags.filter((t) => t[0] === 'a')
      if (x.length !== 1 || a.length !== 1 || !legacyAddressPattern.test(a[0][1]))
        throw new Error('Snapshot requires an aggregate and a source address')
    }
  }
  const aggregate = await aggregateHash([{ path: '/index.html', hash: artifactHash }])
  if (
    format === 'legacy' &&
    (x.length > 1 ||
      (x.length && (x[0].length !== 3 || x[0][1] !== aggregate || x[0][2] !== 'aggregate')))
  )
    throw new Error('Manifest aggregate hash mismatch')
  for (const tag of ['title', 'description', 'source'])
    if (manifest.tags.filter((t) => t[0] === tag).length > 1)
      throw new Error(`Ambiguous ${tag} tag`)
  const lineageAddress = (name: string) => {
    const tags = manifest.tags.filter((t) => t[0] === name)
    return tags.length === 1 && tags[0].length === 2 && legacyAddressPattern.test(tags[0][1])
      ? tags[0][1]
      : null
  }
  return {
    manifest,
    identity,
    format,
    artifactHash,
    aggregateHash: aggregate,
    identityHash: format === 'legacy' ? aggregate : artifactHash,
    description: manifestDescription(manifest),
    title: manifest.tags.find((t) => t[0] === 'title')?.[1] ?? null,
    naddr: identity ? encodeAddress(identity) : null,
    domains: manifestDomains(manifest, format === 'legacy' ? 'requires' : 'R'),
    optionalDomains: format === 'standalone' ? manifestDomains(manifest, 'O') : [],
    ...optionalMetadata(manifest),
    lineage: {
      parent: format === 'legacy' && manifest.kind === 5129 ? null : lineageAddress('a'),
      root: lineageAddress('A')
    },
    servers: manifest.tags
      .filter((t) => t[0] === 'server')
      .map((t) => t[1])
      .filter(Boolean)
      .slice(0, 8)
  }
}

/** Check a locally indexed current/snapshot pair; neither requires a Space-specific pointer. */
export async function validateRelease(currentInput: unknown, snapshotInput: unknown) {
  const current = await validateManifest(currentInput)
  const snapshot = await validateManifest(snapshotInput)
  if (
    !current.identity ||
    snapshot.manifest.kind !== 5129 ||
    current.manifest.pubkey !== snapshot.manifest.pubkey
  )
    throw new Error('Mismatched release author or kind')
  const address = identityAddress(current.identity)
  if (current.format !== snapshot.format) throw new Error('Mismatched release manifest formats')
  if (current.format === 'legacy' && legacySnapshotAddress(snapshot.manifest) !== address)
    throw new Error('Snapshot belongs to another napplet')
  if (current.artifactHash !== snapshot.artifactHash) throw new Error('Artifact manifest mismatch')
  if (current.format === 'standalone') {
    const metadata = (event: SignedEvent) =>
      JSON.stringify({
        content: event.content,
        tags: event.tags
          .filter((t) => !['d', 'a', 'A'].includes(t[0]))
          .map((t) => JSON.stringify(t))
          .sort()
      })
    if (metadata(current.manifest) !== metadata(snapshot.manifest))
      throw new Error('Release metadata mismatch')
  }
  return {
    identity: current.identity,
    address,
    artifactHash: current.artifactHash,
    aggregateHash: current.aggregateHash,
    identityHash: current.identityHash,
    format: current.format,
    current: current.manifest,
    snapshot: snapshot.manifest
  }
}
