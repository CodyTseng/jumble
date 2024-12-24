import Username from '../Username'
import { TEmbeddedRenderer } from './types'

export function EmbeddedMention({ userId }: { userId: string }) {
  return <Username userId={userId} showAt className="text-highlight font-normal inline-block" />
}

export const embeddedNostrNpubRenderer: TEmbeddedRenderer = {
  regex: /(nostr:npub1[a-z0-9]{58})/g,
  render: (id: string, index: number) => {
    const npub1 = id.split(':')[1]
    return <EmbeddedMention key={`embedded-nostr-npub-${index}-${npub1}`} userId={npub1} />
  }
}

export const embeddedNostrProfileRenderer: TEmbeddedRenderer = {
  regex: /(nostr:nprofile1[a-z0-9]+)/g,
  render: (id: string, index: number) => {
    const nprofile = id.split(':')[1]
    return <EmbeddedMention key={`embedded-nostr-profile-${index}-${nprofile}`} userId={nprofile} />
  }
}

export const embeddedNpubRenderer: TEmbeddedRenderer = {
  regex: /(npub1[a-z0-9]{58})/g,
  render: (npub1: string, index: number) => {
    return <EmbeddedMention key={`embedded-npub-${index}-${npub1}`} userId={npub1} />
  }
}