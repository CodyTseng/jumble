import NoteList from '@renderer/components/NoteList'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'

export default function HashtagPage({ hashtag }: { hashtag?: string }) {
  if (!hashtag) {
    return null
  }
  const normalizedHashtag = hashtag.toLowerCase()

  return (
    <SecondaryPageLayout titlebarContent={`# ${normalizedHashtag}`}>
      <NoteList key={normalizedHashtag} filter={{ '#t': [normalizedHashtag] }} />
    </SecondaryPageLayout>
  )
}
