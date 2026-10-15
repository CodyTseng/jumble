/** soyLI's authoring/publishing budget; not a protocol-wide admission rule. */
export const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024
/** Public readers accept larger artifacts from every publisher. */
export const MAX_READ_ARTIFACT_BYTES = 100 * 1024 * 1024
export async function sha256(bytes: Uint8Array | string) {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(data))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
