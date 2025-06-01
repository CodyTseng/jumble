import { EventTemplate, finalizeEvent, getPublicKey as calculatePukbey, nip04, NostrEvent, SimplePool, VerifiedEvent, verifyEvent } from "nostr-tools"
import { AbstractSimplePool, SubCloser } from "nostr-tools/abstract-pool"
import { Handlerinformation, NostrConnect } from "nostr-tools/kinds"
import { NIP05_REGEX } from "nostr-tools/nip05"
import { decrypt, encrypt, getConversationKey } from "nostr-tools/nip44"
import { RelayRecord } from "nostr-tools/relay"


export const BUNKER_REGEX = /^bunker:\/\/([0-9a-f]{64})\??([?/w:.=&%-]*)$/

// const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type BunkerPointer = {
  relays: string[]
  pubkey: string
  secret: null | string
}

export function toBunkerURL(bunkerPointer: BunkerPointer): string {
  const bunkerURL = new URL(`bunker://${bunkerPointer.pubkey}`)
  bunkerPointer.relays.forEach(relay => {
    bunkerURL.searchParams.append('relay', relay)
  })
  if (bunkerPointer.secret) {
    bunkerURL.searchParams.set('secret', bunkerPointer.secret)
  }
  return bunkerURL.toString()
}

/** This takes either a bunker:// URL or a name@domain.com NIP-05 identifier
    and returns a BunkerPointer -- or null in case of error */
export async function parseBunkerInput(input: string): Promise<BunkerPointer | null> {
  const match = input.match(BUNKER_REGEX)
  if (match) {
    try {
      const pubkey = match[1]
      const qs = new URLSearchParams(match[2])
      return {
        pubkey,
        relays: qs.getAll('relay'),
        secret: qs.get('secret'),
      }
    } catch (_err) {
      console.log(_err)
      /* just move to the next case */
    }
  }

  return queryBunkerProfile(input)
}

export type NostrConnectParams = {
  clientPubkey: string;
  relays: string[];
  secret: string;
  perms?: string[];
  name?: string;
  url?: string;
  image?: string;
}

export type ParsedNostrConnectURI = {
  protocol: 'nostrconnect';
  clientPubkey: string;
  params: {
    relays: string[];
    secret: string;
    perms?: string[];
    name?: string;
    url?: string;
    image?: string;
  };
  originalString: string;
}

export function createNostrConnectURI(params: NostrConnectParams): string {
  if (!params.clientPubkey) {
    throw new Error('clientPubkey is required.');
  }
  if (!params.relays || params.relays.length === 0) {
    throw new Error('At least one relay is required.');
  }
  if (!params.secret) {
    throw new Error('secret is required.');
  }

  const queryParams = new URLSearchParams();

  params.relays.forEach(relay => {
    queryParams.append('relay', relay);
  });

  queryParams.append('secret', params.secret);

  if (params.perms && params.perms.length > 0) {
    queryParams.append('perms', params.perms.join(','));
  }
  if (params.name) {
    queryParams.append('name', params.name);
  }
  if (params.url) {
    queryParams.append('url', params.url);
  }
  if (params.image) {
    queryParams.append('image', params.image);
  }

  return `nostrconnect://${params.clientPubkey}?${queryParams.toString()}`;
}

export function parseNostrConnectURI(uri: string): ParsedNostrConnectURI {
  if (!uri.startsWith('nostrconnect://')) {
    throw new Error('Invalid nostrconnect URI: Must start with "nostrconnect://".');
  }

  const [protocolAndPubkey, queryString] = uri.split('?');
  if (!protocolAndPubkey || !queryString) {
    throw new Error('Invalid nostrconnect URI: Missing query string.');
  }

  const clientPubkey = protocolAndPubkey.substring('nostrconnect://'.length);
  if (!clientPubkey) {
    throw new Error('Invalid nostrconnect URI: Missing client-pubkey.');
  }

  const queryParams = new URLSearchParams(queryString);

  const relays = queryParams.getAll('relay');
  if (relays.length === 0) {
    throw new Error('Invalid nostrconnect URI: Missing "relay" parameter.');
  }

  const secret = queryParams.get('secret');
  if (!secret) {
    throw new Error('Invalid nostrconnect URI: Missing "secret" parameter.');
  }

  const permsString = queryParams.get('perms');
  const perms = permsString ? permsString.split(',') : undefined;

  const name = queryParams.get('name') || undefined;
  const url = queryParams.get('url') || undefined;
  const image = queryParams.get('image') || undefined;

  return {
    protocol: 'nostrconnect',
    clientPubkey,
    params: {
      relays,
      secret,
      perms,
      name,
      url,
      image,
    },
    originalString: uri,
  };
}


export async function queryBunkerProfile(nip05: string): Promise<BunkerPointer | null> {
  const match = nip05.match(NIP05_REGEX)
  if (!match) return null

  const [, name = '_', domain] = match

  try {
    const url = `https://${domain}/.well-known/nostr.json?name=${name}`
    const res = await (await fetch(url, { redirect: 'error' })).json()

    const pubkey = res.names[name]
    const relays = res.nip46[pubkey] || []

    return { pubkey, relays, secret: null }
  } catch (_err) {
    console.log(_err)
    return null
  }
}

export type BunkerSignerParams = {
  pool?: AbstractSimplePool
  onauth?: (url: string) => void
}

export class BunkerSigner {
  private pool: AbstractSimplePool
  private subCloser: SubCloser | undefined
  private isOpen: boolean
  private serial: number
  private idPrefix: string
  private listeners: {
    [id: string]: {
      resolve: (_: string) => void
      reject: (_: string) => void
    }
  }
  private waitingForAuth: { [id: string]: boolean }
  private secretKey: Uint8Array
  private conversationKey: Uint8Array | undefined
  public bp: BunkerPointer | undefined
  private parsedConnectionString: ParsedNostrConnectURI

  private cachedPubKey: string | undefined

  /**
   * Creates a new instance of the Nip46 class.
   * @param relays - An array of relay addresses.
   * @param remotePubkey - An optional remote public key. This is the key you want to sign as.
   * @param secretKey - An optional key pair.
   */
  public constructor(clientSecretKey: Uint8Array, connectionString: string, params: BunkerSignerParams = {}) {

    this.parsedConnectionString = parseNostrConnectURI(connectionString)
    this.pool = params.pool || new SimplePool()
    this.secretKey = clientSecretKey
    this.isOpen = false
    this.idPrefix = Math.random().toString(36).substring(7)
    this.serial = 0
    this.listeners = {}
    this.waitingForAuth = {}
  }


  async connect(maxWait: number = 300_000): Promise<string> {
    if (this.isOpen) {
      return ''
    }
    
    return new Promise((resolve, reject) => {
      try {
        const connectionSubCloser = this.pool.subscribe(
          this.parsedConnectionString.params.relays,
          { kinds: [NostrConnect], '#p': [calculatePukbey(this.secretKey)] },
          {
            onevent: async (event: NostrEvent) => {
              const remoteSignerPubkey = event.pubkey
              let decrypted: string
              if (event.content.includes('?iv=')) {
                decrypted = nip04.decrypt(this.secretKey, remoteSignerPubkey, event.content)
              } else {
                const tempConvKey = getConversationKey(this.secretKey, remoteSignerPubkey)
                decrypted = decrypt(event.content, tempConvKey)
              }
              const o = JSON.parse(decrypted)
              const { result } = o
              if (result === this.parsedConnectionString.params.secret) {
                this.bp = {
                  relays: this.parsedConnectionString.params.relays,
                  pubkey: event.pubkey,
                  secret: this.parsedConnectionString.params.secret,
                }
                this.conversationKey = getConversationKey(this.secretKey, event.pubkey)
                this.isOpen = true
                this.setupSubscription()
                connectionSubCloser.close()
                const bunkerInput = toBunkerURL(this.bp)
                resolve(bunkerInput)
              } else {
                console.warn('Attack from ', remoteSignerPubkey, 'with secret', decrypted, 'expected', this.parsedConnectionString.params.secret)
                return
              }
            },
            onclose: () => {
              connectionSubCloser.close()
              reject(new Error('Connection closed'))
            },
            maxWait,
          }
        )
      } catch (error) {
        reject(error)
      }
    })
  }
  

  private setupSubscription(params: BunkerSignerParams = {}) {
    const listeners = this.listeners
    const waitingForAuth = this.waitingForAuth
    const convKey = this.conversationKey

    this.subCloser = this.pool.subscribe(
      this.bp!.relays,
      { kinds: [NostrConnect], authors: [this.bp!.pubkey], '#p': [calculatePukbey(this.secretKey)] },
      {
        onevent: async (event: NostrEvent) => {
          const remoteSignerPubkey = event.pubkey
          let decrypted: string
          if (event.content.includes('?iv=')) {
            decrypted = nip04.decrypt(this.secretKey, remoteSignerPubkey, event.content)
          } else {
            decrypted = decrypt(event.content, convKey!)
          }
          const o = JSON.parse(decrypted)
          const { id, result, error } = o

          if (result === 'auth_url' && waitingForAuth[id]) {
            delete waitingForAuth[id]

            if (params.onauth) {
              params.onauth(error)
            } else {
              console.warn(
                `nostr-tools/nip46: remote signer ${this.bp!.pubkey} tried to send an "auth_url"='${error}' but there was no onauth() callback configured.`,
              )
            }
            return
          }

          const handler = listeners[id]
          if (handler) {
            if (error) handler.reject(error)
            else if (result) handler.resolve(result)
            delete listeners[id]
          }
        },
        onclose: () => {
          this.subCloser!.close()
        },
      },
    )
    this.isOpen = true
  }

  // closes the subscription -- this object can't be used anymore after this
  async close() {
    this.isOpen = false
    this.subCloser!.close()
  }

  async sendRequest(method: string, params: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.isOpen) throw new Error('this signer is not open anymore, create a new one')
        if (!this.subCloser) this.setupSubscription()
        this.serial++
        const id = `${this.idPrefix}-${this.serial}`

        const encryptedContent = encrypt(JSON.stringify({ id, method, params }), this.conversationKey!)

        // the request event
        const verifiedEvent: VerifiedEvent = finalizeEvent(
          {
            kind: NostrConnect,
            tags: [['p', this.bp!.pubkey]],
            content: encryptedContent,
            created_at: Math.floor(Date.now() / 1000),
          },
          this.secretKey,
        )

        // setup callback listener
        this.listeners[id] = { resolve, reject }
        this.waitingForAuth[id] = true

        // publish the event
        Promise.any(this.pool.publish(this.bp!.relays, verifiedEvent))
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Calls the "connect" method on the bunker.
   * The promise will be rejected if the response is not "pong".
   */
  async ping(): Promise<void> {
    const resp = await this.sendRequest('ping', [])
    if (resp !== 'pong') throw new Error(`result is not pong: ${resp}`)
  }

  /**
   * Calls the "get_public_key" method on the bunker.
   * (before we would return the public key hardcoded in the bunker parameters, but
   *  that is not correct as that may be the bunker pubkey and the actual signer
   *  pubkey may be different.)
   */
  async getPublicKey(): Promise<string> {
    if (!this.cachedPubKey) {
      this.cachedPubKey = await this.sendRequest('get_public_key', [])
    }
    return this.cachedPubKey
  }

  /**
   * @deprecated removed from NIP
   */
  async getRelays(): Promise<RelayRecord> {
    return JSON.parse(await this.sendRequest('get_relays', []))
  }

  /**
   * Signs an event using the remote private key.
   * @param event - The event to sign.
   * @returns A Promise that resolves to the signed event.
   */
  async signEvent(event: EventTemplate): Promise<VerifiedEvent> {
    const resp = await this.sendRequest('sign_event', [JSON.stringify(event)])
    const signed: NostrEvent = JSON.parse(resp)
    if (verifyEvent(signed)) {
      return signed
    } else {
      throw new Error(`event returned from bunker is improperly signed: ${JSON.stringify(signed)}`)
    }
  }

  async nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string> {
    return await this.sendRequest('nip04_encrypt', [thirdPartyPubkey, plaintext])
  }

  async nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string> {
    return await this.sendRequest('nip04_decrypt', [thirdPartyPubkey, ciphertext])
  }

  async nip44Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string> {
    return await this.sendRequest('nip44_encrypt', [thirdPartyPubkey, plaintext])
  }

  async nip44Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string> {
    return await this.sendRequest('nip44_decrypt', [thirdPartyPubkey, ciphertext])
  }
}

/**
 * Fetches info on available providers that announce themselves using NIP-89 events.
 * @returns A promise that resolves to an array of available bunker objects.
 */
export async function fetchBunkerProviders(pool: AbstractSimplePool, relays: string[]): Promise<BunkerProfile[]> {
  const events = await pool.querySync(relays, {
    kinds: [Handlerinformation],
    '#k': [NostrConnect.toString()],
  })

  events.sort((a, b) => b.created_at - a.created_at)

  // validate bunkers by checking their NIP-05 and pubkey
  // map to a more useful object
  const validatedBunkers = await Promise.all(
    events.map(async (event, i) => {
      try {
        const content = JSON.parse(event.content)

        // skip duplicates
        try {
          if (events.findIndex(ev => JSON.parse(ev.content).nip05 === content.nip05) !== i) return undefined
        } catch (err) {
          console.log(err)
          /***/
        }

        const bp = await queryBunkerProfile(content.nip05)
        if (bp && bp.pubkey === event.pubkey && bp.relays.length) {
          return {
            bunkerPointer: bp,
            nip05: content.nip05,
            domain: content.nip05.split('@')[1],
            name: content.name || content.display_name,
            picture: content.picture,
            about: content.about,
            website: content.website,
            local: false,
          }
        }
      } catch (err) {
        console.log(err)
        return undefined
      }
    }),
  )

  return validatedBunkers.filter(b => b !== undefined) as BunkerProfile[]
}

export type BunkerProfile = {
  bunkerPointer: BunkerPointer
  domain: string
  nip05: string
  name: string
  picture: string
  about: string
  website: string
  local: boolean
}
