import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientMock = vi.hoisted(() => ({
  pubkey: 'test-pubkey',
  signer: {
    signEvent: vi.fn()
  },
  fetchBlossomServerList: vi.fn()
}))

const blossomClientMock = vi.hoisted(() => ({
  createUploadAuth: vi.fn().mockResolvedValue({ id: 'auth-event' }),
  getFileSha256: vi.fn().mockResolvedValue('file-hash'),
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

vi.mock('blossom-client-sdk', () => ({
  BlossomClient: blossomClientMock
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
})
