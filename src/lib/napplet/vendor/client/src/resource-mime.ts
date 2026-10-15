/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
/** MIME is derived from bytes, never an upstream header. Active documents are not resources. */
export function resourceMime(bytes: Uint8Array, verifiedBinary = false): string {
  const head = Array.from(bytes.slice(0, 16))
  const ascii = new TextDecoder().decode(bytes.slice(0, 512))
  if (head.slice(0, 8).join() === '137,80,78,71,13,10,26,10') return 'image/png'
  if (head[0] === 255 && head[1] === 216 && head[2] === 255) return 'image/jpeg'
  if (/^GIF8[79]a/.test(ascii)) return 'image/gif'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') return 'audio/wav'
  if (ascii.startsWith('OggS')) return 'audio/ogg'
  if (ascii.startsWith('ID3') || (head[0] === 255 && (head[1] & 224) === 224)) return 'audio/mpeg'
  if (head.slice(0, 4).join() === '26,69,223,163' && ascii.slice(0, 256).includes('webm'))
    return 'video/webm'
  if (ascii.slice(4, 8) === 'ftyp') return 'video/mp4'
  if (ascii.startsWith('wOF2')) return 'font/woff2'
  if (ascii.startsWith('wOFF')) return 'font/woff'
  // Raw SVG/XML and HTML are refused. No parser, script, or remote references run on the server.
  if (/<(?:svg|html|script|!doctype|\?xml)\b/i.test(new TextDecoder().decode(bytes.slice(0, 4096))))
    throw new Error('blocked-by-policy')
  if (verifiedBinary && /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(ascii))
    return 'application/octet-stream'
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    if (verifiedBinary) return 'application/octet-stream'
    throw new Error('blocked-by-policy')
  }
  if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    if (verifiedBinary) return 'application/octet-stream'
    throw new Error('blocked-by-policy')
  }
  try {
    JSON.parse(text)
    return 'application/json'
  } catch {
    /* Ignore invalid optional input. */
  }
  return 'text/plain'
}
