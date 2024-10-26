import { Event } from 'nostr-tools'
import { cn } from '@renderer/lib/utils'
import { useEffect, useState } from 'react'
import Comment from '../Comment'

export default function CommentList({ event, className }: { event: Event; className?: string }) {
  const [comments, setComments] = useState<Event[]>([])

  const init = async () => {
    const comments = await window.api.relay.fetchEvents([
      {
        '#e': [event.id],
        kinds: [1],
        limit: 1000
      }
    ])
    setComments(comments.reverse())
  }
  useEffect(() => {
    init()
  }, [])

  return (
    <div className={cn('space-y-4', className)}>
      {comments.map((comment) => {
        const parentCommentId = comment.tags.find(
          ([tagName, , , type]) => tagName === 'e' && type === 'reply'
        )?.[1]
        const parentComment = parentCommentId
          ? comments.find((c) => c.id === parentCommentId)
          : undefined
        return <Comment key={comment.id} comment={comment} parentComment={parentComment} />
      })}
    </div>
  )
}
