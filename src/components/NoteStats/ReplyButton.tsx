import { getEventKey, isMentioningMutedUsers } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useReply } from '@/providers/ReplyProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { MessageCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function ReplyButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { pubkey, checkLogin } = useNostr()
  const { repliesMap } = useReply()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const { replyCount, hasReplied } = useMemo(() => {
    const key = getEventKey(event)
    const hasReplied = pubkey
      ? repliesMap.get(key)?.events.some((evt) => evt.pubkey === pubkey)
      : false

    let replyCount = 0
    const replies = [...(repliesMap.get(key)?.events || [])]
    while (replies.length > 0) {
      const reply = replies.pop()
      if (!reply) break

      const replyKey = getEventKey(reply)
      const nestedReplies = repliesMap.get(replyKey)?.events ?? []
      replies.push(...nestedReplies)

      if (hideUntrustedInteractions && !isUserTrusted(reply.pubkey)) {
        continue
      }
      if (mutePubkeySet.has(reply.pubkey)) {
        continue
      }
      if (hideContentMentioningMutedUsers && isMentioningMutedUsers(reply, mutePubkeySet)) {
        continue
      }
      replyCount++
    }

    return { replyCount, hasReplied }
  }, [repliesMap, event, hideUntrustedInteractions])
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className={cn(
          'flex gap-1 items-center enabled:hover:text-blue-400 pr-3 h-full',
          hasReplied ? 'text-blue-400' : 'text-muted-foreground'
        )}
        onClick={(e) => {
          e.stopPropagation()
          checkLogin(() => {
            setOpen(true)
          })
        }}
        title={t('Reply')}
      >
        <MessageCircle />
        {!!replyCount && <div className="text-sm">{formatCount(replyCount)}</div>}
      </button>
      <PostEditor parentEvent={event} open={open} setOpen={setOpen} />
    </>
  )
}
