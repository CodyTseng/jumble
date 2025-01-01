import { Event, nip19 } from 'nostr-tools'

export const toHome = () => '/'
export const toNote = (eventOrId: Event | string) => {
  if (typeof eventOrId === 'string') return `/notes/${eventOrId}`
  const nevent = nip19.neventEncode({ id: eventOrId.id, author: eventOrId.pubkey })
  return `/notes/${nevent}`
}
export const toNoteList = ({
  hashtag,
  search,
  relay
}: {
  hashtag?: string
  search?: string
  relay?: string
}) => {
  const path = '/notes'
  const query = new URLSearchParams()
  if (hashtag) query.set('t', hashtag.toLowerCase())
  if (search) query.set('s', search)
  if (relay) query.set('relay', relay)
  return `${path}?${query.toString()}`
}
export const toProfile = (pubkeyOrNpub: string) => {
  if (pubkeyOrNpub.startsWith('npub')) return `/users/${pubkeyOrNpub}`
  const npub = nip19.npubEncode(pubkeyOrNpub)
  return `/users/${npub}`
}
export const toProfileList = ({ search }: { search?: string }) => {
  const path = '/users'
  const query = new URLSearchParams()
  if (search) query.set('s', search)
  return `${path}?${query.toString()}`
}
export const toFollowingList = (pubkey: string) => {
  const npub = nip19.npubEncode(pubkey)
  return `/users/${npub}/following`
}
export const toRelaySettings = () => '/relay-settings'
export const toSettings = () => '/settings'

export const toNoStrudelProfile = (id: string) => `https://nostrudel.ninja/#/u/${id}`
export const toNoStrudelNote = (id: string) => `https://nostrudel.ninja/#/n/${id}`
export const toNoStrudelArticle = (id: string) => `https://nostrudel.ninja/#/articles/${id}`
export const toNoStrudelStream = (id: string) => `https://nostrudel.ninja/#/streams/${id}`
