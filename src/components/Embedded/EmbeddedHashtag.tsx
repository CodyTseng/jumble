import { toNoteList } from '@/lib/link'
import { SecondaryPageLink } from '@/PageManager'
import { TEmbeddedRenderer } from './types'

export function EmbeddedHashtag({ hashtag }: { hashtag: string }) {
  return (
    <SecondaryPageLink
      className="text-primary hover:underline"
      to={toNoteList({ hashtag })}
      onClick={(e) => e.stopPropagation()}
    >
      #{hashtag}
    </SecondaryPageLink>
  )
}

export const embeddedHashtagRenderer: TEmbeddedRenderer = {
  regex: /#([\p{L}\p{N}\p{M}_]+)/gu,
  render: (hashtag: string, index: number) => {
    return <EmbeddedHashtag key={`hashtag-${index}-${hashtag}`} hashtag={hashtag} />
  }
}
