import NoteList from '@renderer/components/NoteList'
import PrimaryPageLayout from '@renderer/layouts/PrimaryPageLayout'

export default function NoteListPage() {
  return (
    <PrimaryPageLayout>
      <NoteList isHomeTimeline filter={{ limit: 200 }} />
    </PrimaryPageLayout>
  )
}
