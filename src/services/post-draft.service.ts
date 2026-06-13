import { deleteDraftEventCache } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { minePow } from '@/lib/event'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import threadService from '@/services/thread.service'
import { ISigner, TDraftEvent, TPublishOptions } from '@/types'
import {
  TPostDraft,
  TPostDraftSigned,
  TPostDraftStatus,
  TPostDraftUnsigned
} from '@/types/post-draft'
import type { Event as NostrEvent, VerifiedEvent } from 'nostr-tools'
import { useEffect, useState } from 'react'

export type TSignedDraftInput = Omit<
  TPostDraftSigned,
  'status' | 'error' | 'failedAt' | 'updatedAt'
>

/**
 * Everything needed to take an unsigned, already-persisted draft through the
 * relay-lookup → sign → pending → publish pipeline. The signer is built by the
 * renderer (it may require NIP-07/bunker interaction) and handed in.
 */
export type TSendInput = {
  id: string
  pubkey: string
  createdAt: number
  signer: ISigner
  draftEvent: TDraftEvent
  minPow?: number
  publishOptions?: TPublishOptions
  parentEvent?: NostrEvent
  parentEventCoordinate?: string
  highlightedText?: string
}

class PostDraftService extends EventTarget {
  static instance: PostDraftService

  private map = new Map<string, TPostDraft>()
  private inflight = new Set<string>()
  private initialized = false
  private initPromise: Promise<void> | null = null

  static getInstance(): PostDraftService {
    if (!PostDraftService.instance) {
      PostDraftService.instance = new PostDraftService()
    }
    return PostDraftService.instance
  }

  async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise
    this.initPromise = (async () => {
      try {
        const all = await indexedDb.getAllPostDrafts()
        for (const draft of all) {
          this.map.set(draft.id, draft)
        }
        this.initialized = true
        this.emitChange()
      } catch (err) {
        console.error('postDraftService.init failed', err)
      }
    })()
    return this.initPromise
  }

  /**
   * Resume publishes interrupted by a previous shutdown, scoped to one account.
   * Called once the account (and its signer, needed for relay AUTH) is ready —
   * NOT at module init, where there is no signer and a foreign account's pending
   * would be broadcast/failed with the wrong identity. Reusing the stored signed
   * event (same id) means relays dedupe, so re-sending is safe.
   */
  resumePending(pubkey: string): void {
    for (const d of this.map.values()) {
      if (d.pubkey === pubkey && d.status === 'pending' && !this.inflight.has(d.id)) {
        void this.startPublish(d as TPostDraftSigned, { silent: true }).catch(() => {})
      }
    }
  }

  list(pubkey: string, status?: TPostDraftStatus): TPostDraft[] {
    const items: TPostDraft[] = []
    for (const d of this.map.values()) {
      if (d.pubkey !== pubkey) continue
      if (status && d.status !== status) continue
      items.push(d)
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt)
    return items
  }

  get(id: string): TPostDraft | undefined {
    return this.map.get(id)
  }

  /**
   * Find an existing unsigned draft that replies to the given parent, so opening
   * a reply composer can resume it instead of starting blank.
   */
  findDraftForParent(
    pubkey: string,
    parentStuff: NostrEvent | string
  ): TPostDraftUnsigned | undefined {
    const parentId = typeof parentStuff === 'string' ? undefined : parentStuff.id
    const parentCoordinate = typeof parentStuff === 'string' ? parentStuff : undefined
    for (const d of this.map.values()) {
      if (d.pubkey !== pubkey || d.status !== 'draft') continue
      const u = d as TPostDraftUnsigned
      // A highlight draft isn't a plain reply — don't resume it as one.
      if (u.highlightedText) continue
      if (parentId && u.parentEvent?.id === parentId) return u
      if (parentCoordinate && u.parentEventCoordinate === parentCoordinate) return u
    }
    return undefined
  }

  countByStatus(pubkey: string): Record<TPostDraftStatus, number> {
    const counts: Record<TPostDraftStatus, number> = { draft: 0, pending: 0, failed: 0 }
    for (const d of this.map.values()) {
      if (d.pubkey !== pubkey) continue
      counts[d.status]++
    }
    return counts
  }

  async saveDraft(
    input: Omit<TPostDraftUnsigned, 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<TPostDraftUnsigned> {
    const now = Date.now()
    const existing = this.map.get(input.id) as TPostDraftUnsigned | undefined
    const record: TPostDraftUnsigned = {
      ...input,
      status: 'draft',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    await indexedDb.putPostDraft(record)
    this.map.set(record.id, record)
    this.emitChange()
    return record
  }

  /**
   * Send an already-persisted draft: resolve its relays, sign it, move it into
   * the immutable `pending` outbox, then broadcast — all in the background. The
   * "Sending..." toast is surfaced immediately (via `publish-start`) and tracks
   * the whole chain, so a failure in relay lookup or signing reports too. The
   * caller persists the draft first (`saveDraft`) and closes the editor right
   * after calling this; nothing here needs to be awaited.
   *
   * Relays are resolved BEFORE signing on purpose: signing is the last fallible
   * step before the event becomes immutable, so the moment we have a signature
   * we persist it as `pending` and never lose it (the signed-event-immutable
   * rule). If signing/relay lookup fails, the record stays an editable `draft`.
   */
  async send(input: TSendInput): Promise<void> {
    const promise = this.runSend(input)
    // Surface the "Sending..." toast right away, covering relay lookup + signing
    // + publish. Swallow the rejection on the returned handle so the fire-and-
    // forget caller can't trigger an unhandled rejection; the toast owns the UI.
    this.dispatchEvent(new CustomEvent('publish-start', { detail: { id: input.id, promise } }))
    return promise.catch(() => {})
  }

  private async runSend(input: TSendInput): Promise<void> {
    const {
      id,
      pubkey,
      createdAt,
      signer,
      draftEvent,
      minPow,
      publishOptions,
      parentEvent,
      parentEventCoordinate,
      highlightedText
    } = input

    // Resolve the concrete relay set first (needs the user's relay context but
    // not a signature), so once signing succeeds we go straight to pending.
    const targetRelays = await client.determineTargetRelays(
      { ...draftEvent, pubkey } as NostrEvent,
      publishOptions
    )

    let signed: VerifiedEvent
    if (minPow && minPow > 0) {
      const mined = await minePow({ ...draftEvent, pubkey }, minPow)
      signed = await signer.signEvent(mined)
    } else {
      signed = await signer.signEvent(draftEvent)
    }
    deleteDraftEventCache(draftEvent)

    // Signed → persist as immutable pending, then broadcast.
    const pending = await this.persistPending({
      id,
      pubkey,
      createdAt,
      signedEvent: signed,
      targetRelays,
      parentEvent,
      parentEventCoordinate,
      highlightedText
    })
    await this.publishPending(pending)
  }

  async retry(id: string): Promise<void> {
    const existing = this.map.get(id)
    if (!existing || existing.status !== 'failed') return
    if (this.inflight.has(id)) return
    const pending = await this.persistPending(existing as TPostDraftSigned)
    this.startPublish(pending)
  }

  private async persistPending(input: TSignedDraftInput): Promise<TPostDraftSigned> {
    const now = Date.now()
    const existing = this.map.get(input.id)
    const pending: TPostDraftSigned = {
      ...input,
      status: 'pending',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      error: undefined,
      failedAt: undefined
    }
    await indexedDb.putPostDraft(pending)
    this.map.set(pending.id, pending)
    this.emitChange()
    return pending
  }

  /**
   * Broadcast a pending record and settle its outbox state: on success delete
   * it and surface the note in open threads; on failure mark it `failed`. The
   * failure is rethrown so a caller tracking the promise (the "Sending..."
   * toast) reports it. No-op if the same id is already being published.
   */
  private async publishPending(pending: TPostDraftSigned): Promise<void> {
    // Don't double-publish the same id (e.g. a foreground send racing a
    // resume), and never hand an empty relay set to publishEvent — its success
    // threshold loop would never settle, wedging the record in `inflight`.
    if (this.inflight.has(pending.id)) return
    if (!pending.targetRelays.length) {
      await this.markFailed(pending, 'No relays to publish to')
      throw new Error('No relays to publish to')
    }
    this.inflight.add(pending.id)
    try {
      await client.publishEvent(pending.targetRelays, pending.signedEvent)
      await indexedDb.deletePostDraft(pending.id)
      this.map.delete(pending.id)
      this.emitChange()
      // Optimistically surface the published note in any open thread, matching
      // the pre-drafts-box behavior where post() inserted the reply directly.
      threadService.addRepliesToThread([pending.signedEvent])
    } catch (err) {
      await this.markFailed(pending, formatError(err).join('; '))
      throw err
    } finally {
      this.inflight.delete(pending.id)
    }
  }

  /**
   * Fire-and-forget publish used by retry and resume. The foreground send path
   * uses runSend → publishPending directly so its toast spans the full chain
   * (relay lookup + signing + publish). Swallows the rejection so a background
   * failure isn't an unhandled rejection — publishPending already marked it
   * `failed`.
   */
  private async startPublish(pending: TPostDraftSigned, { silent = false } = {}): Promise<void> {
    const promise = this.publishPending(pending)
    if (!silent) {
      this.dispatchEvent(new CustomEvent('publish-start', { detail: { id: pending.id, promise } }))
    }
    return promise.catch(() => {})
  }

  private async markFailed(pending: TPostDraftSigned, error: string): Promise<void> {
    const now = Date.now()
    const failed: TPostDraftSigned = {
      ...pending,
      status: 'failed',
      error,
      failedAt: now,
      updatedAt: now
    }
    await indexedDb.putPostDraft(failed)
    this.map.set(failed.id, failed)
    this.emitChange()
  }

  async delete(id: string): Promise<void> {
    if (this.inflight.has(id)) return
    await indexedDb.deletePostDraft(id)
    this.map.delete(id)
    this.emitChange()
  }

  private emitChange() {
    this.dispatchEvent(new Event('change'))
  }
}

const instance = PostDraftService.getInstance()
export default instance

export function useDrafts(pubkey: string | undefined): TPostDraft[] {
  const [drafts, setDrafts] = useState<TPostDraft[]>(() => (pubkey ? instance.list(pubkey) : []))
  useEffect(() => {
    if (!pubkey) {
      setDrafts([])
      return
    }
    const update = () => setDrafts(instance.list(pubkey))
    update()
    instance.addEventListener('change', update)
    return () => instance.removeEventListener('change', update)
  }, [pubkey])
  return drafts
}

export function useDraftCounts(pubkey: string | undefined): Record<TPostDraftStatus, number> {
  const [counts, setCounts] = useState<Record<TPostDraftStatus, number>>(() =>
    pubkey ? instance.countByStatus(pubkey) : { draft: 0, pending: 0, failed: 0 }
  )
  useEffect(() => {
    if (!pubkey) {
      setCounts({ draft: 0, pending: 0, failed: 0 })
      return
    }
    const update = () => setCounts(instance.countByStatus(pubkey))
    update()
    instance.addEventListener('change', update)
    return () => instance.removeEventListener('change', update)
  }, [pubkey])
  return counts
}
