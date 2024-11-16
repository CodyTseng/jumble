import NoteList from '@renderer/components/NoteList'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'
import NotFoundPage from '../NotFoundPage'

export default function HashtagPage({ id }: { id?: string }) {
  const { relayUrls } = useRelaySettings()
  if (!id) {
    return <NotFoundPage />
  }
  const hashtag = id.toLowerCase()

  return (
    <SecondaryPageLayout titlebarContent={`# ${hashtag}`}>
      <NoteList key={hashtag} filter={{ '#t': [hashtag] }} relayUrls={relayUrls} />
    </SecondaryPageLayout>
  )
}
