import TextWithEmojis from '@/components/TextWithEmojis'
import { useFetchProfile } from '@/hooks'
import { formatUserId } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { NodeViewRendererProps, NodeViewWrapper } from '@tiptap/react'

export default function MentionNode(props: NodeViewRendererProps & { selected: boolean }) {
  const id = props.node.attrs.id as string | undefined
  const label = props.node.attrs.label as string | undefined
  const isUserId = !!id && (id.startsWith('npub1') || id.startsWith('nprofile1') || /^[0-9a-f]{64}$/.test(id))
  const { profile } = useFetchProfile(isUserId ? id : undefined)

  return (
    <NodeViewWrapper
      className={cn('inline text-primary', props.selected ? 'rounded-sm bg-primary/20' : '')}
    >
      {'@'}
      {profile ? (
        <TextWithEmojis text={profile.username} emojis={profile.emojis} emojiClassName="mb-1" />
      ) : (
        label || (id ? formatUserId(id) : '')
      )}
    </NodeViewWrapper>
  )
}
