export const toHome = () => '/'
export const toProfile = (pubkey: string) => `/user/${pubkey}`
export const toNote = (eventId: string) => `/note/${eventId}`
export const toHashtag = (hashtag: string) => `/hashtag/${hashtag}`
export const toFollowingList = (pubkey: string) => `/user/${pubkey}/following`

export const toNoStrudelProfile = (id: string) => `https://nostrudel.ninja/#/u/${id}`
export const toNoStrudelNote = (id: string) => `https://nostrudel.ninja/#/n/${id}`
