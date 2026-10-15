import { signingRequest } from '@/lib/napplet/signing'
import { z } from 'zod'
import { sha256 } from '../../protocol/src/artifact'
import { downloadBytes, readBytes, resourceUrl } from '../../client/src/bytes'
import { signExact, type ActionConsent } from './action-session'
import type { HostSign } from './action-contracts'
import { isArrayBuffer, isBlob } from '@/lib/napplet/binary'

const MAX_BYTES = 10 * 1024 * 1024
const requestSchema = z
  .object({
    rail: z.literal('blossom').optional(),
    data: z.custom<Blob | ArrayBuffer>((v) => isBlob(v) || isArrayBuffer(v)),
    mimeType: z
      .string()
      .max(128)
      .regex(/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/)
      .optional(),
    filename: z.string().min(1).max(200).optional(),
    caption: z.string().max(2000).optional(),
    noTransform: z.boolean().optional(),
    metadata: z.record(z.string(), z.json()).optional()
  })
  .strict()
type UploadStatus = {
  ok: boolean
  uploadId: string
  status: 'uploading' | 'complete' | 'failed' | 'cancelled'
  rail: 'blossom'
  updatedAt: number
  bytesTotal: number
  bytesSent?: number
  url?: string
  fallbackUrls?: string[]
  sha256?: string
  originalSha256?: string
  size?: number
  mimeType?: string
  nip94?: string[][]
  error?: string
}
/** Direct browser-to-Blossom uploads, independent of creator publishing credentials. */
export class NappletUploads {
  private jobs = new Map<string, UploadStatus>()
  private total = 0
  private active = 0
  constructor(
    private options: {
      pubkey: string | null
      sign?: HostSign
      servers: string[]
      localServers?: string[]
      consent: ActionConsent
      signal: AbortSignal
      send: (message: Record<string, unknown>) => void
    }
  ) {}
  async handle(message: Record<string, unknown>) {
    if (message.type === 'upload.info')
      return {
        info: {
          rails: [
            {
              rail: 'blossom',
              enabled: !!this.options.servers.length,
              returns: ['https', 'blossom']
            }
          ],
          maxBytes: MAX_BYTES
        }
      }
    if (message.type === 'upload.status') {
      const status = this.jobs.get(z.string().max(128).parse(message.uploadId))
      if (!status) throw new Error('unknown upload')
      return { status: { ...status } }
    }
    if (!this.options.pubkey || !this.options.sign) throw new Error('not-signed-in')
    const input = requestSchema.parse(message.request)
    if (input.metadata && Object.keys(input.metadata).length)
      throw new Error('unsupported metadata')
    const server = this.options.servers[0]
    if (!server) throw new Error('no server configured')
    const parsed = resourceUrl(server, this.options.localServers)
    if (!['', '/'].includes(parsed.pathname) || parsed.search || parsed.hash)
      throw new Error('invalid server')
    const origin = parsed.origin
    const size = isBlob(input.data) ? input.data.size : input.data.byteLength
    if (!size || size > MAX_BYTES) throw new Error('file too large')
    if (this.active >= 2 || this.jobs.size >= 32 || this.total + size > 32 * 1024 * 1024)
      throw new Error('quota exceeded')
    this.options.signal.throwIfAborted()
    this.total += size
    this.active++
    // Copy mutable ArrayBuffers before acknowledging the request.
    const blob = isBlob(input.data)
      ? new Blob([input.data], { type: input.data.type })
      : new Blob([new Uint8Array(input.data)])
    const mime =
      input.mimeType ??
      (/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(blob.type)
        ? blob.type
        : 'application/octet-stream')
    const uploadId = crypto.randomUUID()
    const status: UploadStatus = {
      ok: true,
      uploadId,
      status: 'uploading',
      rail: 'blossom',
      updatedAt: Date.now(),
      bytesTotal: size
    }
    this.jobs.set(uploadId, status)
    // Prompt and transfer continue after the initial correlated response, within the account scope.
    setTimeout(() => {
      void this.transfer(status, blob, mime, origin, input).finally(() => this.active--)
    }, 0)
    return { result: { ...status } }
  }
  private update(status: UploadStatus, patch: Partial<UploadStatus>) {
    const state = patch.status ?? status.status
    Object.assign(status, patch, {
      ok: state !== 'failed' && state !== 'cancelled',
      updatedAt: Date.now()
    })
    if (!this.options.signal.aborted)
      this.options.send({ type: 'upload.status.changed', status: { ...status } })
  }
  private async transfer(
    status: UploadStatus,
    blob: Blob,
    mime: string,
    origin: string,
    input: z.infer<typeof requestSchema>
  ) {
    const signal = AbortSignal.any([this.options.signal, AbortSignal.timeout(300000)])
    try {
      signal.throwIfAborted()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const hash = await sha256(bytes),
        now = Math.floor(Date.now() / 1000)
      const template = {
        kind: 24242,
        tags: [
          ['t', 'upload'],
          ['expiration', String(now + 300)],
          ['server', new URL(origin).hostname],
          ['x', hash]
        ],
        content: `Upload blob ${hash} on ${new URL(origin).hostname}`,
        created_at: now - 1
      }
      const approved = await this.options.consent(
        `Upload ${input.filename ?? 'napplet file'} (${blob.size.toLocaleString()} bytes, ${mime}) publicly to ${origin}?\nSigned by ${this.options.pubkey}.\n${input.caption ?? ''}`,
        signal,
        {
          ...signingRequest(this.options.pubkey!, template, [origin], 'upload'),
          upload: { filename: input.filename ?? 'napplet file', bytes: blob.size, mime }
        }
      )
      signal.throwIfAborted()
      if (!approved) {
        this.update(status, { status: 'cancelled', error: 'user cancelled' })
        return
      }
      const event = await signExact(this.options.sign!, this.options.pubkey!, template, signal)
      signal.throwIfAborted()
      const authorization = 'Nostr ' + btoa(JSON.stringify(event))
      const response = await fetch(`${origin}/upload`, {
        method: 'PUT',
        body: bytes,
        signal,
        redirect: 'error',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Authorization: authorization, 'Content-Type': mime, 'X-SHA-256': hash }
      })
      const descriptor = JSON.parse(new TextDecoder().decode(await readBytes(response, 8192)))
      const url = resourceUrl(descriptor.url, this.options.localServers)
      if (
        descriptor.sha256 !== hash ||
        descriptor.size !== bytes.length ||
        url.origin !== origin ||
        !new RegExp(`^/${hash}(?:\\.[a-zA-Z0-9]+)?$`).test(url.pathname) ||
        url.search ||
        url.hash
      )
        throw new Error('inconsistent upload descriptor')
      this.update(status, { bytesSent: bytes.length })
      const stored = await downloadBytes(url.href, signal, MAX_BYTES, this.options.localServers)
      if (stored.length !== bytes.length || (await sha256(stored)) !== hash)
        throw new Error('upload verification failed')
      signal.throwIfAborted()
      const nip94 = [
        ['url', url.href],
        ['x', hash],
        ['ox', hash],
        ['m', mime],
        ['size', String(bytes.length)]
      ]
      if (input.caption) nip94.push(['alt', input.caption])
      this.update(status, {
        status: 'complete',
        url: url.href,
        fallbackUrls: [`blossom:sha256:${hash}`],
        sha256: hash,
        originalSha256: hash,
        size: bytes.length,
        mimeType: mime,
        nip94
      })
    } catch (error) {
      this.update(status, {
        status: this.options.signal.aborted ? 'cancelled' : 'failed',
        error: signal.aborted
          ? 'upload cancelled or timed out'
          : error instanceof Error
            ? error.message
            : 'upload failed'
      })
    }
  }
}
