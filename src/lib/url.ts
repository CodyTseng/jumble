export function isWebsocketUrl(url: string): boolean {
  return /^wss?:\/\/.+$/.test(url)
}

// copy from nostr-tools/utils
export function normalizeUrl(url: string): string {
  try {
    if (url.indexOf('://') === -1) {
      if (url.startsWith('localhost:') || url.startsWith('localhost/')) {
        url = 'ws://' + url
      } else {
        url = 'wss://' + url
      }
    }
    const p = new URL(url)
    p.pathname = p.pathname.replace(/\/+/g, '/')
    if (p.pathname.endsWith('/')) p.pathname = p.pathname.slice(0, -1)
    if (p.protocol === 'https:') {
      p.protocol = 'wss:'
    } else if (p.protocol === 'http:') {
      p.protocol = 'ws:'
    }
    if ((p.port === '80' && p.protocol === 'ws:') || (p.port === '443' && p.protocol === 'wss:')) {
      p.port = ''
    }
    p.searchParams.sort()
    p.hash = ''
    return p.toString()
  } catch {
    console.error('Invalid URL:', url)
    return ''
  }
}

export function normalizeHttpUrl(url: string): string {
  try {
    if (url.indexOf('://') === -1) url = 'https://' + url
    const p = new URL(url)
    p.pathname = p.pathname.replace(/\/+/g, '/')
    if (p.pathname.endsWith('/')) p.pathname = p.pathname.slice(0, -1)
    if (p.protocol === 'wss:') {
      p.protocol = 'https:'
    } else if (p.protocol === 'ws:') {
      p.protocol = 'http:'
    }
    if (
      (p.port === '80' && p.protocol === 'http:') ||
      (p.port === '443' && p.protocol === 'https:')
    ) {
      p.port = ''
    }
    p.searchParams.sort()
    p.hash = ''
    return p.toString()
  } catch {
    console.error('Invalid URL:', url)
    return ''
  }
}

export function simplifyUrl(url: string): string {
  return url
    .replace('wss://', '')
    .replace('ws://', '')
    .replace('https://', '')
    .replace('http://', '')
    .replace(/\/$/, '')
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

export function isMedia(url: string) {
  try {
    const mediaExtensions = [
      '.mp4',
      '.webm',
      '.ogg',
      '.mov',
      '.mp3',
      '.wav',
      '.flac',
      '.aac',
      '.m4a',
      '.opus',
      '.wma'
    ]
    return mediaExtensions.some((ext) => new URL(url).pathname.toLowerCase().endsWith(ext))
  } catch {
    return false
  }
}

export const truncateUrl = (url: string, maxLength: number = 40) => {
  try {
    const urlObj = new URL(url)
    let domain = urlObj.hostname
    let path = urlObj.pathname

    if (domain.startsWith('www.')) {
      domain = domain.slice(4)
    }

    if (!path || path === '/') {
      return domain
    }

    if (path.endsWith('/')) {
      path = path.slice(0, -1)
    }

    const u = domain + path

    if (u.length > maxLength) {
      return domain + path.slice(0, maxLength - domain.length - 3) + '...'
    }

    return u
  } catch {
    // invalid URL
    let truncated = url
    if (truncated.startsWith('https://')) {
      truncated = truncated.slice(8)
    } else if (truncated.startsWith('http://')) {
      truncated = truncated.slice(7)
    }
    if (truncated.startsWith('www.')) {
      truncated = truncated.slice(4)
    }
    if (truncated.length > maxLength) {
      return truncated.slice(0, maxLength - 3) + '...'
    }
    return truncated
  }
}
