import ipaddr from 'ipaddr.js'

export function relayUrl(value: string) {
  const url = new URL(value)
  if (
    value.length > 256 ||
    !['ws:', 'wss:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Invalid relay URL')
  return url
}
export function publicRelayUrl(value: string, browser = false) {
  const url = relayUrl(value)
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (
    url.protocol !== 'wss:' ||
    (!browser && url.port && url.port !== '443') ||
    (ipaddr.isValid(host)
      ? ipaddr.process(host).range() !== 'unicast'
      : !host.includes('.') || /\.(localhost|local|internal|home|test|invalid)$/.test(host))
  )
    throw new Error('Relay is not allowed by host policy')
  return url.href
}
export function loopbackRelayUrl(value: string) {
  const url = relayUrl(value)
  // Literal addresses only: a project setting cannot grant arbitrary LAN/DNS access.
  if (url.protocol !== 'ws:' || !['127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Relay is not allowed by host policy')
  return url.href
}
export function readRelayUrl(value: string, configured: string[] = [], browser = false) {
  try {
    return publicRelayUrl(value, browser)
  } catch {
    const local = loopbackRelayUrl(value)
    if (
      !configured.some((entry) => {
        try {
          return loopbackRelayUrl(entry) === local
        } catch {
          return false
        }
      })
    )
      throw new Error('Relay is not allowed by host policy')
    return local
  }
}
