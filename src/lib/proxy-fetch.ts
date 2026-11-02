import type { TProxyFetchOptions, TProxyFetchResponse } from '../../electron/shared/ipc-types'
import { CapacitorHttp } from '@capacitor/core'
import { getElectronBridge, isAndroid, isElectron } from './platform'

const DEFAULT_TIMEOUT_MS = 15_000

export type ProxyFetchOptions = TProxyFetchOptions
export type ProxyFetchResponse = TProxyFetchResponse

/**
 * Fetch that routes through the Electron main process when available, so that
 * cross-origin requests bypass CORS and use the desktop network stack. In web
 * mode it falls back to `window.fetch` and adapts the response into the same
 * shape, so callers stay identical across platforms.
 *
 * The body is always returned as decoded UTF-8 text — callers parse JSON/HTML
 * themselves. This keeps the IPC payload simple and avoids shipping a DOM
 * parser into the main process.
 */
export async function proxyFetch(
  url: string,
  options: ProxyFetchOptions = {}
): Promise<ProxyFetchResponse> {
  if (isElectron()) {
    const bridge = getElectronBridge()
    if (bridge) {
      return bridge.proxy.fetch(url, options)
    }
  }

  if (isAndroid()) {
    const timeout = Math.min(60_000, Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS))
    const response = await CapacitorHttp.request({
      url,
      method: options.method ?? 'GET',
      headers: options.headers,
      data: options.body,
      responseType: 'text',
      connectTimeout: timeout,
      readTimeout: timeout
    })
    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024) {
      throw new Error('Native HTTP response exceeds 5 MB')
    }
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: '',
      url: response.url,
      headers: response.headers,
      body
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    })
    const body = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      headers[key] = value
    })
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      headers,
      body
    }
  } finally {
    clearTimeout(timer)
  }
}
