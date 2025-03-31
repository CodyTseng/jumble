import client from '@/services/client.service'
import { Event, nip19 } from 'nostr-tools'
import { getSharableEventId } from './event'

export const toHome = () => '/'
export const toNote = (eventOrId: Pick<Event, 'id' | 'pubkey'> | string) => {
  if (typeof eventOrId === 'string') return `/notes/${eventOrId}`
  const relay = client.getEventHint(eventOrId.id)
  const nevent = nip19.neventEncode({ id: eventOrId.id, author: eventOrId.pubkey, relays: [relay] })
  return `/notes/${nevent}`
}
export const toNoteList = ({ hashtag, search }: { hashtag?: string; search?: string }) => {
  const path = '/notes'
  const query = new URLSearchParams()
  if (hashtag) query.set('t', hashtag.toLowerCase())
  if (search) query.set('s', search)
  return `${path}?${query.toString()}`
}
export const toProfile = (userId: string) => {
  if (userId.startsWith('npub') || userId.startsWith('nprofile')) return `/users/${userId}`
  const npub = nip19.npubEncode(userId)
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
export const toOthersRelaySettings = (pubkey: string) => {
  const npub = nip19.npubEncode(pubkey)
  return `/users/${npub}/relays`
}
export const toRelaySettings = (tag?: 'mailbox' | 'favorite-relays') => {
  return '/relay-settings' + (tag ? '#' + tag : '')
}
export const toSettings = () => '/settings'
export const toWallet = () => '/wallet'
export const toProfileEditor = () => '/profile-editor'
export const toRelay = (url: string) => `/relays/${encodeURIComponent(url)}`
export const toMuteList = () => '/mutes'

export const toHablaLongFormArticle = (event: Event) => {
  return `https://habla.news/a/${getSharableEventId(event)}`
}
export const toZapStreamLiveEvent = (event: Event) => {
  return `https://zap.stream/${getSharableEventId(event)}`
}
export const toChachiChat = (relay: string, d: string) => `https://chachi.chat/${relay}/${d}`
