import TextWithEmojis from '@/components/TextWithEmojis'
import { useFetchProfile } from '@/hooks'
import { formatUserId } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import client from '@/services/client.service'
import { TPeopleList } from '@/types'
import { NodeViewRendererProps, NodeViewWrapper } from '@tiptap/react'
import { List } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function MentionNode(props: NodeViewRendererProps & { selected: boolean }) {
  const id = props.node.attrs.id

  if (typeof id === 'string' && id.startsWith('naddr1')) {
    return <PeopleListMentionNode id={id} selected={props.selected} />
  }

  return <ProfileMentionNode id={id} selected={props.selected} />
}

function ProfileMentionNode({ id, selected }: { id: string; selected: boolean }) {
  const { profile } = useFetchProfile(id)

  return (
    <NodeViewWrapper className={cn('inline text-primary', selected && 'rounded-sm bg-primary/20')}>
      {'@'}
      {profile ? (
        <TextWithEmojis text={profile.username} emojis={profile.emojis} emojiClassName="mb-1" />
      ) : (
        formatUserId(id)
      )}
    </NodeViewWrapper>
  )
}

function PeopleListMentionNode({ id, selected }: { id: string; selected: boolean }) {
  const [list, setList] = useState<TPeopleList | null>(null)

  useEffect(() => {
    let ignore = false
    client
      .fetchPeopleList(id)
      .then((list) => {
        if (!ignore) setList(list)
      })
      .catch(() => {
        if (!ignore) setList(null)
      })
    return () => {
      ignore = true
    }
  }, [id])

  return (
    <NodeViewWrapper className={cn('inline text-primary', selected && 'rounded-sm bg-primary/20')}>
      <List className="mb-1 inline size-3" />@{list?.title ?? 'People list'}
    </NodeViewWrapper>
  )
}
