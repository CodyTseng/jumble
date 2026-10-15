import { sha256, MAX_ARTIFACT_BYTES } from '../../protocol/src/artifact'
import ipaddr from 'ipaddr.js'

/** Browser transport only. No cookies, authorization headers or server-side network access. */
export function resourceUrl(value: string, local: string[] = []) {
  const url = new URL(value)
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '')
  const publicHost = ipaddr.isValid(host)
    ? ipaddr.process(host).range() === 'unicast'
    : host.includes('.') && !/\.(localhost|local|internal|home|test|invalid)$/.test(host)
  if (
    value.length > 4096 ||
    url.username ||
    url.password ||
    !(
      (url.protocol === 'https:' && publicHost) ||
      (url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
        local.some((entry) => new URL(entry).origin === url.origin))
    )
  )
    throw new Error('blocked-by-policy')
  return url
}
export async function readBytes(response: Response, max = MAX_ARTIFACT_BYTES) {
  if (!response.ok || !response.body) throw new Error('Download unavailable')
  if (Number(response.headers.get('content-length')) > max) {
    await response.body.cancel()
    throw new Error('too-large')
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > max) throw new Error('too-large')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
export async function downloadBytes(
  url: string,
  signal: AbortSignal,
  max = MAX_ARTIFACT_BYTES,
  local: string[] = []
) {
  return readBytes(
    await fetch(resourceUrl(url, local), {
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error'
    }),
    max
  )
}
export async function blossomBytes(
  hash: string,
  servers: string[],
  signal: AbortSignal,
  max = MAX_ARTIFACT_BYTES,
  local: string[] = [],
  perServerTimeoutMs = 8000
) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid content hash')
  let tooLarge = false
  for (const server of [...new Set(servers)].slice(0, 8)) {
    try {
      const url = `${server.replace(/\/$/, '')}/${hash}`
      const bytes = await downloadBytes(
        url,
        AbortSignal.any([signal, AbortSignal.timeout(perServerTimeoutMs)]),
        max,
        local
      )
      if ((await sha256(bytes)) === hash) return bytes
    } catch (error) {
      tooLarge ||= error instanceof Error && error.message === 'too-large'
      signal.throwIfAborted()
    }
  }
  if (tooLarge) throw new Error(`This download exceeds the ${max / 1024 ** 2} MiB read limit.`)
  throw new Error(
    'No configured Blossom server returned the verified file. Check its URL and CORS support.'
  )
}

/** Native media may fail independently; never turn an unsafe URL into a proxy request. */
export function nativeMediaUrl(value?: string | null) {
  try {
    return value ? resourceUrl(value).href : undefined
  } catch {
    return undefined
  }
}
