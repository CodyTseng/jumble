import { isMentioningMutedUsers } from '@/lib/event'
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
    const hasReplied = pubkey
      ? repliesMap.get(event.id)?.events.some((evt) => evt.pubkey === pubkey)
      : false

    return {
      replyCount:
        repliesMap.get(event.id)?.events.filter((evt) => {
          if (hideUntrustedInteractions && !isUserTrusted(evt.pubkey)) {
            return false
          }
          if (mutePubkeySet.has(evt.pubkey)) {
            return false
          }
          if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) {
            return false
          }
          return true
        }).length ?? 0,
      hasReplied
    }
  }, [repliesMap, event.id, hideUntrustedInteractions])
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
