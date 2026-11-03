import { renderPomegranateBrowserPage } from '../../src/lib/pomegranate-browser-page.js'
import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { TPomegranateAuthPurpose } from '../shared/ipc-types.js'

const AUTH_TIMEOUT_MS = 5 * 60 * 1000
const MAX_RESULT_BYTES = 1024 * 1024
const AUTH_PATHS = new Set(['/login/google', '/po/recover/google'])

export type TPomegranateRecoveryAccount = {
  pubkey: string
  threshold: number
  operators: { url: string; pubshard: string }[]
}

export type TPomegranateRecoveryResult = {
  shards: string[]
}

type PendingAuthBase = {
  authUrl: string
  expectedOrigin: string
  purpose: TPomegranateAuthPurpose
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

type PendingSingleAuth = PendingAuthBase & {
  mode: 'single'
  resolve: (value: string) => void
}

type PendingRecovery = PendingAuthBase & {
  mode: 'recovery'
  expectedPubkey: string
  account: TPomegranateRecoveryAccount | null
  recoveredOperatorIndexes: Set<number>
  shards: string[]
  resolve: (value: TPomegranateRecoveryResult) => void
}

type PendingAuth = PendingSingleAuth | PendingRecovery

export type TOpenExternal = (url: string) => Promise<void>
export type TLoadRecoveryAccount = (
  centralOrigin: string,
  token: string
) => Promise<TPomegranateRecoveryAccount>

/**
 * Bridges Pomegranate's popup/postMessage flow through the system browser.
 * The system browser keeps the user's existing Google session, while a
 * loopback-only page forwards the one-time result back to Electron.
 */
export class PomegranateAuthServer {
  private server: Server | null = null
  private origin: string | null = null
  private expectedHost: string | null = null
  private startPromise: Promise<string> | null = null
  private readonly pending = new Map<string, PendingAuth>()

  constructor(
    private readonly openExternal: TOpenExternal,
    private readonly loadRecoveryAccount: TLoadRecoveryAccount = fetchRecoveryAccount
  ) {}

  start(): Promise<string> {
    if (this.origin) return Promise.resolve(this.origin)
    if (this.startPromise) return this.startPromise

    const server = createServer((req, res) => this.handle(req, res))
    this.startPromise = new Promise<string>((resolve, reject) => {
      const onError = (err: Error) => {
        server.removeListener('listening', onListening)
        this.startPromise = null
        reject(err)
      }
      const onListening = () => {
        server.removeListener('error', onError)
        const address = server.address()
        if (!address || typeof address === 'string') {
          this.startPromise = null
          server.close()
          reject(new Error('pomegranate-auth: failed to obtain bound address'))
          return
        }

        this.server = server
        this.origin = `http://127.0.0.1:${address.port}`
        this.expectedHost = `127.0.0.1:${address.port}`
        server.on('error', (err) => console.error('[pomegranate-auth]', err))
        resolve(this.origin)
      }

      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(0, '127.0.0.1')
    })
    return this.startPromise
  }

  async authenticate(input: string, purpose: TPomegranateAuthPurpose = 'login'): Promise<string> {
    const authUrl = parsePomegranateAuthUrl(input)
    const resolvedPurpose: TPomegranateAuthPurpose =
      authUrl.pathname.replace(/\/+$/, '') === '/po/recover/google'
        ? 'recovery'
        : normalizeAuthPurpose(purpose)
    const origin = await this.start()
    const requestId = randomBytes(32).toString('hex')
    const startUrl = `${origin}/pomegranate-auth/${requestId}`

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error('Timed out waiting for Google sign-in'))
      }, AUTH_TIMEOUT_MS)

      this.pending.set(requestId, {
        mode: 'single',
        authUrl: authUrl.toString(),
        expectedOrigin: authUrl.origin,
        purpose: resolvedPurpose,
        resolve,
        reject,
        timer
      })

      this.openExternal(startUrl).catch((err: unknown) => {
        const pending = this.takePending(requestId)
        pending?.reject(err instanceof Error ? err : new Error('Failed to open system browser'))
      })
    })
  }

  async recover(input: string, expectedPubkey: string): Promise<TPomegranateRecoveryResult> {
    const authUrl = parsePomegranateAuthUrl(input)
    if (authUrl.pathname.replace(/\/+$/, '') !== '/login/google') {
      throw new Error('Recovery must start at the central Google login endpoint')
    }
    if (!/^[a-f0-9]{64}$/.test(expectedPubkey)) {
      throw new Error('Invalid expected public key')
    }

    const origin = await this.start()
    const requestId = randomBytes(32).toString('hex')
    const startUrl = `${origin}/pomegranate-auth/${requestId}`

    return new Promise<TPomegranateRecoveryResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error('Timed out waiting for key recovery'))
      }, AUTH_TIMEOUT_MS)

      this.pending.set(requestId, {
        mode: 'recovery',
        authUrl: authUrl.toString(),
        expectedOrigin: authUrl.origin,
        purpose: 'recovery',
        expectedPubkey,
        account: null,
        recoveredOperatorIndexes: new Set(),
        shards: [],
        resolve,
        reject,
        timer
      })

      this.openExternal(startUrl).catch((err: unknown) => {
        const pending = this.takePending(requestId)
        pending?.reject(err instanceof Error ? err : new Error('Failed to open system browser'))
      })
    })
  }

  stop() {
    for (const requestId of this.pending.keys()) {
      const pending = this.takePending(requestId)
      pending?.reject(new Error('Google sign-in was cancelled'))
    }
    this.server?.close()
    this.server = null
    this.origin = null
    this.expectedHost = null
    this.startPromise = null
  }

  private handle(req: IncomingMessage, res: ServerResponse) {
    // DNS-rebinding defense: only accept the literal loopback host and port.
    if (req.headers.host !== this.expectedHost) {
      this.respond(res, 421, 'text/plain; charset=utf-8', 'Misdirected Request')
      return
    }

    const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
    const match = requestUrl.pathname.match(/^\/pomegranate-auth\/([a-f0-9]{64})(?:\/complete)?$/)
    if (!match) {
      this.respond(res, 404, 'text/plain; charset=utf-8', 'Not Found')
      return
    }

    const requestId = match[1]
    const pending = this.pending.get(requestId)
    if (!pending) {
      this.respond(res, 410, 'text/plain; charset=utf-8', 'This sign-in request has expired.')
      return
    }

    if (req.method === 'GET' && !requestUrl.pathname.endsWith('/complete')) {
      this.respondAuthPage(res, requestId, pending)
      return
    }
    if (req.method === 'POST' && requestUrl.pathname.endsWith('/complete')) {
      this.receiveResult(req, res, requestId)
      return
    }

    this.respond(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed')
  }

  private receiveResult(req: IncomingMessage, res: ServerResponse, requestId: string) {
    let body = ''
    let tooLarge = false
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      if (tooLarge) return
      body += chunk
      if (Buffer.byteLength(body) > MAX_RESULT_BYTES) {
        tooLarge = true
      }
    })
    req.on('end', () => {
      void this.finishReceivingResult(res, requestId, body, tooLarge)
    })
  }

  private async finishReceivingResult(
    res: ServerResponse,
    requestId: string,
    body: string,
    tooLarge: boolean
  ) {
    if (tooLarge) {
      this.respond(res, 413, 'text/plain; charset=utf-8', 'Result is too large')
      return
    }

    let value: unknown
    let operatorIndex: unknown
    try {
      const result = JSON.parse(body) as { value?: unknown; operatorIndex?: unknown }
      value = result.value
      operatorIndex = result.operatorIndex
    } catch {
      this.respond(res, 400, 'text/plain; charset=utf-8', 'Invalid result')
      return
    }
    if (typeof value !== 'string' || value.length === 0) {
      this.respond(res, 400, 'text/plain; charset=utf-8', 'Invalid result')
      return
    }

    const pending = this.pending.get(requestId)
    if (!pending) {
      this.respond(res, 410, 'text/plain; charset=utf-8', 'This sign-in request has expired.')
      return
    }

    if (pending.mode === 'single') {
      this.takePending(requestId)
      this.respondJson(res, 200, { done: true })
      pending.resolve(value)
      return
    }

    try {
      const step = await this.advanceRecovery(pending, value, operatorIndex)
      if (step.done) {
        this.takePending(requestId)
        this.respondJson(res, 200, { done: true })
        pending.resolve({ shards: [...pending.shards] })
        return
      }
      this.respondJson(res, 200, step)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Key recovery failed'
      this.takePending(requestId)
      this.respondJson(res, 400, { error: message })
      pending.reject(err instanceof Error ? err : new Error(message))
    }
  }

  private async advanceRecovery(
    pending: PendingRecovery,
    value: string,
    operatorIndex: unknown
  ): Promise<
    | { done: true }
    | {
        done: false
        operators: {
          index: number
          label: string
          url: string
          origin: string
          recovered: boolean
        }[]
        recovered: number
        required: number
      }
  > {
    if (!pending.account) {
      if (operatorIndex !== undefined) {
        throw new Error('An operator cannot be selected before central authentication')
      }
      const centralOrigin = new URL(pending.authUrl).origin
      const account = await this.loadRecoveryAccount(centralOrigin, value)
      validateRecoveryAccount(account)
      if (account.pubkey !== pending.expectedPubkey) {
        throw new Error('This Google account is linked to a different Nostr account')
      }
      pending.account = account
    } else {
      if (!Number.isInteger(operatorIndex)) {
        throw new Error('Invalid recovery operator')
      }
      const selectedIndex = operatorIndex as number
      const operator = pending.account.operators[selectedIndex]
      if (!operator || pending.recoveredOperatorIndexes.has(selectedIndex)) {
        throw new Error('Invalid recovery operator')
      }
      if (!value.startsWith(operator.pubshard)) {
        throw new Error('Recovered shard does not match the operator')
      }
      pending.shards.push(value)
      pending.recoveredOperatorIndexes.add(selectedIndex)
    }

    if (pending.shards.length >= pending.account.threshold) {
      return { done: true }
    }

    return this.createRecoveryStep(pending)
  }

  private createRecoveryStep(pending: PendingRecovery) {
    if (!pending.account) {
      throw new Error('Recovery account is not loaded')
    }

    return {
      done: false,
      operators: pending.account.operators.map((operator, index) => {
        const recoveryUrl = parsePomegranateAuthUrl(
          `${new URL(operator.url).origin}/po/recover/google`
        )
        return {
          index,
          label: recoveryUrl.host,
          url: recoveryUrl.toString(),
          origin: recoveryUrl.origin,
          recovered: pending.recoveredOperatorIndexes.has(index)
        }
      }),
      recovered: pending.shards.length,
      required: pending.account.threshold
    }
  }

  private respondAuthPage(res: ServerResponse, requestId: string, pending: PendingAuth) {
    const scriptNonce = randomBytes(18).toString('base64')
    const { html, csp } = renderPomegranateBrowserPage({
      authUrl: pending.authUrl,
      purpose: pending.purpose,
      requestId,
      scriptNonce,
      recoveryState:
        pending.mode === 'recovery' && pending.account ? this.createRecoveryStep(pending) : null
    })

    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', csp)
    this.respond(res, 200, 'text/html; charset=utf-8', html)
  }

  private takePending(requestId: string): PendingAuth | undefined {
    const pending = this.pending.get(requestId)
    if (!pending) return undefined
    this.pending.delete(requestId)
    clearTimeout(pending.timer)
    return pending
  }

  private respond(res: ServerResponse, status: number, contentType: string, body: string) {
    res.statusCode = status
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')
    res.end(body)
  }

  private respondJson(res: ServerResponse, status: number, value: unknown) {
    this.respond(res, status, 'application/json; charset=utf-8', JSON.stringify(value))
  }
}

export function parsePomegranateAuthUrl(input: string): URL {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    throw new Error('Invalid Pomegranate authentication URL')
  }

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    parsed.username ||
    parsed.password ||
    !AUTH_PATHS.has(pathname)
  ) {
    throw new Error('Invalid Pomegranate authentication URL')
  }
  return parsed
}

function normalizeAuthPurpose(value: unknown): TPomegranateAuthPurpose {
  switch (value) {
    case 'bind':
    case 'disconnect':
    case 'recovery':
      return value
    default:
      return 'login'
  }
}

async function fetchRecoveryAccount(
  centralOrigin: string,
  token: string
): Promise<TPomegranateRecoveryAccount> {
  const response = await fetch(`${centralOrigin}/account`, {
    headers: { Authorization: `Token ${token}` },
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No pomegranate account found for this Google login')
    }
    throw new Error('Failed to load the Pomegranate account')
  }
  return (await response.json()) as TPomegranateRecoveryAccount
}

function validateRecoveryAccount(account: TPomegranateRecoveryAccount) {
  if (
    !account ||
    !/^[a-f0-9]{64}$/.test(account.pubkey) ||
    !Number.isInteger(account.threshold) ||
    account.threshold < 1 ||
    !Array.isArray(account.operators) ||
    account.threshold > account.operators.length ||
    account.operators.some(
      (operator) =>
        !operator ||
        typeof operator.url !== 'string' ||
        typeof operator.pubshard !== 'string' ||
        operator.pubshard.length === 0
    )
  ) {
    throw new Error('Invalid Pomegranate account response')
  }
}
