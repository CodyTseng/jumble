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

export function normalizeHttpUrl(url: string): string {
  if (url.indexOf('://') === -1) url = 'https://' + url
  const p = new URL(url)
  p.pathname = p.pathname.replace(/\/+/g, '/')
  if (p.pathname.endsWith('/')) p.pathname = p.pathname.slice(0, -1)
  if ((p.port === '80' && p.protocol === 'http:') || (p.port === '443' && p.protocol === 'https:'))
    p.port = ''
  p.searchParams.sort()
  p.hash = ''
  return p.toString()
}

export function simplifyUrl(url: string): string {
  return url.replace('wss://', '').replace('ws://', '').replace(/\/$/, '')
}

export function isLocalNetworkUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname

    // Check if it's localhost
    if (hostname === 'localhost' || hostname === '::1') {
      return true
    }

    // Check if it's an IPv4 local network address
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (ipv4Match) {
      const [, a, b, c, d] = ipv4Match.map(Number)
      return (
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 127 && b === 0 && c === 0 && d === 1)
      )
    }

    // Check if it's an IPv6 address
    if (hostname.includes(':')) {
      if (hostname === '::1') {
        return true // IPv6 loopback address
      }
      if (hostname.startsWith('fe80:')) {
        return true // Link-local address
      }
      if (hostname.startsWith('fc') || hostname.startsWith('fd')) {
        return true // Unique local address (ULA)
      }
    }

    return false
  } catch {
    return false // Return false for invalid URLs
  }
}

export function isImage(url: string) {
  try {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.svg']
    return imageExtensions.some((ext) => new URL(url).pathname.toLowerCase().endsWith(ext))
  } catch {
    return false
  }
}

export function isVideo(url: string) {
  try {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov']
    return videoExtensions.some((ext) => new URL(url).pathname.toLowerCase().endsWith(ext))
  } catch {
    return false
  }
}
