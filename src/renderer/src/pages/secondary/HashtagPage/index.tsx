import NoteList from '@renderer/components/NoteList'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { getParams } from '@renderer/lib/utils'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'

export default function HashtagPage(props) {
  const { hashtag } = getParams<{ hashtag: string }>(props)
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
