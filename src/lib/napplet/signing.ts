import type { EventTemplate } from 'nostr-tools'

export const SIGNING_APPROVAL_TIMEOUT_MS = 30_000
export const SIGNING_REQUEST_TIMEOUT_MS = 60_000
export const SIGNING_SHIM_TIMEOUT_MS = SIGNING_REQUEST_TIMEOUT_MS + 5_000

export type NappletSigningRequest = {
  accountPubkey: string
  event: EventTemplate
  destinations: string[]
  operation: 'publish' | 'upload'
  upload?: { filename: string; bytes: number; mime: string }
}

/** Approval data is a snapshot of the event and destinations the host will use. */
export function signingRequest(
  accountPubkey: string,
  event: EventTemplate,
  destinations: string[],
  operation: NappletSigningRequest['operation'] = 'publish'
): NappletSigningRequest {
  return {
    accountPubkey,
    event: structuredClone({
      kind: event.kind,
      content: event.content,
      tags: event.tags,
      created_at: event.created_at
    }),
    destinations: [...new Set(destinations)],
    operation
  }
}

export function signingAction(request: NappletSigningRequest): string {
  if (request.operation === 'upload') return 'Authorize file upload'
  const actions: Record<number, string> = {
    0: 'Update profile',
    1: 'Publish note',
    3: 'Update follow list',
    5: 'Request deletion',
    6: 'Repost note',
    7: 'Publish reaction',
    1984: 'Publish report',
    30023: 'Publish article',
    30078: 'Publish app data'
  }
  return actions[request.event.kind] ?? 'Publish event'
}
