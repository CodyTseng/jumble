import { blossomBytes, readBytes } from '../../client/src/bytes'
import { MAX_READ_ARTIFACT_BYTES, sha256 } from '../../protocol/src/artifact'

export const PLAYER_SANDBOX = 'allow-scripts'
export const PLAYER_CSP =
  "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

export async function verifiedDocument(
  bytes: Uint8Array,
  expectedHash: string,
  prelude: string | ((verifiedHtml: string) => string) = 'window.napplet=Object.freeze({});'
) {
  if (bytes.length > MAX_READ_ARTIFACT_BYTES)
    throw new Error(
      `This napplet exceeds the ${MAX_READ_ARTIFACT_BYTES / 1024 ** 2} MiB playback limit.`
    )
  if ((await sha256(bytes)) !== expectedHash)
    throw new Error('The downloaded creation does not match its expected hash.')
  const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const bootstrap = typeof prelude === 'function' ? prelude(html) : prelude
  // The first CSP constrains every later policy. The opaque iframe has no host cookies or signer.
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${PLAYER_CSP}"><meta name="referrer" content="no-referrer"><script>${bootstrap.replace(/<\/script/gi, '<\\/script')}</script>${html}`
}

export async function loadArtifact(
  hash: string,
  signal: AbortSignal,
  prelude: string | ((verifiedHtml: string) => string) | undefined,
  source: string[] | { localUrl: string },
  local: string[] = []
) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid artifact hash')
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(60000)])
  const bytes = Array.isArray(source)
    ? await blossomBytes(hash, source, deadline, MAX_READ_ARTIFACT_BYTES, local, 30000)
    : await readBytes(
        await fetch(source.localUrl, { signal: deadline, credentials: 'omit' }),
        MAX_READ_ARTIFACT_BYTES
      )
  return verifiedDocument(bytes, hash, prelude)
}
