import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JUMBLE_BLOSSOM_SERVER } from '@/constants'

const clientMock = vi.hoisted(() => ({
  pubkey: 'test-pubkey',
  signer: {
    signEvent: vi.fn()
  },
  fetchBlossomServerList: vi.fn()
}))

const blossomClientMock = vi.hoisted(() => ({
  createUploadAuth: vi.fn().mockResolvedValue({ id: 'auth-event' }),
  getBlobSha256: vi.fn().mockResolvedValue('file-hash'),
  encodeAuthorizationHeader: vi.fn().mockReturnValue('Nostr auth'),
  mirrorBlob: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./client.service', () => ({ default: clientMock }))

vi.mock('./local-storage.service', () => ({
  default: {
    getMediaUploadServiceConfig: () => ({ type: 'blossom' })
  }
}))

vi.mock('@/lib/draft-event', () => ({
  createBlossomServerListDraftEvent: vi.fn()
}))

vi.mock('@/lib/strip-image-metadata', () => ({
  stripImageMetadata: (file: File) => Promise.resolve(file)
}))

const mediaMetaMock = vi.hoisted(() => ({
  getMediaMeta: vi.fn().mockResolvedValue({})
}))

vi.mock('@/lib/media-meta', () => mediaMetaMock)

vi.mock('blossom-client-sdk', () => ({
  createUploadAuth: blossomClientMock.createUploadAuth,
  getBlobSha256: blossomClientMock.getBlobSha256,
  encodeAuthorizationHeader: blossomClientMock.encodeAuthorizationHeader,
  Actions: { mirrorBlob: blossomClientMock.mirrorBlob }
}))

import mediaUpload, { UPLOAD_ABORTED_ERROR_MSG } from './media-upload.service'

const servers = [
  'https://first.example/',
  'https://second.example/',
  'https://third.example/'
]

describe('Blossom media uploads', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', globalThis)
    vi.clearAllMocks()
    clientMock.fetchBlossomServerList.mockResolvedValue(servers)
    mediaUpload.setServiceConfig({ type: 'blossom' })
  })

  it('tries servers in order until an upload succeeds', async () => {
    const blob = {
      url: 'https://second.example/file-hash',
      sha256: 'file-hash',
      size: 4,
      type: 'text/plain'
    }
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = input.toString()
      if (url === 'https://first.example/upload') {
        return new Response(null, { status: 500 })
      }
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 200 })
      }
      return Response.json(blob)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await mediaUpload.upload(new File(['test'], 'test.txt', { type: 'text/plain' }))

    expect(result.url).toBe(blob.url)
    expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual([
      'https://first.example/upload',
      'https://second.example/upload',
      'https://second.example/upload'
    ])
    expect(blossomClientMock.mirrorBlob).toHaveBeenCalledTimes(2)
    expect(blossomClientMock.mirrorBlob.mock.calls.map(([server]) => server)).toEqual([
      servers[0],
      servers[2]
    ])
  })

  it('reports failure only after trying every server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      mediaUpload.upload(new File(['test'], 'test.txt', { type: 'text/plain' }))
    ).rejects.toThrow('third.example (500): Server error')

    expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual(
      servers.map((server) => `${server}upload`)
    )
    expect(blossomClientMock.mirrorBlob).not.toHaveBeenCalled()
  })

  it('uses the requested fallback Blossom server after configured servers fail', async () => {
    const blob = {
      url: `${JUMBLE_BLOSSOM_SERVER}file-hash`,
      sha256: 'file-hash',
      size: 4,
      type: 'application/octet-stream'
    }
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = input.toString()
      if (url !== `${JUMBLE_BLOSSOM_SERVER}upload`) {
        return new Response(null, { status: 500 })
      }
      return init?.method === 'HEAD' ? new Response(null, { status: 200 }) : Response.json(blob)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await mediaUpload.upload(
      new File(['test'], 'encrypted.bin', { type: 'application/octet-stream' }),
      { fallbackBlossomServer: JUMBLE_BLOSSOM_SERVER }
    )

    expect(result.url).toBe(blob.url)
    expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual([
      ...servers.map((server) => `${server}upload`),
      `${JUMBLE_BLOSSOM_SERVER}upload`,
      `${JUMBLE_BLOSSOM_SERVER}upload`
    ])
  })

  it('does not retry a fallback Blossom server that was already attempted', async () => {
    clientMock.fetchBlossomServerList.mockResolvedValue([
      servers[0],
      JUMBLE_BLOSSOM_SERVER,
      servers[1]
    ])
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      mediaUpload.upload(new File(['test'], 'encrypted.bin'), {
        fallbackBlossomServer: JUMBLE_BLOSSOM_SERVER
      })
    ).rejects.toThrow('second.example (500): Server error')

    expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual([
      `${servers[0]}upload`,
      `${JUMBLE_BLOSSOM_SERVER}upload`,
      `${servers[1]}upload`
    ])
  })

  it('uses the fallback Blossom endpoint even when a NIP-96 service has the same origin', async () => {
    const nip96Service = JUMBLE_BLOSSOM_SERVER.replace(/\/$/, '')
    const blob = {
      url: `${JUMBLE_BLOSSOM_SERVER}file-hash`,
      sha256: 'file-hash',
      size: 4,
      type: 'application/octet-stream'
    }
    class FailedXMLHttpRequest {
      upload = { onprogress: null }
      status = 500
      statusText = ''
      response = { message: 'NIP-96 failed' }
      onerror: (() => void) | null = null
      onload: (() => void) | null = null

      open() {}
      setRequestHeader() {}
      abort() {}
      send() {
        this.onload?.()
      }
    }
    vi.stubGlobal('XMLHttpRequest', FailedXMLHttpRequest)
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (input.toString() === `${nip96Service}/.well-known/nostr/nip96.json`) {
        return Response.json({ api_url: `${nip96Service}/upload` })
      }
      return init?.method === 'HEAD' ? new Response(null, { status: 200 }) : Response.json(blob)
    })
    vi.stubGlobal('fetch', fetchMock)
    mediaUpload.setServiceConfig({ type: 'nip96', service: nip96Service })

    const result = await mediaUpload.upload(new File(['test'], 'encrypted.bin'), {
      fallbackBlossomServer: JUMBLE_BLOSSOM_SERVER
    })

    expect(result.url).toBe(blob.url)
    expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual([
      `${nip96Service}/.well-known/nostr/nip96.json`,
      `${JUMBLE_BLOSSOM_SERVER}upload`,
      `${JUMBLE_BLOSSOM_SERVER}upload`
    ])
  })

  it('stops trying servers when the upload is cancelled', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockImplementation(async () => {
      controller.abort()
      return new Response(null, { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      mediaUpload.upload(new File(['test'], 'test.txt', { type: 'text/plain' }), {
        signal: controller.signal
      })
    ).rejects.toThrow(UPLOAD_ABORTED_ERROR_MSG)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fills in missing imeta fields locally when the server returns no nip94 tags', async () => {
    const blob = {
      url: 'https://first.example/file-hash',
      sha256: 'file-hash',
      size: 4,
      type: 'image/png'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(blob))
    )
    mediaMetaMock.getMediaMeta.mockResolvedValue({ dim: '100x50', thumbHash: 'dGh1bWI' })

    const result = await mediaUpload.upload(new File(['test'], 'a.png', { type: 'image/png' }))

    expect(result.tags).toEqual([
      ['url', blob.url],
      ['m', 'image/png'],
      ['size', '4'],
      ['x', 'file-hash'],
      ['dim', '100x50'],
      ['thumbhash', 'dGh1bWI']
    ])
    expect(mediaUpload.getImetaTagByUrl(blob.url)).toEqual([
      'imeta',
      `url ${blob.url}`,
      'm image/png',
      'size 4',
      'x file-hash',
      'dim 100x50',
      'thumbhash dGh1bWI'
    ])
  })

  it('keeps server-provided imeta fields and only fills the gaps', async () => {
    const blob = {
      url: 'https://first.example/file-hash',
      sha256: 'file-hash',
      size: 4,
      type: 'image/png',
      nip94: [
        ['url', 'https://first.example/file-hash'],
        ['m', 'image/png'],
        ['dim', '1x1']
      ]
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(blob))
    )
    mediaMetaMock.getMediaMeta.mockResolvedValue({ dim: '100x50', thumbHash: 'dGh1bWI' })

    const result = await mediaUpload.upload(new File(['test'], 'a.png', { type: 'image/png' }))

    expect(result.tags).toEqual([
      ['url', 'https://first.example/file-hash'],
      ['m', 'image/png'],
      ['dim', '1x1'],
      ['size', '4'],
      ['x', 'file-hash'],
      ['thumbhash', 'dGh1bWI']
    ])
  })
})
