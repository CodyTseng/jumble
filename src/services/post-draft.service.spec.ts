import { minePow } from '@/lib/event'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import { ISigner } from '@/types'
import type { VerifiedEvent } from 'nostr-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import postDraftService, { TSendInput } from './post-draft.service'

vi.mock('@/lib/draft-event', () => ({ deleteDraftEventCache: vi.fn() }))
vi.mock('@/lib/event', () => ({ minePow: vi.fn() }))
vi.mock('@/services/client.service', () => ({
  default: { determineTargetRelays: vi.fn(), publishEvent: vi.fn() }
}))
vi.mock('@/services/indexed-db.service', () => ({
  default: { putPostDraft: vi.fn(), deletePostDraft: vi.fn() }
}))
vi.mock('@/services/thread.service', () => ({
  default: { addRepliesToThread: vi.fn() }
}))

const signed = {
  id: 'event-id',
  pubkey: 'author',
  sig: 'signature',
  kind: 1,
  created_at: 1,
  content: 'Hello',
  tags: []
} as unknown as VerifiedEvent

function input(id: string, minPow: number): TSendInput {
  return {
    id,
    pubkey: signed.pubkey,
    createdAt: 1,
    draftEvent: { kind: 1, created_at: 1, content: 'Hello', tags: [] },
    minPow,
    signer: { signEvent: vi.fn().mockResolvedValue(signed) } as unknown as ISigner
  }
}

describe('post PoW progress', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(client.determineTargetRelays).mockResolvedValue(['wss://relay.example'])
    vi.mocked(client.publishEvent).mockResolvedValue(undefined)
  })

  it('shows the difficulty while mining and clears it before signing and publishing', async () => {
    const first = input('mining', 20)
    let finishMining!: (event: Awaited<ReturnType<typeof minePow>>) => void
    vi.mocked(minePow).mockReturnValue(
      new Promise((resolve) => {
        finishMining = resolve
      })
    )
    const send = postDraftService.send(first)
    await vi.waitFor(() => expect(postDraftService.getMiningDifficulty(first.id)).toBe(20))
    expect(first.signer.signEvent).not.toHaveBeenCalled()
    expect(client.publishEvent).not.toHaveBeenCalled()

    // A separate post must not inherit this post's mining status.
    await postDraftService.send(input('without-pow', 0))
    expect(postDraftService.getMiningDifficulty(first.id)).toBe(20)
    expect(postDraftService.getMiningDifficulty('without-pow')).toBeUndefined()

    vi.mocked(first.signer.signEvent).mockImplementation(async () => {
      expect(postDraftService.getMiningDifficulty(first.id)).toBeUndefined()
      return signed
    })
    finishMining(signed)
    await send
    expect(first.signer.signEvent).toHaveBeenCalledWith(signed)
    expect(client.publishEvent).toHaveBeenCalledTimes(2)
  })

  it('clears mining status and rejects the toast promise when mining fails', async () => {
    const draft = input('failed-mining', 24)
    vi.mocked(minePow).mockRejectedValue(new Error('Mining failed'))
    let toastPromise: Promise<unknown> | undefined
    const onStart = (event: Event) => {
      toastPromise = (event as CustomEvent).detail.promise
      void toastPromise?.catch(() => {})
    }
    postDraftService.addEventListener('publish-start', onStart)
    try {
      await postDraftService.send(draft)
      await expect(toastPromise).rejects.toThrow('Mining failed')
      expect(postDraftService.getMiningDifficulty(draft.id)).toBeUndefined()
      expect(draft.signer.signEvent).not.toHaveBeenCalled()
      expect(client.publishEvent).not.toHaveBeenCalled()
    } finally {
      postDraftService.removeEventListener('publish-start', onStart)
    }
  })
})

describe('parallel post signing and relay lookup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(client.determineTargetRelays).mockResolvedValue(['wss://relay.example'])
    vi.mocked(client.publishEvent).mockResolvedValue(undefined)
  })

  it('requests signing while relay lookup is pending and waits for relays before publishing', async () => {
    const draft = input('slow-relays', 0)
    let finishLookup!: (relays: string[]) => void
    vi.mocked(client.determineTargetRelays).mockReturnValue(
      new Promise((resolve) => {
        finishLookup = resolve
      })
    )

    const send = postDraftService.send(draft)
    expect(draft.signer.signEvent).toHaveBeenCalledWith(draft.draftEvent)
    await Promise.resolve()
    expect(indexedDb.putPostDraft).not.toHaveBeenCalled()
    expect(client.publishEvent).not.toHaveBeenCalled()

    finishLookup(['wss://target.example'])
    await send
    expect(indexedDb.putPostDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        signedEvent: signed,
        targetRelays: ['wss://target.example']
      })
    )
    expect(client.publishEvent).toHaveBeenCalledWith(['wss://target.example'], signed)
  })

  it('looks up relays while signing is pending and waits for the signature before publishing', async () => {
    const draft = input('slow-signing', 0)
    let finishSigning!: (event: VerifiedEvent) => void
    vi.mocked(draft.signer.signEvent).mockReturnValue(
      new Promise((resolve) => {
        finishSigning = resolve
      })
    )

    const send = postDraftService.send(draft)
    expect(client.determineTargetRelays).toHaveBeenCalledWith(
      { ...draft.draftEvent, pubkey: draft.pubkey },
      draft.publishOptions
    )
    await Promise.resolve()
    expect(client.publishEvent).not.toHaveBeenCalled()

    finishSigning(signed)
    await send
    expect(client.publishEvent).toHaveBeenCalledWith(['wss://relay.example'], signed)
  })

  it('does not publish after signing is cancelled, even if relay lookup fails later', async () => {
    const draft = input('cancelled-signing', 0)
    let failLookup!: (error: Error) => void
    vi.mocked(client.determineTargetRelays).mockReturnValue(
      new Promise((_, reject) => {
        failLookup = reject
      })
    )
    vi.mocked(draft.signer.signEvent).mockRejectedValue(new Error('Signing cancelled'))
    let toastPromise: Promise<unknown> | undefined
    const onStart = (event: Event) => {
      toastPromise = (event as CustomEvent).detail.promise
      void toastPromise?.catch(() => {})
    }
    postDraftService.addEventListener('publish-start', onStart)
    try {
      await postDraftService.send(draft)
      await expect(toastPromise).rejects.toThrow('Signing cancelled')
      failLookup(new Error('Relay lookup failed'))
      await Promise.resolve()
      expect(indexedDb.putPostDraft).not.toHaveBeenCalled()
      expect(client.publishEvent).not.toHaveBeenCalled()
    } finally {
      postDraftService.removeEventListener('publish-start', onStart)
    }
  })
})
