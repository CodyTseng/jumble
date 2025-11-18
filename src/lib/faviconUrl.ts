import UriTemplate from 'uri-templates'

export function faviconUrl(template: string, url: string | URL): string {
  const u = new URL(url)

  return UriTemplate(template).fill({
    href: u.href,
    origin: u.origin,
    protocol: u.protocol,
    username: u.username,
    password: u.password,
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    pathname: u.pathname,
    hash: u.hash,
    search: u.search
  })
}
