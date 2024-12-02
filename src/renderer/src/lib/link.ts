export const toHome = () => '/'
export const toNote = (eventId: string) => `/note/${eventId}`
export const toNoteList = ({
  hashtag,
  search,
  relay
}: {
  hashtag?: string
  search?: string
  relay?: string
}) => {
  const path = '/note'
  const query = new URLSearchParams()
  if (hashtag) query.set('t', hashtag.toLowerCase())
  if (search) query.set('s', search)
  if (relay) query.set('relay', relay)
  return `${path}?${query.toString()}`
}
export const toProfile = (pubkey: string) => `/user/${pubkey}`
export const toProfileList = ({ search }: { search?: string }) => {
  const path = '/user'
  const query = new URLSearchParams()
  if (search) query.set('s', search)
  return `${path}?${query.toString()}`
}
export const toFollowingList = (pubkey: string) => `/user/${pubkey}/following`
export const toRelaySettings = () => '/relay-settings'

export const toNoStrudelProfile = (id: string) => `https://nostrudel.ninja/#/u/${id}`
export const toNoStrudelNote = (id: string) => `https://nostrudel.ninja/#/n/${id}`
export const toNoStrudelArticle = (id: string) => `https://nostrudel.ninja/#/articles/${id}`
export const toNoStrudelStream = (id: string) => `https://nostrudel.ninja/#/streams/${id}`
