import { Event, nip19 } from 'nostr-tools'
import { getNoteBech32Id } from './event'

export const toHome = () => '/'
export const toNote = (eventOrId: Event | string) => {
  if (typeof eventOrId === 'string') return `/notes/${eventOrId}`
  const nevent = getNoteBech32Id(eventOrId)
  return `/notes/${nevent}`
}
export const toNoteList = ({
  hashtag,
  search,
  externalContentId,
  domain
}: {
  hashtag?: string
  search?: string
  externalContentId?: string
  domain?: string
}) => {
  const path = '/notes'
  const query = new URLSearchParams()
  if (hashtag) query.set('t', hashtag.toLowerCase())
  if (search) query.set('s', search)
  if (externalContentId) query.set('i', externalContentId)
  if (domain) query.set('d', domain)
  return `${path}?${query.toString()}`
}
export const toProfile = (userId: string) => {
  if (userId.startsWith('npub') || userId.startsWith('nprofile')) return `/users/${userId}`
  const npub = nip19.npubEncode(userId)
  return `/users/${npub}`
}
export const toProfileList = ({ search, domain }: { search?: string; domain?: string }) => {
  const path = '/users'
  const query = new URLSearchParams()
  if (search) query.set('s', search)
  if (domain) query.set('d', domain)
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
export const toSettings = () => '/settings'
export const toRelaySettings = (tag?: 'mailbox' | 'favorite-relays') => {
  return '/settings/relays' + (tag ? '#' + tag : '')
}
export const toWallet = () => '/settings/wallet'
export const toPostSettings = () => '/settings/posts'
export const toGeneralSettings = () => '/settings/general'
export const toTranslation = () => '/settings/translation'
export const toProfileEditor = () => '/profile-editor'
export const toRelay = (url: string) => `/relays/${encodeURIComponent(url)}`
export const toMuteList = () => '/mutes'

export const toChachiChat = (relay: string, d: string) => {
  return `https://chachi.chat/${relay.replace(/^wss?:\/\//, '').replace(/\/$/, '')}/${d}`
}
export const toNjump = (id: string) => `https://njump.me/${id}`
