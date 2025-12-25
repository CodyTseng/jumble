import { useStuff } from '@/hooks/useStuff'
import { useAllDescendantThreads } from '@/hooks/useThread'
import { getEventKey, isMentioningMutedUsers } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { MessageCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function ReplyButton({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { pubkey, checkLogin } = useNostr()
  const { event, stuffKey } = useStuff(stuff)
  const allThreads = useAllDescendantThreads(stuffKey)
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const { replyCount, hasReplied } = useMemo(() => {
    const hasReplied = pubkey
      ? allThreads.get(stuffKey)?.some((evt) => evt.pubkey === pubkey)
      : false

    let replyCount = 0
    const replies = [...(allThreads.get(stuffKey) ?? [])]
    while (replies.length > 0) {
      const reply = replies.pop()
      if (!reply) break

      const replyKey = getEventKey(reply)
      const nestedReplies = allThreads.get(replyKey) ?? []
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
  }, [allThreads, event, stuffKey, hideUntrustedInteractions])
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
      <PostEditor parentStuff={stuff} open={open} setOpen={setOpen} />
    </>
  )
}
