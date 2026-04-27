import { TProxyFetchOptions, TProxyFetchResponse } from '../shared/ipc-types.js'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024 // 5 MB
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Jumble/1.0'

/**
 * Generic main-process HTTP proxy used by the renderer to make requests that
 * would otherwise be blocked by browser CORS. The renderer trusts main, so
 * there's no Origin enforcement here — callers should sanitize URLs.
 */
export async function proxyFetch(
  url: string,
  options: TProxyFetchOptions = {}
): Promise<TProxyFetchResponse> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`invalid url: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`unsupported protocol: ${parsed.protocol}`)
  }

  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS
  const maxBytes = options.maxBodySize ?? DEFAULT_MAX_BODY_BYTES
  const headers = new Headers(options.headers ?? {})
  if (!headers.has('user-agent')) headers.set('user-agent', DEFAULT_USER_AGENT)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
      redirect: options.redirect ?? 'follow',
      signal: controller.signal
    })

    const body = res.body ? await readBoundedText(res, maxBytes) : ''

    const headerObj: Record<string, string> = {}
    res.headers.forEach((v, k) => {
      headerObj[k] = v
    })

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: res.url || url,
      headers: headerObj,
      body
    }
  } finally {
    clearTimeout(timer)
  }
}

async function readBoundedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body!.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
    if (total >= maxBytes) {
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
      break
    }
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  const ct = res.headers.get('content-type') ?? ''
  const charsetMatch = ct.match(/charset=([^;]+)/i)
  const charset = (charsetMatch?.[1] ?? 'utf-8').trim().toLowerCase()
  try {
    return new TextDecoder(charset, { fatal: false }).decode(merged)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(merged)
  }
}
