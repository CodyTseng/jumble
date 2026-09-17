import { getEventAuthorPubkey } from '@/lib/event'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import { Event, kinds, nip19 } from 'nostr-tools'
import { normalizeNostrReferences } from './nostr-references'

export async function extractMentions(content: string, parentEvent?: Event) {
  content = normalizeNostrReferences(content)
  const parentEventPubkey = parentEvent ? getEventAuthorPubkey(parentEvent) : undefined
  const pubkeys: string[] = []
  const relatedPubkeys: string[] = []
  const matches = content.match(
    /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+|note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/gi
  )

  const addToSet = (arr: string[], pubkey: string) => {
    if (pubkey === parentEventPubkey) return
    if (!arr.includes(pubkey)) arr.push(pubkey)
  }

  for (const m of matches || []) {
    try {
      const id = m.split(':')[1]
      const { type, data } = nip19.decode(id)
      if (type === 'nprofile') {
        addToSet(pubkeys, data.pubkey)
      } else if (type === 'npub') {
        addToSet(pubkeys, data)
      } else if (type === 'naddr') {
        addToSet(pubkeys, data.pubkey)
      } else if (['nevent', 'note'].includes(type)) {
        const event = await client.fetchEvent(id)
        if (event) {
          if (event.kind === kinds.Zap && !(await lightning.validateZapReceipt(event))) continue
          addToSet(pubkeys, getEventAuthorPubkey(event))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (parentEvent) {
    parentEvent.tags.forEach(([tagName, tagValue]) => {
      if (['p', 'P'].includes(tagName) && !!tagValue) {
        addToSet(relatedPubkeys, tagValue)
      }
    })
  }

  return {
    pubkeys,
    relatedPubkeys: relatedPubkeys.filter((p) => !pubkeys.includes(p)),
    parentEventPubkey
  }
}
