import { toHashtag } from '@renderer/lib/url'
import { SecondaryPageLink } from '@renderer/PageManager'

export function EmbeddedHashtag({ hashtag }: { hashtag: string }) {
  return (
    <SecondaryPageLink
      className="text-highlight hover:underline"
      to={toHashtag(hashtag)}
      onClick={(e) => e.stopPropagation()}
    >
      #{hashtag}
    </SecondaryPageLink>
  )
}
