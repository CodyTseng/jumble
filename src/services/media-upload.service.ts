import { RECOMMENDED_BLOSSOM_SERVERS } from '@/constants'
import { BoundedMap } from '@/lib/bounded-map'
import { createBlossomServerListDraftEvent } from '@/lib/draft-event'
import { stripImageMetadata } from '@/lib/strip-image-metadata'
import { simplifyUrl } from '@/lib/url'
import { TDraftEvent, TMediaUploadServiceConfig } from '@/types'
import { BlobDescriptor, BlossomClient, SignedEvent } from 'blossom-client-sdk'
import { z } from 'zod'
import client from './client.service'
import storage from './local-storage.service'

type UploadOptions = {
  onProgress?: (progressPercent: number) => void
  signal?: AbortSignal
}

export const UPLOAD_ABORTED_ERROR_MSG = 'Upload aborted'

// HEAD /upload statuses that mean the Blossom server doesn't implement the
// BUD-06 pre-flight check, rather than a rejection of this specific blob. For
// these we fall through to the actual PUT instead of failing fast.
const PREFLIGHT_UNSUPPORTED_STATUSES = new Set([404, 405, 501])

// Friendlier-than-generic messages for a few well-known upload-rejection
// statuses, used when the server gives no readable reason (e.g. a HEAD 413 whose
// X-Reason header isn't exposed cross-origin). This list is intentionally not
// exhaustive — any status not here falls back to a generic message by class (see
// buildBlossomUploadError).
const BLOSSOM_STATUS_FALLBACK: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthorized',
  402: 'Payment required',
  403: 'Forbidden',
  413: 'File is too large',
  415: 'Unsupported file type',
  429: 'Too many requests'
}

class MediaUploadService {
  static instance: MediaUploadService

  private serviceConfig: TMediaUploadServiceConfig = storage.getMediaUploadServiceConfig()
  private nip96ServiceUploadUrlMap = new BoundedMap<string, string | undefined>({ maxSize: 50 })
  private imetaTagMap = new BoundedMap<string, string[]>({ maxSize: 500 })
  private creatingBlossomServerList = false

  constructor() {
    if (!MediaUploadService.instance) {
      MediaUploadService.instance = this
    }
    return MediaUploadService.instance
  }

  setServiceConfig(config: TMediaUploadServiceConfig) {
    this.serviceConfig = config
  }

  async upload(file: File, options?: UploadOptions) {
    // Strip sensitive metadata (EXIF/GPS, ...) from the file before upload.
    const safeFile = await stripImageMetadata(file)

    let result: { url: string; tags: string[][] }
    if (this.serviceConfig.type === 'nip96') {
      result = await this.uploadByNip96(this.serviceConfig.service, safeFile, options)
    } else {
      result = await this.uploadByBlossom(safeFile, options)
    }

    if (result.tags.length > 0) {
      this.imetaTagMap.set(result.url, ['imeta', ...result.tags.map(([n, v]) => `${n} ${v}`)])
    }
    return result
  }

  private async uploadByBlossom(file: File, options?: UploadOptions) {
    const pubkey = client.pubkey
    const signer = async (draft: TDraftEvent) => {
      if (!client.signer) {
        throw new Error('You need to be logged in to upload media')
      }
      return client.signer.signEvent(draft)
    }
    if (!pubkey) {
      throw new Error('You need to be logged in to upload media')
    }

    if (options?.signal?.aborted) {
      throw new Error(UPLOAD_ABORTED_ERROR_MSG)
    }

    options?.onProgress?.(0)

    // Pseudo-progress: advance gradually until main upload completes
    let pseudoProgress = 1
    let pseudoTimer: number | undefined
    const startPseudoProgress = () => {
      if (pseudoTimer !== undefined) return
      pseudoTimer = window.setInterval(() => {
        // Cap pseudo progress to 90% until we get real completion
        pseudoProgress = Math.min(pseudoProgress + 3, 90)
        options?.onProgress?.(pseudoProgress)
        if (pseudoProgress >= 90) {
          stopPseudoProgress()
        }
      }, 300)
    }
    const stopPseudoProgress = () => {
      if (pseudoTimer !== undefined) {
        clearInterval(pseudoTimer)
        pseudoTimer = undefined
      }
    }
    startPseudoProgress()

    let servers = await client.fetchBlossomServerList(pubkey)
    if (servers.length === 0) {
      // The user has no Blossom server list yet. Use the default servers for this
      // upload right away, and asynchronously create a server list for the user in
      // the background so it's persisted for next time.
      servers = RECOMMENDED_BLOSSOM_SERVERS
      this.ensureBlossomServerList(pubkey)
    }
    const [mainServer, ...mirrorServers] = servers

    const auth = await BlossomClient.createUploadAuth(signer, file, {
      message: 'Uploading media file'
    })

    // first upload blob to main server
    let blob: BlobDescriptor
    try {
      blob = await this.uploadBlobToBlossomServer(mainServer, file, auth, options?.signal)
    } finally {
      // Always clear the pseudo-progress timer, even if the upload failed.
      stopPseudoProgress()
    }
    // Main upload finished
    options?.onProgress?.(80)

    if (mirrorServers.length > 0) {
      await Promise.allSettled(
        mirrorServers.map((server) => BlossomClient.mirrorBlob(server, blob, { auth }))
      )
    }

    let tags: string[][] = []
    const parseResult = z.array(z.array(z.string())).safeParse((blob as any).nip94 ?? [])
    if (parseResult.success) {
      tags = parseResult.data
    }

    options?.onProgress?.(100)
    return { url: blob.url, tags }
  }

  /**
   * Upload a blob to a single Blossom server.
   *
   * Reimplements blossom-client-sdk's `uploadBlob` for the main-server upload so
   * we can fix two issues with the SDK version:
   *  1. It only reads the `X-Reason` header for error messages, falling back to a
   *     generic "Something went wrong". We also read the response body.
   *  2. When the BUD-06 `HEAD /upload` pre-flight already rejects the blob (e.g.
   *     413 file too large) the SDK still PUTs the entire file before failing.
   *     We fail fast on a rejecting pre-flight instead.
   */
  private async uploadBlobToBlossomServer(
    server: string,
    file: File,
    auth: SignedEvent,
    signal?: AbortSignal
  ): Promise<BlobDescriptor> {
    const url = new URL('/upload', server)
    const sha256 = await BlossomClient.getFileSha256(file)
    const authHeader = BlossomClient.encodeAuthorizationHeader(auth)
    const baseHeaders: Record<string, string> = {
      Authorization: authHeader,
      'X-SHA-256': sha256
    }

    const request = async (init: RequestInit) => {
      try {
        return await fetch(url, { ...init, signal })
      } catch (err) {
        if (signal?.aborted || (err as Error)?.name === 'AbortError') {
          throw new Error(UPLOAD_ABORTED_ERROR_MSG)
        }
        throw new Error('Network error')
      }
    }

    // BUD-06 pre-flight: ask the server whether it would accept this blob before
    // sending the whole file. If it rejects here (e.g. 413 file too large), fail
    // fast instead of uploading the entire body only to be rejected afterwards.
    //
    // We can't gate this on the `X-Reason` header: it's a custom response header,
    // so cross-origin it's invisible unless the server lists it in
    // `Access-Control-Expose-Headers` — which many don't. The status code is
    // always readable though, so gate on that. A 404/405/501 just means the
    // server doesn't implement the pre-flight, so we fall through to the PUT.
    const checkHeaders: Record<string, string> = {
      ...baseHeaders,
      'X-Content-Length': String(file.size)
    }
    if (file.type) checkHeaders['X-Content-Type'] = file.type
    const checkRes = await request({ method: 'HEAD', headers: checkHeaders })
    if (!checkRes.ok && !PREFLIGHT_UNSUPPORTED_STATUSES.has(checkRes.status)) {
      throw this.buildBlossomUploadError(server, checkRes.status, checkRes.headers.get('x-reason'))
    }

    const uploadRes = await request({ method: 'PUT', body: file, headers: baseHeaders })
    if (!uploadRes.ok) {
      let reason = uploadRes.headers.get('x-reason')
      if (!reason) {
        const text = await uploadRes.text().catch(() => '')
        if (text) {
          try {
            const json = JSON.parse(text)
            reason = typeof json?.message === 'string' ? json.message : text
          } catch {
            reason = text
          }
        }
      }
      throw this.buildBlossomUploadError(server, uploadRes.status, reason)
    }

    return (await uploadRes.json()) as BlobDescriptor
  }

  private buildBlossomUploadError(server: string, status: number, reason?: string | null) {
    // Pick the most specific message available, in order:
    //   1. the server's own reason (`X-Reason` header — often unreadable
    //      cross-origin — or response body),
    //   2. a friendlier message for a few well-known codes (e.g. 413),
    //   3. a generic message by status class, so any other 4xx/5xx is still
    //      handled without enumerating every code.
    const detail =
      (reason ?? '').trim().slice(0, 300) ||
      BLOSSOM_STATUS_FALLBACK[status] ||
      (status >= 500 ? 'Server error' : status >= 400 ? 'Upload rejected' : '')
    const prefix = `${simplifyUrl(server)} (${status})`
    return new Error(detail ? `${prefix}: ${detail}` : prefix)
  }

  private async uploadByNip96(service: string, file: File, options?: UploadOptions) {
    if (options?.signal?.aborted) {
      throw new Error(UPLOAD_ABORTED_ERROR_MSG)
    }
    let uploadUrl = this.nip96ServiceUploadUrlMap.get(service)
    if (!uploadUrl) {
      const response = await fetch(`${service}/.well-known/nostr/nip96.json`)
      if (!response.ok) {
        throw new Error(
          `${simplifyUrl(service)} does not work, please try another service in your settings`
        )
      }
      const data = await response.json()
      uploadUrl = data?.api_url
      if (!uploadUrl) {
        throw new Error(
          `${simplifyUrl(service)} does not work, please try another service in your settings`
        )
      }
      this.nip96ServiceUploadUrlMap.set(service, uploadUrl)
    }

    if (options?.signal?.aborted) {
      throw new Error(UPLOAD_ABORTED_ERROR_MSG)
    }
    const formData = new FormData()
    formData.append('file', file)

    const auth = await client.signHttpAuth(uploadUrl, 'POST', 'Uploading media file')

    // Use XMLHttpRequest for upload progress support
    const result = await new Promise<{ url: string; tags: string[][] }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl as string)
      xhr.responseType = 'json'
      xhr.setRequestHeader('Authorization', auth)

      const handleAbort = () => {
        try {
          xhr.abort()
        } catch {
          // ignore
        }
        reject(new Error(UPLOAD_ABORTED_ERROR_MSG))
      }
      if (options?.signal) {
        if (options.signal.aborted) {
          return handleAbort()
        }
        options.signal.addEventListener('abort', handleAbort, { once: true })
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          options?.onProgress?.(percent)
        }
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = xhr.response
          try {
            const tags = z.array(z.array(z.string())).parse(data?.nip94_event?.tags ?? [])
            const url = tags.find(([tagName]: string[]) => tagName === 'url')?.[1]
            if (url) {
              resolve({ url, tags })
            } else {
              reject(new Error('No url found'))
            }
          } catch (e) {
            reject(e as Error)
          }
        } else {
          // NIP-96 servers report errors in the JSON body as
          // `{ status: "error", message: "..." }`. Surface that message,
          // otherwise the toast only shows a bare status code (statusText is
          // always empty over HTTP/2).
          const body = xhr.response
          const serverMessage =
            body && typeof body === 'object' && typeof body.message === 'string'
              ? body.message
              : ''
          const statusInfo = `${xhr.status}${xhr.statusText ? ' ' + xhr.statusText : ''}`
          reject(new Error(serverMessage ? `${statusInfo}: ${serverMessage}` : statusInfo))
        }
      }
      xhr.send(formData)
    })

    return result
  }

  getImetaTagByUrl(url: string) {
    return this.imetaTagMap.get(url)
  }

  /**
   * Register an imeta tag for a URL that wasn't uploaded through this service
   * (e.g. third-party GIFs from the KLIPY picker). The tag is consumed later
   * by draft-event's generateImetaTags() when the user publishes.
   */
  registerImetaTag(url: string, tag: string[]) {
    if (!url || tag.length === 0 || tag[0] !== 'imeta') return
    this.imetaTagMap.set(url, tag)
  }

  /**
   * Create a Blossom server list (kind 10063) for a user who doesn't have one yet,
   * using the default recommended servers. Runs in the background (fire-and-forget)
   * and never throws to the caller.
   */
  private async ensureBlossomServerList(pubkey: string) {
    if (this.creatingBlossomServerList) return
    this.creatingBlossomServerList = true
    try {
      // Re-check in case it was created in the meantime.
      const existing = await client.fetchBlossomServerList(pubkey)
      if (existing.length > 0) return
      if (!client.signer) return

      const event = await client.signer.signEvent(
        createBlossomServerListDraftEvent(RECOMMENDED_BLOSSOM_SERVERS)
      )
      const relays = await client.determineTargetRelays(event)
      await client.publishEvent(relays, event)
      await client.updateBlossomServerListEventCache(event)
    } catch (err) {
      console.error('Failed to create default Blossom server list', err)
    } finally {
      this.creatingBlossomServerList = false
    }
  }
}

const instance = new MediaUploadService()
export default instance
