import { toNoteList } from '@/lib/link'
import { SecondaryPageLink } from '@/PageManager'

export function EmbeddedHashtag({ hashtag }: { hashtag: string }) {
  return (
    <SecondaryPageLink
      className="text-primary hover:underline"
      to={toNoteList({ hashtag: hashtag.replace('#', '') })}
      onClick={(e) => e.stopPropagation()}
    >
      {hashtag}
    </SecondaryPageLink>
  )
}
