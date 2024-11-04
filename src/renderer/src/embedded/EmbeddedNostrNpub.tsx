import { EmbeddedMention } from '../components/Embedded'
import { TEmbeddedRenderer } from './types'

export const embeddedNostrNpubRenderer: TEmbeddedRenderer = {
  regex: /(nostr:npub1[a-z0-9]{58})/g,
  render: (id: string, index: number) => {
    const npub1 = id.split(':')[1]
    return <EmbeddedMention key={`embedded-nostr-npub-${index}-${npub1}`} userId={npub1} />
  }
}
