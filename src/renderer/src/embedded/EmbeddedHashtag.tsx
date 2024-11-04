import { EmbeddedHashtag } from '../components/Embedded'
import { TEmbeddedRenderer } from './types'

export const embeddedHashtagRenderer: TEmbeddedRenderer = {
  regex: /#([^\s#]+)/g,
  render: (hashtag: string, index: number) => {
    return <EmbeddedHashtag key={`hashtag-${index}-${hashtag}`} hashtag={hashtag} />
  }
}
