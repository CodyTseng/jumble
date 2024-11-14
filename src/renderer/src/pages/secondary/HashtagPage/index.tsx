import NoteList from '@renderer/components/NoteList'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'

export default function HashtagPage({ id }: { id?: string }) {
  const { relayUrls } = useRelaySettings()
  if (!id) {
    return null
  }
  const hashtag = id.toLowerCase()

  return (
    <SecondaryPageLayout titlebarContent={`# ${hashtag}`}>
      <NoteList key={hashtag} filter={{ '#t': [hashtag] }} relayUrls={relayUrls} />
    </SecondaryPageLayout>
  )
}
