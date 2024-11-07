import NoteList from '@renderer/components/NoteList'
import PrimaryPageLayout from '@renderer/layouts/PrimaryPageLayout'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'

export default function NoteListPage() {
  const { relayUrls } = useRelaySettings()
  return (
    <PrimaryPageLayout>
      <NoteList relayUrls={relayUrls} />
    </PrimaryPageLayout>
  )
}
