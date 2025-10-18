import { Event, nip19 } from 'nostr-tools'
import { getNoteBech32Id } from './event'
import { TSearchParams } from '@/types'

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
  domain,
  kinds
}: {
  hashtag?: string
  search?: string
  externalContentId?: string
  domain?: string
  kinds?: number[]
}) => {
  const path = '/notes'
  const query = new URLSearchParams()
  if (hashtag) query.set('t', hashtag.toLowerCase())
  if (kinds?.length) {
    kinds.forEach((k) => query.append('k', k.toString()))
  }
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
export const toSearch = (params?: TSearchParams) => {
  if (!params) return '/search'
  const query = new URLSearchParams()
  query.set('t', params.type)
  query.set('q', params.search)
  if (params.input) {
    query.set('i', params.input)
  }
  return `/search?${query.toString()}`
}
export const toSettings = () => '/settings'
export const toRelaySettings = (tag?: 'mailbox' | 'favorite-relays') => {
  return '/settings/relays' + (tag ? '#' + tag : '')
}
export const toWallet = () => '/settings/wallet'
export const toPostSettings = () => '/settings/posts'
export const toGeneralSettings = () => '/settings/general'
export const toAppearanceSettings = () => '/settings/appearance'
export const toTranslation = () => '/settings/translation'
export const toProfileEditor = () => '/profile-editor'
export const toRelay = (url: string) => `/relays/${encodeURIComponent(url)}`
export const toRelayReviews = (url: string) => `/relays/${encodeURIComponent(url)}/reviews`
export const toMuteList = () => '/mutes'
export const toRizful = () => '/rizful'

export const toChachiChat = (relay: string, d: string) => {
  return `https://chachi.chat/${relay.replace(/^wss?:\/\//, '').replace(/\/$/, '')}/${d}`
}
export const toNjump = (id: string) => `https://njump.me/${id}`
