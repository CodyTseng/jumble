import { Event } from 'nostr-tools'

export const toProfile = (pubkey: string) => ({ pageName: 'profile', props: { pubkey } })
export const toNoStrudelProfile = (id: string) => `https://nostrudel.ninja/#/u/${id}`
export const toNote = (event: Event) => ({ pageName: 'note', props: { event } })
export const toNoStrudelNote = (id: string) => `https://nostrudel.ninja/#/n/${id}`
export const toHashtag = (hashtag: string) => ({ pageName: 'hashtag', props: { hashtag } })
