import { EmbeddedMention } from '../components/Embedded'
import { TEmbeddedRenderer } from './types'

export const embeddedNostrProfileRenderer: TEmbeddedRenderer = {
  regex: /(nostr:nprofile1[a-z0-9]+)/g,
  render: (id: string, index: number) => {
    const nprofile = id.split(':')[1]
    return <EmbeddedMention key={`embedded-nostr-profile-${index}-${nprofile}`} userId={nprofile} />
  }
}
