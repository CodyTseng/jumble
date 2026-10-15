import { afterEach, describe, expect, it, vi } from 'vitest'
import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools'
import { accountStorage } from './storage'
import { closeNappletSessions, registerNappletSession } from './session'
import { scopedStorage, type KeyValueStorage } from './vendor/runtime/src/storage'
import { validateManifest } from './vendor/protocol/src/manifest'
import { sha256 } from './vendor/protocol/src/artifact'
import { aggregateHash } from './vendor/protocol/src'
import { preparePlayback } from './vendor/runtime/src/playback'
import { verifiedDocument } from './vendor/runtime/src'
import { attachNappletHost, type HostOptions } from './vendor/runtime/src/host'
import { NappletOutbox } from './vendor/runtime/src/outbox-session'
import { NappletFiles } from './vendor/runtime/src/filesystem'

vi.mock('./relay', async () => {
  const { NEVER } = await import('rxjs')
  return {
    RelayPool: class {
      req() {
        return NEVER
      }
      close() {}
    }
  }
})

function memory(): KeyValueStorage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    key: (i) => [...entries.keys()][i] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value)
    },
    removeItem: (key) => {
      entries.delete(key)
    }
  }
}
const key = new Uint8Array(32).fill(7)
const pubkey = getPublicKey(key)
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
afterEach(() => {
  vi.unstubAllGlobals()
  closeNappletSessions()
})

describe('verified napplet artifacts', () => {
  it('loads legacy manifests using the artifact path hash rather than the aggregate x tag', async () => {
    const artifactHash = await sha256('<p>Legacy app</p>')
    const aggregate = await aggregateHash([{ path: '/index.html', hash: artifactHash }])
    expect(aggregate).not.toBe(artifactHash)
    for (const kind of [35129, 15129, 5129]) {
      const tags = [
        ['path', '/index.html', artifactHash],
        ['x', aggregate, 'aggregate'],
        ...(kind === 35129 ? [['d', 'legacy']] : []),
        ...(kind === 5129 ? [['a', `35129:${pubkey}:legacy`]] : [])
      ]
      const event = finalizeEvent({ kind, tags, content: '', created_at: 1 }, key)
      expect((await preparePlayback(event)).artifactHash).toBe(artifactHash)
      await expect(preparePlayback(event, aggregate)).rejects.toThrow('does not match')
      const tampered = finalizeEvent(
        {
          ...event,
          tags: tags.map((tag) => (tag[0] === 'x' ? ['x', '0'.repeat(64), 'aggregate'] : tag))
        },
        key
      )
      await expect(preparePlayback(tampered)).rejects.toThrow('aggregate hash mismatch')
    }
  })
  it('accepts all current manifest kinds, checks R locally and tolerates absent O', async () => {
    const hash = await sha256('<p>Hello</p>')
    for (const kind of [5129, 15129, 35129]) {
      const tags = [['x', hash], ['O', 'future'], ...(kind === 35129 ? [['d', 'demo']] : [])]
      const event = finalizeEvent({ kind, tags, content: 'An app', created_at: 1 }, key)
      expect((await preparePlayback(event, hash)).artifactHash).toBe(hash)
      const unsupported = finalizeEvent({ ...event, tags: [...tags, ['R', 'future']] }, key)
      await expect(preparePlayback(unsupported, hash)).rejects.toThrow('unsupported')
      for (const domain of ['cvm', 'webrtc']) {
        const required = finalizeEvent({ ...event, tags: [...tags, ['R', domain]] }, key)
        await expect(preparePlayback(required, hash)).rejects.toThrow(domain)
        const optional = finalizeEvent({ ...event, tags: [...tags, ['O', domain]] }, key)
        expect((await preparePlayback(optional, hash)).artifactHash).toBe(hash)
      }
    }
  })
  it('rejects duplicate hashes, wrong signatures and bytes, before constructing srcdoc', async () => {
    const html = '<script>app()</script>'
    const hash = await sha256(html)
    const event = finalizeEvent(
      {
        kind: 35129,
        tags: [
          ['d', 'demo'],
          ['x', hash]
        ],
        content: 'App',
        created_at: 1
      },
      key
    )
    await expect(validateManifest({ ...event, sig: '0'.repeat(128) })).rejects.toThrow()
    await expect(
      validateManifest(finalizeEvent({ ...event, tags: [...event.tags, ['x', hash]] }, key))
    ).rejects.toThrow()
    await expect(verifiedDocument(new TextEncoder().encode('changed'), hash)).rejects.toThrow()
    const doc = await verifiedDocument(new TextEncoder().encode(html), hash, 'window.napplet={};')
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('app()'))
    expect(doc.indexOf('window.napplet')).toBeLessThan(doc.indexOf('app()'))
    expect(doc).toContain("connect-src 'none'")
  })
})

describe('account and artifact isolation', () => {
  it('isolates accounts, publishers, artifacts and instance scopes over shared storage', () => {
    const disk = memory()
    const scope = (account: string, identity = 'alice:35129:demo:hash1', instance = '1') =>
      scopedStorage(accountStorage(disk, account), identity, instance)
    const a = scope('account-a'),
      b = scope('account-b')
    a({ type: 'storage.set', key: 'state', value: 'private' })
    expect(b({ type: 'storage.get', key: 'state' })).toEqual({ value: null })
    expect(
      scope('account-a', 'bob:35129:demo:hash1')({ type: 'storage.get', key: 'state' })
    ).toEqual({ value: null })
    expect(
      scope('account-a', 'alice:35129:demo:hash2')({ type: 'storage.get', key: 'state' })
    ).toEqual({ value: null })
    expect(scope('account-a')({ type: 'storage.get', key: 'state' })).toEqual({ value: 'private' })
    a({ type: 'storage.set', key: 'window', value: 'one', scope: 'instance' })
    expect(
      scope('account-a', undefined, '2')({ type: 'storage.get', key: 'window', scope: 'instance' })
    ).toEqual({ value: null })
    const transportA = accountStorage(disk, 'account-a'),
      transportB = accountStorage(disk, 'account-b')
    transportA.setItem('transport-key', 'secret')
    expect(transportB.getItem('transport-key')).toBeNull()
    expect(transportB.length).toBe(0)
  })
  it('enforces storage quotas and closes all sessions synchronously', () => {
    const store = scopedStorage(memory(), 'app', 'instance')
    expect(() => store({ type: 'storage.set', key: 'x', value: 'x'.repeat(1024 * 1024) })).toThrow(
      'quota'
    )
    const close = vi.fn()
    const unregister = registerNappletSession(close)
    closeNappletSessions()
    expect(close).toHaveBeenCalledOnce()
    unregister()
  })
})

function hostFixture(authorize: HostOptions['authorize'] = async () => true) {
  const events = new EventTarget()
  vi.stubGlobal('window', events)
  const disk = memory()
  const messages: Record<string, unknown>[] = []
  const source = { postMessage: (message: Record<string, unknown>) => messages.push(message) }
  const host = attachNappletHost({
    frame: { contentWindow: source } as unknown as HTMLIFrameElement,
    identity: 'owner:35129:app:hash',
    manifestId: 'a'.repeat(64),
    relays: [],
    pubkey,
    storage: disk,
    isActive: () => true,
    authorize,
    prompt: () => {},
    files: () => {}
  })
  const deliver = (data: unknown, sender: unknown = source) =>
    events.dispatchEvent(Object.assign(new Event('message'), { data, source: sender }))
  deliver({ type: 'shell.ready' })
  return { host, deliver, messages }
}

describe('message authority and session retirement', () => {
  it('does not advertise or dispatch CVM and WebRTC operations', async () => {
    const authorize = vi.fn(async () => true)
    const { host, deliver, messages } = hostFixture(authorize)
    try {
      const environment = messages.find((message) => message.type === 'shell.init')!
      const domains = (environment.capabilities as { domains: string[] }).domains
      expect(domains).not.toContain('cvm')
      expect(domains).not.toContain('webrtc')
      const before = messages.length
      deliver({ type: 'cvm.request', id: 'remote', message: {} })
      deliver({ type: 'webrtc.open', id: 'peer', request: {} })
      await tick()
      expect(authorize).not.toHaveBeenCalled()
      expect(messages).toHaveLength(before)
    } finally {
      host.close()
    }
  })
  it('accepts numeric NIP-19 helper names without granting secret identifier access', async () => {
    const { host, deliver, messages } = hostFixture()
    try {
      deliver({ type: 'common.decodeNip19', id: 'public', value: nip19.npubEncode(pubkey) })
      await tick()
      expect(messages.at(-1)).toMatchObject({ id: 'public', ok: true, hex: pubkey })
      deliver({ type: 'common.decodeNip19', id: 'secret', value: nip19.nsecEncode(key) })
      await tick()
      expect(messages.at(-1)).toMatchObject({ id: 'secret', ok: false })
    } finally {
      host.close()
    }
  })
  it('silently drops foreign sources and unknown types, and withholds identity until approval', async () => {
    const authorize = vi.fn(async () => false)
    const { host, deliver, messages } = hostFixture(authorize)
    try {
      deliver({ type: 'identity.getPublicKey', id: 'foreign' }, {})
      deliver({ type: 'identity.future', id: 'unknown' })
      await tick()
      expect(authorize).not.toHaveBeenCalled()
      deliver({ type: 'identity.getPublicKey', id: 'denied' })
      await tick()
      expect(messages.at(-1)).toMatchObject({
        type: 'identity.getPublicKey.result',
        id: 'denied',
        pubkey: ''
      })
    } finally {
      host.close()
    }
  })
  it('does not return identity when a pending approval completes after closing', async () => {
    let approve!: (accepted: boolean) => void
    const { host, deliver, messages } = hostFixture(
      () =>
        new Promise((resolve) => {
          approve = resolve
        })
    )
    deliver({ type: 'identity.getPublicKey', id: 'old' })
    await tick()
    host.close()
    const count = messages.length
    approve(true)
    await tick()
    expect(messages).toHaveLength(count)
    expect(messages.some((m) => m.pubkey === pubkey)).toBe(false)
  })
  it('aborts in-flight resources and suppresses late replies on close', async () => {
    let finish!: (response: Response) => void
    let signal!: AbortSignal
    vi.stubGlobal('fetch', (_: unknown, init: RequestInit) => {
      signal = init.signal!
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    })
    const { host, deliver, messages } = hostFixture()
    deliver({ type: 'resource.bytes', id: 'request', url: 'https://assets.example/file' })
    await tick()
    host.close()
    expect(signal.aborted).toBe(true)
    const count = messages.length
    finish(new Response('old data'))
    await tick()
    expect(messages).toHaveLength(count)
  })
})

describe('publication consent and retirement', () => {
  function publication(consent = true) {
    const controller = new AbortController()
    const sign = vi.fn(async (_: string, template: Parameters<typeof finalizeEvent>[0]) =>
      finalizeEvent(template, key)
    )
    const publish = vi.fn(async () => {})
    const outbox = new NappletOutbox({
      pubkey,
      signal: controller.signal,
      sign,
      consent: async () => consent,
      plan: async () => ['wss://relay.example/'],
      io: { publish }
    })
    return { controller, sign, publish, outbox }
  }
  const message = {
    type: 'outbox.publish',
    id: 'post',
    event: { kind: 1, content: 'hello', tags: [], created_at: 1 }
  }
  it('denial never signs or publishes', async () => {
    const fixture = publication(false)
    try {
      expect(await fixture.outbox.handle(message)).toMatchObject({ ok: false })
      expect(fixture.sign).not.toHaveBeenCalled()
      expect(fixture.publish).not.toHaveBeenCalled()
    } finally {
      fixture.outbox.close()
    }
  })
  it('a signature arriving after account retirement never broadcasts', async () => {
    const fixture = publication()
    let signed!: (event: ReturnType<typeof finalizeEvent>) => void
    fixture.sign.mockImplementation(
      () =>
        new Promise((resolve) => {
          signed = resolve
        })
    )
    const result = fixture.outbox.handle(message)
    await tick()
    fixture.controller.abort()
    signed(finalizeEvent(structuredClone(message.event), key))
    await result
    await tick()
    expect(fixture.publish).not.toHaveBeenCalled()
    fixture.outbox.close()
  })
  it('approves once for identical retries and blocks app-supplied encrypted envelopes', async () => {
    const fixture = publication()
    try {
      expect(await fixture.outbox.handle(message)).toEqual(expect.objectContaining({ ok: true }))
      expect(await fixture.outbox.handle(message)).toMatchObject({ ok: true })
      expect(fixture.sign).toHaveBeenCalledOnce()
      expect(
        await fixture.outbox.handle({
          ...message,
          id: 'dm',
          event: { ...message.event, kind: 1059 }
        })
      ).toMatchObject({ ok: false })
      expect(fixture.sign).toHaveBeenCalledOnce()
    } finally {
      fixture.outbox.close()
    }
  })
})

it('virtual filesystem cannot escape its root or read another instance', async () => {
  const a = new NappletFiles(
      () => {},
      () => {}
    ),
    b = new NappletFiles(
      () => {},
      () => {}
    )
  const save = async () => true
  await a.handle({ type: 'fs.write', path: '/files/hello', data: btoa('private') }, save)
  expect(await a.handle({ type: 'fs.read', path: '/files/hello' }, save)).toMatchObject({
    result: { data: btoa('private') }
  })
  await expect(b.handle({ type: 'fs.read', path: '/files/hello' }, save)).rejects.toThrow(
    'not-found'
  )
  await expect(a.handle({ type: 'fs.read', path: '/files/../secret' }, save)).rejects.toThrow()
})
