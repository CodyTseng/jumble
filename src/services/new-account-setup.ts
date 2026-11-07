import { BIG_RELAY_URLS, ExtendedKind, JUMBLE_BLOSSOM_SERVER } from '@/constants'
import {
  createBlossomServerListDraftEvent,
  createFollowListDraftEvent,
  createMuteListDraftEvent,
  createRelayListDraftEvent
} from '@/lib/draft-event'
import { ISigner } from '@/types'
import { kinds } from 'nostr-tools'
import client from './client.service'
import indexedDb from './indexed-db.service'

/** Only call for a key newly created by Jumble, never for account imports or binding. */
export async function setupNewAccount(signer: Pick<ISigner, 'getPublicKey' | 'signEvent'>) {
  const pubkey = await signer.getPublicKey()
  const drafts = [
    createFollowListDraftEvent([]),
    createMuteListDraftEvent([]),
    createRelayListDraftEvent(BIG_RELAY_URLS.map((url) => ({ url, scope: 'both' }))),
    createBlossomServerListDraftEvent([JUMBLE_BLOSSOM_SERVER, 'https://blossom.band/'])
  ]

  // Wait for every attempt before activating the account. A failed list must
  // neither cancel the remaining attempts nor prevent the user from continuing.
  return Promise.allSettled(
    drafts.map(async (draft) => {
      const existing = await indexedDb.getReplaceableEvent(pubkey, draft.kind)
      const event = existing ?? (await signer.signEvent(draft))
      if (event.pubkey !== pubkey) throw new Error('New account signer identity changed')
      if (!existing) await client.publishEvent(BIG_RELAY_URLS, event)

      const latest = await indexedDb.putReplaceableEvent(event)
      if (latest.kind === kinds.Contacts) await client.updateFollowListCache(latest)
      else if (latest.kind === kinds.RelayList) await client.updateRelayListCache(latest)
      else if (latest.kind === ExtendedKind.BLOSSOM_SERVER_LIST)
        await client.updateBlossomServerListEventCache(latest)
      else if (latest.kind === kinds.Mutelist && !latest.tags.length && !latest.content)
        await indexedDb.putDecryptedContent(latest.id, '[]')
      return latest
    })
  )
}
