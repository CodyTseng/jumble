import { POMEGRANATE_CENTRAL_URL, POMEGRANATE_OPERATOR_URLS } from '@/constants'
import { isValidPubkey } from '@/lib/pubkey'
import {
  aggregateSecretKeyShards,
  decodeShard,
  hexPubShard,
  hexShard,
  trustedKeyDeal
} from '@fiatjaf/promenade-trusted-dealer'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'
import { nsecEncode } from 'nostr-tools/nip19'

// A Google auth token is valid for 24h on the central server.
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000
// How long to wait for a popup (Google sign-in / shard recovery) to post back.
const POPUP_TIMEOUT_MS = 5 * 60 * 1000

const utf8 = new TextEncoder()

// Nostr event kinds for the pomegranate registration protocol.
const KIND_ACCOUNT_REGISTRATION = 20445
const KIND_OPERATOR_REGISTRATION = 20444

export type TPomegranateOperator = {
  url: string
  pubshard: string
}

export type TPomegranateAccount = {
  email: string
  pubkey: string
  operators: TPomegranateOperator[]
  threshold: number
}

export type TPomegranateProfile = {
  handler_pubkey: string
  name: string
  email: string
}

export type TGoogleToken = {
  raw: string
  email: string
  createdAt: number
}

export type TPomegranateLoginStatus = 'checking' | 'creating'

/** The browser blocked `window.open` — usually a popup-blocker setting. */
export class PomegranatePopupBlockedError extends Error {
  constructor() {
    super('Popup was blocked')
    this.name = 'PomegranatePopupBlockedError'
  }
}

/** The user closed the popup before it posted a result back. */
export class PomegranatePopupClosedError extends Error {
  constructor() {
    super('Popup was closed')
    this.name = 'PomegranatePopupClosedError'
  }
}

class PomegranateService {
  static instance: PomegranateService

  constructor() {
    if (!PomegranateService.instance) {
      PomegranateService.instance = this
    }
    return PomegranateService.instance
  }

  /**
   * One-click Google login. Authenticates with Google, ensures an account and
   * a signing profile exist on the central server, and returns the bunker URL
   * to log in with plus the central URL to persist on the account.
   */
  async loginFlow(
    onStatus: (status: TPomegranateLoginStatus) => void
  ): Promise<{ bunkerUrl: string; central: string }> {
    const central = this.massageURL(POMEGRANATE_CENTRAL_URL)
    const token = await this.authenticateWithGoogle(central)

    onStatus('checking')
    const account = await this.getAccount(central, token)
    if (!account) {
      onStatus('creating')
      await this.createAccount(central, token)
    }

    let profiles = await this.listProfiles(central, token)
    if (profiles.length === 0) {
      profiles = [await this.createProfile(central, token, 'default')]
    }

    return { bunkerUrl: this.getBunkerUrl(central, profiles[0]), central }
  }

  /**
   * Authenticates with Google, fetches the pomegranate account so the caller
   * knows the operators and threshold. Used by the export-nsec flow.
   */
  async startRecovery(
    central: string
  ): Promise<{ token: TGoogleToken; account: TPomegranateAccount }> {
    const centralURL = this.massageURL(central)
    const token = await this.authenticateWithGoogle(centralURL)
    const account = await this.getAccount(centralURL, token)
    if (!account) {
      throw new Error('No pomegranate account found for this Google login')
    }
    return { token, account }
  }

  /**
   * Removes the account from the central server. This only severs the link
   * between the account and the central signer; the underlying key still
   * exists and the account remains usable via its nsec. Must be called from a
   * user gesture so the Google sign-in popup is not blocked.
   */
  async disconnectAccount(central: string): Promise<void> {
    const centralURL = this.massageURL(central)
    const token = await this.authenticateWithGoogle(centralURL)
    await this.deleteAccount(centralURL, token)
  }

  /**
   * Recovers a single secret-key shard from one operator. Opens a popup that
   * runs the operator's Google recovery flow. Must be called from a user
   * gesture so the popup is not blocked.
   */
  async recoverShard(operator: TPomegranateOperator): Promise<string> {
    const operatorURL = this.massageURL(operator.url)
    const popup = this.openPopup(`${operatorURL}/po/recover/google`, 'PomegranateRecover')
    const shard = await this.awaitPopupMessage<string>(popup, operatorURL, (data) =>
      typeof data === 'string' ? data : undefined
    )
    if (!shard.startsWith(operator.pubshard)) {
      throw new Error('Recovered shard does not match the operator')
    }
    return shard
  }

  /**
   * Aggregates recovered shards back into the secret key and returns its nsec.
   * Verifies the recovered key matches the expected account pubkey.
   */
  aggregateNsec(shards: string[], expectedPubkey: string): string {
    const secret = aggregateSecretKeyShards(shards.map(hexToBytes).map(decodeShard))
    const secretKey = this.bigintTo32Bytes(secret)
    if (getPublicKey(secretKey) !== expectedPubkey) {
      throw new Error('Recovered key does not match the account')
    }
    return nsecEncode(secretKey)
  }

  // --- internal -------------------------------------------------------------

  /** Opens the Google sign-in popup at the central server and resolves a token. */
  private async authenticateWithGoogle(central: string): Promise<TGoogleToken> {
    const popup = this.openPopup(`${central}/login/google`, 'PomegranateLogin')
    const raw = await this.awaitPopupMessage<string>(popup, central, (data) => {
      if (
        data &&
        typeof data === 'object' &&
        typeof (data as { token?: unknown }).token === 'string'
      ) {
        return (data as { token: string }).token
      }
      return undefined
    })
    return this.decodeGoogleToken(raw)
  }

  /** GET /account — returns the account, or null when none exists yet. */
  private async getAccount(
    central: string,
    token: TGoogleToken
  ): Promise<TPomegranateAccount | null> {
    const res = await this.apiJson<TPomegranateAccount>(`${central}/account`, {
      headers: { Authorization: `Token ${token.raw}` }
    })
    if (res.status === 401) {
      throw new Error('Google session expired, please sign in again')
    }
    if (res.ok && res.data && res.data.pubkey) {
      return res.data
    }
    return null
  }

  /**
   * Creates a new account: generates a key, splits it into shards via a
   * trusted dealer, registers with the central server and every operator.
   * The generated key is used only to sign the registration events and is
   * never persisted.
   */
  private async createAccount(central: string, token: TGoogleToken): Promise<void> {
    // The operator's identity (central tag + token hash) is its origin; only
    // the HTTP endpoints below carry the `/po` path prefix.
    const operators = POMEGRANATE_OPERATOR_URLS.map((url) => this.massageURL(url))
    if (operators.length < 2) {
      throw new Error('At least 2 operators are required')
    }
    const threshold = Math.ceil((operators.length * 7) / 12)
    const session = crypto.randomUUID()

    const secretKey = generateSecretKey()
    const masterSk = BigInt('0x' + bytesToHex(secretKey))
    const { shards } = trustedKeyDeal(masterSk, threshold, operators.length)

    // Register the account with the central server.
    const regEvent = finalizeEvent(
      {
        kind: KIND_ACCOUNT_REGISTRATION,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['threshold', String(threshold)],
          ...operators.map((op, i) => ['operator', op, hexPubShard(shards[i].pubShard)])
        ],
        content: ''
      },
      secretKey
    )
    const regRes = await fetch(`${central}/register`, {
      method: 'POST',
      body: JSON.stringify(regEvent),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token.raw}`,
        'X-Pomegranate-Session': session
      }
    })
    if (regRes.status !== 200) {
      throw new Error('Central server registration failed')
    }

    // Register with every operator in parallel. A few may fail; the account
    // still works as long as at least `threshold` operators hold their shard.
    const failedOperators = (
      await Promise.all(
        operators.map(async (operator, i): Promise<string | null> => {
          const event = finalizeEvent(
            {
              kind: KIND_OPERATOR_REGISTRATION,
              created_at: Math.floor(Date.now() / 1000),
              tags: [
                ['central', central],
                ['email', token.email]
              ],
              content: hexShard(shards[i])
            },
            secretKey
          )
          try {
            const opRes = await fetch(`${operator}/po/register`, {
              method: 'POST',
              body: JSON.stringify(event),
              headers: {
                'Content-Type': 'application/json',
                'X-Pomegranate-Operator-Token': this.operatorToken(session, operator)
              }
            })
            if (opRes.ok) {
              return null
            }
            const body = await opRes.text().catch(() => '')
            console.warn(
              `[pomegranate] operator registration failed: ${operator} ` +
                `(HTTP ${opRes.status} ${opRes.statusText}) ${body.slice(0, 300)}`
            )
            return operator
          } catch (err) {
            console.warn(`[pomegranate] operator registration error: ${operator}`, err)
            return operator
          }
        })
      )
    ).filter((url): url is string => url !== null)

    const registeredCount = operators.length - failedOperators.length
    if (registeredCount < threshold) {
      throw new Error(
        `Could not register with enough operators (${registeredCount}/${threshold}). ` +
          'Please try again.'
      )
    }
  }

  /** GET /profiles — the signing profiles owned by the account. */
  private async listProfiles(central: string, token: TGoogleToken): Promise<TPomegranateProfile[]> {
    const res = await this.apiJson<TPomegranateProfile[]>(`${central}/profiles`, {
      headers: { Authorization: `Token ${token.raw}` }
    })
    if (!res.ok || !Array.isArray(res.data)) {
      throw new Error('Failed to load signing profiles')
    }
    return res.data
  }

  /** POST /profiles — creates a signing profile and returns it. */
  private async createProfile(
    central: string,
    token: TGoogleToken,
    name: string
  ): Promise<TPomegranateProfile> {
    const res = await fetch(`${central}/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token.raw}`
      },
      body: JSON.stringify({ name })
    })
    if (!res.ok) {
      throw new Error('Signing profile creation failed')
    }
    let profile = null
    try {
      profile = JSON.parse(await res.text()) as TPomegranateProfile
    } catch {
      // fall through to the error below
    }
    if (!profile?.handler_pubkey || !isValidPubkey(profile.handler_pubkey)) {
      throw new Error('Signing profile creation did not complete')
    }
    return profile
  }

  private async deleteAccount(central: string, token: TGoogleToken): Promise<void> {
    const res = await fetch(`${central}/account`, {
      method: 'DELETE',
      headers: { Authorization: `Token ${token.raw}` }
    })
    if (!res.ok) {
      throw new Error('Account deletion failed')
    }
  }

  /** Builds the NIP-46 bunker URL for a signing profile. */
  private getBunkerUrl(central: string, profile: TPomegranateProfile): string {
    const relay = central.replace(/^http/, 'ws')
    return `bunker://${profile.handler_pubkey}?relay=${encodeURIComponent(relay)}`
  }

  private operatorToken(session: string, operatorUrl: string): string {
    return bytesToHex(sha256(utf8.encode(`${session}:${operatorUrl}`)))
  }

  private decodeGoogleToken(raw: string): TGoogleToken {
    let createdAt: number | null = null
    let email = ''
    try {
      const parsed = JSON.parse(atob(raw)) as { created_at?: unknown; tags?: unknown }
      if (typeof parsed.created_at === 'number') {
        createdAt = parsed.created_at * 1000
      }
      if (Array.isArray(parsed.tags)) {
        const emailTag = parsed.tags.find(
          (tag): tag is [string, string] =>
            Array.isArray(tag) && tag.length > 1 && tag[0] === 'email' && typeof tag[1] === 'string'
        )
        email = emailTag?.[1] ?? ''
      }
    } catch {
      throw new Error('Invalid Google sign-in token')
    }
    if (createdAt === null || Date.now() - createdAt > TOKEN_MAX_AGE_MS) {
      throw new Error('Google sign-in token expired, please try again')
    }
    return { raw, email, createdAt }
  }

  private async apiJson<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; data: T | null }> {
    const res = await fetch(url, options)
    let data: T | null = null
    const text = await res.text().catch(() => '')
    if (text) {
      try {
        data = JSON.parse(text) as T
      } catch {
        data = null
      }
    }
    return { ok: res.ok, status: res.status, data }
  }

  /** Normalizes a URL to its origin (drops path, trailing slash, etc.). */
  private massageURL(input: string): string {
    let url = input.trim()
    if (!url.startsWith('http')) {
      url = 'http' + (url.startsWith('localhost') ? '' : 's') + '://' + url
    }
    return new URL(url).origin
  }

  private bigintTo32Bytes(n: bigint): Uint8Array {
    return hexToBytes(n.toString(16).padStart(64, '0'))
  }

  private openPopup(url: string, name: string): Window {
    const width = 600
    const height = 700
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2)
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2)
    const popup = window.open(
      url,
      name,
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`
    )
    if (!popup) {
      throw new PomegranatePopupBlockedError()
    }
    return popup
  }

  /**
   * Resolves with the first message posted by `popup` from `expectedOrigin`
   * for which `extract` returns a defined value. Rejects if the popup is
   * closed first or the wait times out.
   */
  private awaitPopupMessage<T>(
    popup: Window,
    expectedOrigin: string,
    extract: (data: unknown) => T | undefined
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        window.removeEventListener('message', onMessage)
        window.clearInterval(closeMonitor)
        window.clearTimeout(timer)
      }

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== expectedOrigin || event.source !== popup) {
          return
        }
        const value = extract(event.data)
        if (value === undefined) {
          return
        }
        cleanup()
        popup.close()
        resolve(value)
      }

      const closeMonitor = window.setInterval(() => {
        if (popup.closed) {
          cleanup()
          reject(new PomegranatePopupClosedError())
        }
      }, 300)

      const timer = window.setTimeout(() => {
        cleanup()
        popup.close()
        reject(new Error('Timed out waiting for the popup'))
      }, POPUP_TIMEOUT_MS)

      window.addEventListener('message', onMessage)
    })
  }
}

const instance = new PomegranateService()

export default instance
