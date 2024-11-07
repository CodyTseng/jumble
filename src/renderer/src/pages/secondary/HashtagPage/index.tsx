import NoteList from '@renderer/components/NoteList'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'

export default function HashtagPage({ hashtag }: { hashtag?: string }) {
  const { relayUrls } = useRelaySettings()
  if (!hashtag) {
    return null
  }
  const normalizedHashtag = hashtag.toLowerCase()

  return (
    <SecondaryPageLayout titlebarContent={`# ${normalizedHashtag}`}>
      <NoteList
        key={normalizedHashtag}
        filter={{ '#t': [normalizedHashtag] }}
        relayUrls={relayUrls}
      />
    </SecondaryPageLayout>
  )
}
