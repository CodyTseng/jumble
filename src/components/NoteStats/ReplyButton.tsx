import { cn } from '@/lib/utils'
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
  const { replyCount, hasReplied } = useMemo(() => {
    const hasReplied = pubkey
      ? repliesMap.get(event.id)?.events.some((evt) => evt.pubkey === pubkey)
      : false
    if (hideUntrustedInteractions) {
      return {
        replyCount:
          repliesMap.get(event.id)?.events.filter((evt) => isUserTrusted(evt.pubkey)).length ?? 0,
        hasReplied
      }
    }
    return { replyCount: repliesMap.get(event.id)?.events.length ?? 0, hasReplied }
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
