import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import Comment from '../Comment'

export default function CommentList({ event, className }: { event: Event; className?: string }) {
  const [comments, setComments] = useState<Event[]>([])

  const init = async () => {
    const comments = await client.fetchEvents([
      {
        '#e': [event.id],
        kinds: [1],
        limit: 1000
      }
    ])
    setComments(comments.sort((a, b) => a.created_at - b.created_at))
  }

  useEffect(() => {
    init()
  }, [])

  return (
    <div className={cn('space-y-6', className)}>
      {comments.map((comment, index) => {
        const parentCommentId = comment.tags.find(
          ([tagName, , , type]) => tagName === 'e' && type === 'reply'
        )?.[1]
        const parentComment = parentCommentId
          ? comments.find((c) => c.id === parentCommentId)
          : undefined
        return <Comment key={index} comment={comment} parentComment={parentComment} />
      })}
    </div>
  )
}
