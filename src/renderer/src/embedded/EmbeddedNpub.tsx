import { EmbeddedMention } from '../components/Embedded'
import { TEmbeddedRenderer } from './types'

export const embeddedNpubRenderer: TEmbeddedRenderer = {
  regex: /(npub1[a-z0-9]{58})/g,
  render: (npub1: string, index: number) => {
    return <EmbeddedMention key={`embedded-npub-${index}`} userId={npub1} />
  }
}
