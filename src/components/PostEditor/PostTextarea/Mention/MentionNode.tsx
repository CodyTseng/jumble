import TextWithEmojis from '@/components/TextWithEmojis'
import { getNip51FollowSetInfoFromEvent } from '@/lib/event-metadata'
import { formatUserId } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import client from '@/services/client.service'
import { TEmoji } from '@/types'
import { NodeViewRendererProps, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useState } from 'react'

export default function MentionNode(props: NodeViewRendererProps & { selected: boolean }) {
  const id = props.node.attrs.id as string
  const fallbackLabel = (props.node.attrs.label as string | undefined) ?? formatUserId(id)

  const [label, setLabel] = useState<string>(fallbackLabel)
  const [emojis, setEmojis] = useState<TEmoji[]>([])
  const isList = typeof id === 'string' && id.startsWith('naddr')

  useEffect(() => {
    let cancelled = false
    setLabel(fallbackLabel)
    setEmojis([])

    const run = async () => {
      if (!id) return
      try {
        if (isList) {
          const event = await client.fetchEvent(id)
          if (!event) return
          const info = getNip51FollowSetInfoFromEvent(event)
          if (!cancelled) {
            setLabel(info.title)
          }
          return
        }

        const profile = await client.fetchProfile(id)
        if (profile && !cancelled) {
          setLabel(profile.username)
          setEmojis(profile.emojis ?? [])
        }
      } catch {
        // ignore and keep fallback
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [id, fallbackLabel, isList])

  return (
    <NodeViewWrapper
      className={cn('inline text-primary', props.selected ? 'rounded-sm bg-primary/20' : '')}
    >
      {'@'}
      <TextWithEmojis text={label} emojis={emojis} emojiClassName="mb-1" />
    </NodeViewWrapper>
  )
}
