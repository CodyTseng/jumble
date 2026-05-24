/**
 * Browser-native ElectrumX WebSocket client for Namecoin name resolution.
 *
 * Connects directly from the browser to ElectrumX servers over WebSocket
 * (ws:// or wss://) — no backend proxy or server-side code needed.
 *
 * Protocol: JSON-RPC 1.0 over WebSocket text frames (newline-delimited).
 * ElectrumX 1.16.0+ with websockets support required on the server side.
 *
 * Connection model: one persistent, multiplexed WebSocket per ElectrumX
 * server URL. Concurrent name lookups share the same socket and dispatch
 * responses by JSON-RPC `id`. Sockets close themselves after a short idle
 * window with no in-flight calls. This collapses N concurrent `.bit`
 * lookups into 1 socket rather than N short-lived sockets — important
 * because browsers cap renderer-wide WebSocket counts (Chromium ≈ 256;
 * Safari is markedly lower and slow to open many in parallel).
 *
 * Resolution strategy:
 * 1. Build a canonical name index script for the identifier
 * 2. Compute the Electrum-style scripthash (reversed SHA-256)
 * 3. Query blockchain.scripthash.get_history to find the latest tx
 * 4. Fetch the verbose transaction and parse the name value from the script
 * 5. Check current block height for name expiry
 */

import {
  OP_NAME_UPDATE,
  OP_2DROP,
  OP_DROP,
  OP_RETURN,
  NAME_EXPIRE_DEPTH,
  DEFAULT_ELECTRUMX_SERVERS,
  type ElectrumxWsServer
} from './constants'
import type { NameShowResult } from './types'

// ── Crypto helpers (Web Crypto API) ─────────────────────────────────

/** SHA-256 hash using the browser's Web Crypto API */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  if (!crypto?.subtle) {
    throw new Error('crypto.subtle unavailable (insecure context?). Use https:// or localhost.')
  }
  const hash = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hash)
}

/** Convert Uint8Array to hex string */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const len = hex.length
  const arr = new Uint8Array(len / 2)
  for (let i = 0; i < len; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return arr
}

// ── Script building ─────────────────────────────────────────────────

/** Bitcoin-style push data encoding */
function pushData(data: Uint8Array): Uint8Array {
  const len = data.length
  if (len === 0) {
    return new Uint8Array([0x00])
  }
  if (len < 0x4c) {
    const result = new Uint8Array(1 + len)
    result[0] = len
    result.set(data, 1)
    return result
  }
  if (len <= 0xff) {
    const result = new Uint8Array(2 + len)
    result[0] = 0x4c // OP_PUSHDATA1
    result[1] = len
    result.set(data, 2)
    return result
  }
  const result = new Uint8Array(3 + len)
  result[0] = 0x4d // OP_PUSHDATA2
  result[1] = len & 0xff
  result[2] = (len >> 8) & 0xff
  result.set(data, 3)
  return result
}

/**
 * Build the canonical name index script for ElectrumX lookup.
 *
 * Format: OP_NAME_UPDATE <push(name)> <push(empty)> OP_2DROP OP_DROP OP_RETURN
 *
 * This matches the script pattern indexed by the Namecoin ElectrumX fork
 * (electrumx/lib/coins.py: NamecoinMixin.build_name_index_script).
 */
function buildNameIndexScript(nameBytes: Uint8Array): Uint8Array {
  const namePush = pushData(nameBytes)
  const emptyPush = pushData(new Uint8Array(0))

  const result = new Uint8Array(1 + namePush.length + emptyPush.length + 3)
  let offset = 0
  result[offset++] = OP_NAME_UPDATE
  result.set(namePush, offset)
  offset += namePush.length
  result.set(emptyPush, offset)
  offset += emptyPush.length
  result[offset++] = OP_2DROP
  result[offset++] = OP_DROP
  result[offset++] = OP_RETURN

  return result
}

/**
 * Compute the Electrum-style scripthash: SHA-256 of the script, byte-reversed, hex-encoded.
 */
async function electrumScripthash(script: Uint8Array): Promise<string> {
  const hash = await sha256(script)
  hash.reverse()
  return toHex(hash)
}

// ── Transaction parsing ─────────────────────────────────────────────

/** Read a push-data encoded byte sequence from script at pos */
function readPushData(script: Uint8Array, pos: number): { data: Uint8Array; next: number } | null {
  if (pos >= script.length) return null
  const opcode = script[pos]

  if (opcode === 0x00) {
    return { data: new Uint8Array(0), next: pos + 1 }
  }
  if (opcode >= 0x01 && opcode <= 0x4b) {
    const end = pos + 1 + opcode
    if (end > script.length) return null
    return { data: script.slice(pos + 1, end), next: end }
  }
  if (opcode === 0x4c) {
    if (pos + 2 > script.length) return null
    const len = script[pos + 1]
    const end = pos + 2 + len
    if (end > script.length) return null
    return { data: script.slice(pos + 2, end), next: end }
  }
  if (opcode === 0x4d) {
    if (pos + 3 > script.length) return null
    const len = script[pos + 1] | (script[pos + 2] << 8)
    const end = pos + 3 + len
    if (end > script.length) return null
    return { data: script.slice(pos + 3, end), next: end }
  }
  return null
}

interface VerboseTxVout {
  scriptPubKey?: { hex?: string; asm?: string }
}

interface VerboseTxResult {
  vout?: VerboseTxVout[]
}

/** Parse NAME_UPDATE name and value from a verbose transaction response */
function parseNameFromVerboseTx(
  txResult: VerboseTxResult,
  expectedName: string
): { name: string; value: string } | null {
  const nameBytes = new TextEncoder().encode(expectedName)

  for (const vout of txResult.vout || []) {
    const hex = vout.scriptPubKey?.hex
    if (!hex || !hex.startsWith('53')) continue // Must start with OP_NAME_UPDATE

    const script = hexToBytes(hex)
    if (script[0] !== OP_NAME_UPDATE) continue

    const nameParsed = readPushData(script, 1)
    if (!nameParsed) continue

    if (nameParsed.data.length !== nameBytes.length) continue
    let match = true
    for (let i = 0; i < nameBytes.length; i++) {
      if (nameParsed.data[i] !== nameBytes[i]) {
        match = false
        break
      }
    }
    if (!match) continue

    const valueParsed = readPushData(script, nameParsed.next)
    if (!valueParsed) continue

    const name = new TextDecoder('ascii').decode(nameParsed.data)
    const value = new TextDecoder('utf-8').decode(valueParsed.data)
    return { name, value }
  }
  return null
}

// ── Multiplexed WebSocket JSON-RPC client ───────────────────────────

interface HistoryEntry {
  tx_hash: string
  height: number
}

interface RpcResponse {
  jsonrpc?: string
  id?: number
  method?: string
  result?: unknown
  error?: { code: number; message: string }
}

interface PendingCall {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/** ms a socket may sit with no in-flight calls before being closed. */
const IDLE_CLOSE_MS = 15_000
/** ms to wait for the WebSocket to open before failing. */
const OPEN_TIMEOUT_MS = 10_000
/** default per-call timeout. */
const DEFAULT_CALL_TIMEOUT_MS = 20_000

type ConnState = 'connecting' | 'open' | 'closed'

/**
 * Persistent, multiplexed ElectrumX client over a single WebSocket.
 *
 * Concurrent callers share one socket; each call gets a unique JSON-RPC id
 * and is dispatched independently when the matching response arrives.
 * Server-initiated frames (banner, headers subscriptions, relayfee pushes)
 * carry no matching id and are silently discarded.
 *
 * After all in-flight calls settle, the socket stays open for IDLE_CLOSE_MS
 * to absorb follow-up bursts (a feed render typically resolves several
 * `.bit` identifiers within a second of each other), then closes itself.
 */
export class ElectrumxClient {
  private ws: WebSocket | null = null
  private state: ConnState = 'closed'
  private openWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = []
  private pending = new Map<number, PendingCall>()
  private nextId = 1
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private openTimer: ReturnType<typeof setTimeout> | null = null

  constructor(readonly url: string) {}

  /**
   * Issue a single JSON-RPC call over the shared socket. Opens the socket
   * lazily on first use and reuses it for subsequent concurrent calls.
   */
  call(
    method: string,
    params: unknown[],
    timeoutMs: number = DEFAULT_CALL_TIMEOUT_MS
  ): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const start = () => {
        if (this.state !== 'open' || !this.ws) {
          reject(new Error(`ElectrumX socket not open: ${this.url}`))
          return
        }
        const id = this.nextId++
        const timer = setTimeout(() => {
          const entry = this.pending.get(id)
          if (!entry) return
          this.pending.delete(id)
          entry.reject(new Error(`ElectrumX RPC '${method}' timeout after ${timeoutMs}ms`))
          this.scheduleIdleClose()
        }, timeoutMs)
        this.pending.set(id, { resolve, reject, timer })
        this.cancelIdleClose()
        try {
          this.ws.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n')
        } catch (err) {
          const entry = this.pending.get(id)
          if (entry) {
            clearTimeout(entry.timer)
            this.pending.delete(id)
          }
          reject(err instanceof Error ? err : new Error(String(err)))
          this.scheduleIdleClose()
        }
      }

      this.ensureOpen()
        .then(start)
        .catch((err) => reject(err instanceof Error ? err : new Error(String(err))))
    })
  }

  /**
   * Convenience: issue multiple calls in parallel over the shared socket and
   * resolve to results in the same order. (Each call is independent; this
   * does NOT serialise them.)
   */
  callAll(
    calls: Array<{ method: string; params: unknown[] }>,
    timeoutMs?: number
  ): Promise<unknown[]> {
    return Promise.all(calls.map(({ method, params }) => this.call(method, params, timeoutMs)))
  }

  /** Force-close the socket and fail any in-flight calls. */
  close(reason = 'closed by caller') {
    const err = new Error(`ElectrumX socket closed: ${reason}`)
    this.failAllPending(err)
    this.cancelIdleClose()
    this.cancelOpenTimer()
    const ws = this.ws
    this.ws = null
    this.state = 'closed'
    if (ws) {
      try {
        ws.close()
      } catch {
        // ignore
      }
    }
    // Reject any open waiters so callers don't hang.
    const waiters = this.openWaiters
    this.openWaiters = []
    for (const w of waiters) w.reject(err)
  }

  /** True when the socket is connected and ready to send. */
  get isOpen(): boolean {
    return this.state === 'open'
  }

  /** Total in-flight RPC calls awaiting a response. */
  get inFlight(): number {
    return this.pending.size
  }

  // ── Internal ──────────────────────────────────────────────────────

  private ensureOpen(): Promise<void> {
    if (this.state === 'open') return Promise.resolve()
    if (this.state === 'connecting') {
      return new Promise<void>((resolve, reject) => {
        this.openWaiters.push({ resolve, reject })
      })
    }

    // state === 'closed' — initiate.
    this.state = 'connecting'
    return new Promise<void>((resolve, reject) => {
      this.openWaiters.push({ resolve, reject })
      let ws: WebSocket
      try {
        ws = new WebSocket(this.url)
      } catch (err) {
        this.state = 'closed'
        const e = err instanceof Error ? err : new Error(String(err))
        const waiters = this.openWaiters
        this.openWaiters = []
        for (const w of waiters) w.reject(e)
        return
      }
      this.ws = ws
      this.openTimer = setTimeout(() => {
        if (this.state === 'connecting') {
          this.bailOnOpenFailure(new Error(`ElectrumX connect timeout: ${this.url}`))
        }
      }, OPEN_TIMEOUT_MS)

      ws.addEventListener('open', () => {
        this.cancelOpenTimer()
        this.state = 'open'
        const waiters = this.openWaiters
        this.openWaiters = []
        for (const w of waiters) w.resolve()
        this.scheduleIdleClose()
      })

      ws.addEventListener('message', (ev) => this.onMessage(ev))

      ws.addEventListener('error', () => {
        if (this.state === 'connecting') {
          this.bailOnOpenFailure(new Error(`ElectrumX connect failed: ${this.url}`))
        } else {
          // Error after open — let close handler tear everything down.
        }
      })

      ws.addEventListener('close', (ev) => {
        const wasConnecting = this.state === 'connecting'
        const reason = `ElectrumX socket closed (code=${ev.code})`
        this.cancelOpenTimer()
        this.cancelIdleClose()
        this.ws = null
        this.state = 'closed'
        const err = new Error(reason)
        this.failAllPending(err)
        if (wasConnecting) {
          const waiters = this.openWaiters
          this.openWaiters = []
          for (const w of waiters) w.reject(err)
        }
      })
    })
  }

  private bailOnOpenFailure(err: Error) {
    this.cancelOpenTimer()
    const ws = this.ws
    this.ws = null
    this.state = 'closed'
    const waiters = this.openWaiters
    this.openWaiters = []
    for (const w of waiters) w.reject(err)
    if (ws) {
      try {
        ws.close()
      } catch {
        // ignore
      }
    }
  }

  private onMessage(ev: MessageEvent) {
    if (this.state !== 'open') return
    const data = typeof ev.data === 'string' ? ev.data : String(ev.data)
    // ElectrumX may pack multiple JSON-RPC messages into a single frame,
    // separated by newlines.
    for (const line of data.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let msg: RpcResponse
      try {
        msg = JSON.parse(trimmed)
      } catch {
        // Malformed frame — ignore.
        continue
      }
      // ElectrumX is bidirectional JSON-RPC: the server initiates its own
      // RPC calls at us (server.banner, blockchain.headers.subscribe,
      // blockchain.relayfee, blockchain.estimatefee, …) which arrive
      // interleaved with — and often before — responses to our outstanding
      // requests. Only consume frames whose id matches a pending call;
      // discard everything else.
      if (typeof msg.id !== 'number') continue
      const entry = this.pending.get(msg.id)
      if (!entry) continue
      this.pending.delete(msg.id)
      clearTimeout(entry.timer)
      if (msg.error) {
        entry.reject(new Error(msg.error.message || `RPC error ${msg.error.code}`))
      } else {
        entry.resolve(msg.result)
      }
    }
    if (this.pending.size === 0) this.scheduleIdleClose()
  }

  private failAllPending(err: Error) {
    const entries = Array.from(this.pending.values())
    this.pending.clear()
    for (const e of entries) {
      clearTimeout(e.timer)
      e.reject(err)
    }
  }

  private scheduleIdleClose() {
    this.cancelIdleClose()
    if (this.pending.size > 0) return
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      if (this.pending.size === 0 && this.state === 'open' && this.ws) {
        try {
          this.ws.close()
        } catch {
          // ignore — close handler still runs.
        }
      }
    }, IDLE_CLOSE_MS)
  }

  private cancelIdleClose() {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private cancelOpenTimer() {
    if (this.openTimer !== null) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
  }
}

/**
 * Module-level pool: one ElectrumxClient per server URL. Concurrent name
 * lookups against the same server share the same socket; lookups against
 * different servers each get their own. Sockets self-close on idle.
 */
const clientPool = new Map<string, ElectrumxClient>()

/**
 * Get or create the shared client for a given server URL.
 *
 * The same ElectrumxClient instance is returned for the lifetime of the
 * pool. The client transparently re-opens its socket on the next `call()`
 * after an idle-close or a server-initiated disconnect, so callers never
 * have to think about connection state.
 */
export function getElectrumxClient(url: string): ElectrumxClient {
  let client = clientPool.get(url)
  if (!client) {
    client = new ElectrumxClient(url)
    clientPool.set(url, client)
  }
  return client
}

/** Close all pooled clients. Test/teardown utility. */
export function closeAllElectrumxClients(reason = 'pool reset') {
  for (const client of clientPool.values()) {
    client.close(reason)
  }
  clientPool.clear()
}

/**
 * Backward-compatible batch call. Opens a one-shot connection if no pooled
 * client exists yet, but otherwise multiplexes through the shared one.
 * Kept for callers that already pass a list of method/params pairs.
 */
export function wsRpcBatch(
  url: string,
  calls: Array<{ method: string; params: unknown[] }>,
  timeoutMs = DEFAULT_CALL_TIMEOUT_MS
): Promise<unknown[]> {
  const client = getElectrumxClient(url)
  return client.callAll(calls, timeoutMs)
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Resolve a Namecoin name via WebSocket to an ElectrumX server.
 *
 * Reuses a shared, multiplexed WebSocket per server. Concurrent `.bit`
 * lookups against the same server share one socket; the socket idles for
 * IDLE_CLOSE_MS after the last in-flight call before closing.
 *
 * @param fullName  The Namecoin name, e.g. "d/example" or "id/alice"
 * @param serverUrl WebSocket URL of the ElectrumX server
 * @returns NameShowResult if found, null if the name doesn't exist
 */
export async function nameShowWs(
  fullName: string,
  serverUrl?: string
): Promise<NameShowResult | null> {
  const url = serverUrl || DEFAULT_ELECTRUMX_SERVERS[0].url
  const client = getElectrumxClient(url)

  // 1. Compute scripthash
  const nameBytes = new TextEncoder().encode(fullName)
  const script = buildNameIndexScript(nameBytes)
  const scripthash = await electrumScripthash(script)

  // 2. Negotiate version + get history in parallel on the shared socket
  const [, history] = (await client.callAll([
    { method: 'server.version', params: ['jumble/0.1', '1.4'] },
    { method: 'blockchain.scripthash.get_history', params: [scripthash] }
  ])) as [unknown, HistoryEntry[]]

  if (!history || !history.length) return null

  // 3. Get latest transaction + current block height
  const latest = history.reduce((a, b) => (a.height > b.height ? a : b))

  const [txResult, headersResult] = (await client.callAll([
    { method: 'blockchain.transaction.get', params: [latest.tx_hash, true] },
    { method: 'blockchain.headers.subscribe', params: [] }
  ])) as [VerboseTxResult, { height?: number; block_height?: number }]

  const currentHeight = headersResult?.height || headersResult?.block_height || 0

  // 4. Check expiry
  const expired =
    currentHeight > 0 && latest.height > 0 && currentHeight - latest.height >= NAME_EXPIRE_DEPTH
  if (expired) {
    return {
      name: fullName,
      value: '',
      txid: latest.tx_hash,
      height: latest.height,
      expired: true,
      expiresIn: 0
    }
  }

  // 5. Parse name value from transaction
  const parsed = parseNameFromVerboseTx(txResult, fullName)
  if (!parsed) return null

  const expiresIn =
    currentHeight > 0 && latest.height > 0
      ? NAME_EXPIRE_DEPTH - (currentHeight - latest.height)
      : undefined

  return {
    name: parsed.name,
    value: parsed.value,
    txid: latest.tx_hash,
    height: latest.height,
    expired: false,
    expiresIn
  }
}

/**
 * Try multiple servers in order until one succeeds.
 */
export async function nameShowWithFallback(
  fullName: string,
  servers?: ElectrumxWsServer[]
): Promise<NameShowResult | null> {
  const serverList = servers || DEFAULT_ELECTRUMX_SERVERS
  let lastError: Error | null = null

  for (const server of serverList) {
    try {
      return await nameShowWs(fullName, server.url)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[Namecoin] Server ${server.label} failed:`, lastError.message)
    }
  }

  throw lastError || new Error('All ElectrumX servers unreachable')
}
