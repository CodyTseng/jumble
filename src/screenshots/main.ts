import '../index.css'
import '../polyfill'
import { nip19 } from 'nostr-tools'
import { RELAY_URL, events, now, screenshotLinks, users } from './fixtures'

if (import.meta.env.MODE !== 'screenshots' || location.port !== '5180') {
  throw new Error('Screenshot fixtures require the separate screenshot dev server on port 5180')
}

const params = new URLSearchParams(location.search)
const scene = params.get('demo')

// This entry is only injected by vite.screenshots.config.ts, never the release build.
if (!scene && location.pathname === '/') {
  document.title = 'Jumble screenshot studio'
  const root = document.getElementById('root')!
  root.innerHTML = `<main style="max-width:720px;margin:64px auto;padding:24px;font-family:system-ui;line-height:1.6">
    <h1 style="font-size:32px;font-weight:700">Jumble screenshot studio</h1>
    <p>Real Jumble screens with fictional people and offline sample content.</p>
    <nav style="display:grid;gap:12px;margin:32px 0">${Object.entries(screenshotLinks)
      .map(
        ([name, href]) =>
          `<a style="display:block;padding:16px 20px;border:1px solid #ddd;border-radius:12px;text-transform:capitalize" href="${href}">${name === 'note' ? 'Note & replies' : name === 'feed' ? 'Relay feed' : name}</a>`
      )
      .join('')}</nav>
    <p>Open a scene, choose your phone viewport, and take your screenshot. Add <code>&theme=dark</code> for dark mode or <code>&lng=ar</code> to check RTL.</p>
    <p>Sample identities, replies, reactions, zaps, reposts, mentions, quotes, highlights and poll votes are linked across the screens. Publishing and external network requests are disabled.</p>
    <a href="/?demo=feed">Start with the relay feed →</a>
  </main>`
} else {
  if (location.pathname === '/' && (scene === 'note' || scene === 'profile')) {
    const target = new URL(screenshotLinks[scene], location.origin)
    for (const name of ['theme', 'lng']) {
      const value = params.get(name)
      if (value) target.searchParams.set(name, value)
    }
    history.replaceState(null, '', target.pathname + target.search)
  }
  if (scene === 'notifications' || scene === 'settings') {
    const target = new URL(location.href)
    target.searchParams.set('page', scene)
    history.replaceState(null, '', target.pathname + target.search)
  }
  await startDemo()
}

async function startDemo() {
  // Use a new cache per document, so edited fixtures never mix with old replies
  // or notification IDs. Only the demo database is closed/removed on page exit.
  // A cache namespace, not a credential. Avoid secure-context-only randomUUID
  // so the same entry works on a phone over the local network's HTTP address.
  const databaseName = `jumble-screenshot-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const openDatabase = indexedDB.open.bind(indexedDB)
  const connections = new Set<IDBDatabase>()
  indexedDB.open = (name, version) => {
    const request = openDatabase(name === 'jumble' ? databaseName : name, version)
    if (name === 'jumble')
      request.addEventListener('success', () => connections.add(request.result))
    return request
  }
  window.addEventListener(
    'pagehide',
    (event) => {
      if (event.persisted) return
      for (const database of connections) database.close()
      indexedDB.deleteDatabase(databaseName)
    },
    { once: true }
  )

  // This origin/port has its own storage; leave the user's regular app session alone.
  const account = {
    pubkey: users.mira.pubkey,
    signerType: 'nsec',
    nsec: nip19.nsecEncode(users.mira.secret)
  }
  const seed: Record<string, string> = {
    accounts: JSON.stringify([account]),
    currentAccount: JSON.stringify(account),
    accountFeedInfoMap: JSON.stringify({
      [users.mira.pubkey]: { feedType: 'relay', id: RELAY_URL }
    }),
    themeSetting: params.get('theme') === 'dark' ? 'dark' : 'light',
    defaultRelayUrls: JSON.stringify([RELAY_URL]),
    searchRelayUrls: JSON.stringify([RELAY_URL]),
    dismissedDesktopAppTip: 'true',
    dismissedPsstPsstPromotion: 'true',
    enableDm: 'false',
    systemNotificationsEnabled: 'false',
    systemNotificationsPrompted: 'true',
    disableNotificationSync: 'true',
    showLinkPreviews: 'false',
    lastReadNotificationTimeMap: JSON.stringify({ [users.mira.pubkey]: now - 8 * 60 }),
    i18nextLng: params.get('lng') ?? 'en',
    minTrustScore: '0',
    notificationListStyle: 'detailed'
  }
  for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value)

  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href)
    if (url.origin === location.origin) return nativeFetch(input, init)
    if (url.hostname === 'relay.jumble.social') {
      return Response.json({
        name: 'The Garden',
        description: 'A little corner for creative people and everyday discoveries.',
        icon: '/favicon.svg',
        supported_nips: [1, 9, 10, 11, 25, 57, 65]
      })
    }
    if (
      url.hostname === 'wallet.jumble.social' &&
      url.pathname.startsWith('/.well-known/lnurlp/')
    ) {
      return Response.json({
        callback: 'https://wallet.jumble.social/unpayable-demo',
        minSendable: 1000,
        maxSendable: 1000000,
        allowsNostr: true,
        nostrPubkey: users.luca.pubkey,
        metadata: JSON.stringify([['text/plain', 'Screenshot fixture — no payments']]),
        tag: 'payRequest'
      })
    }
    // Optional integrations must never contact real services from a demo identity.
    return new Response(null, { status: 404, statusText: 'Offline screenshot fixture' })
  }
  const NativeWebSocket = window.WebSocket
  window.WebSocket = class extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const target = new URL(url, location.href)
      if (target.host !== location.host)
        throw new Error('External sockets are disabled in the screenshot demo')
      super(url, protocols)
    }
  }

  const { startApplication } = await import('../app-bootstrap')
  const { default: client } = await import('../services/client.service')
  await Promise.all(
    events.filter((event) => event.kind === 0).map((event) => client.updateProfileEventCache(event))
  )
  for (const event of events) {
    client.addEventToCache(event)
    client.trackEventExternalSeenOn(event.id, [RELAY_URL])
  }
  await startApplication()
}
