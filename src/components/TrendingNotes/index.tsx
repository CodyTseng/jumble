import { ALLOWED_FILTER_KINDS, TRENDING_NOTES_RELAY_URLS } from '@/constants'
import NoteList from '../NoteList'

export default function TrendingNotes() {
  return (
    <NoteList
      showKinds={ALLOWED_FILTER_KINDS}
      subRequests={[{ urls: TRENDING_NOTES_RELAY_URLS, filter: {} }]}
      showRelayCloseReason
    />
  )
}
