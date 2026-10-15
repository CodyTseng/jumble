import { legacySnapshotAddress, validateManifest } from '../../protocol/src/manifest'
import { aggregateHash, identityAddress } from '../../protocol/src'
import { missingDomains } from './capabilities'

/** The same signed manifest determines playback permissions for every catalog source. */
export async function preparePlayback(input: unknown, expectedArtifactHash?: string) {
  const release = await validateManifest(input)
  if (expectedArtifactHash !== undefined && release.artifactHash !== expectedArtifactHash)
    throw new Error('Release metadata does not match its artifact.')
  const missing = missingDomains(release.domains)
  if (missing.length)
    throw new Error(`This napplet requires unsupported capabilities: ${missing.join(', ')}.`)
  const { manifest } = release
  const address = release.identity
    ? identityAddress(release.identity)
    : legacySnapshotAddress(manifest)
  // Host persistence is deliberately separate from the protocol identityHash. Keep
  // the existing deterministic build scope for a verified owner/app/artifact,
  // without copying browser data or granting a snapshot its ancestor's authority.
  const storageHash = await aggregateHash([{ path: '/index.html', hash: release.artifactHash }])
  let hostIdentity = `${manifest.pubkey}:5129:${manifest.id}:${release.identityHash}`
  if (address) {
    const [kind, , ...identifier] = address.split(':')
    hostIdentity = `${manifest.pubkey}:${kind}:${identifier.join(':')}:${storageHash}`
  } else if (release.format === 'legacy' && manifest.kind === 5129) {
    // Preserve the isolated historical scope of legacy cross-author snapshots.
    const legacySource = manifest.tags.find((t) => t[0] === 'a')![1]
    hostIdentity = `${manifest.pubkey}:5129:${legacySource}:${storageHash}`
  }
  return {
    ...release,
    hostIdentity
  }
}
