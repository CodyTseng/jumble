import { EmbeddedMention, EmbeddedNote } from '@/components/Embedded'
import { nip19 } from 'nostr-tools'
import { ComponentProps, useMemo } from 'react'
import { Components } from './types'

export default function NostrNode({ rawText, bech32Id }: ComponentProps<Components['nostr']>) {
  const { type, id } = useMemo(() => {
    if (!bech32Id) return { type: 'invalid', id: '' }
    try {
      const { type } = nip19.decode(bech32Id)
      if (type === 'npub' || type === 'nprofile') {
        return { type: 'mention', id: bech32Id }
      }
      if (type === 'nevent' || type === 'naddr' || type === 'note') {
        return { type: 'note', id: bech32Id }
      }
    } catch (error) {
      console.error('Invalid bech32 ID:', bech32Id, error)
    }
    return { type: 'invalid', id: '' }
  }, [bech32Id])

  if (type === 'invalid') return rawText

  if (type === 'mention') {
    return <EmbeddedMention userId={id} className="not-prose" />
  }
  return <EmbeddedNote noteId={id} className="not-prose" />
}
