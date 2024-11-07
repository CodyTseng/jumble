export function isWebsocketUrl(url: string): boolean {
  return /^wss?:\/\/.+$/.test(url)
}

// copy from nostr-tools/utils
export function normalizeUrl(url: string): string {
  if (url.indexOf('://') === -1) url = 'wss://' + url
  const p = new URL(url)
  p.pathname = p.pathname.replace(/\/+/g, '/')
  if (p.pathname.endsWith('/')) p.pathname = p.pathname.slice(0, -1)
  if ((p.port === '80' && p.protocol === 'ws:') || (p.port === '443' && p.protocol === 'wss:'))
    p.port = ''
  p.searchParams.sort()
  p.hash = ''
  return p.toString()
}
