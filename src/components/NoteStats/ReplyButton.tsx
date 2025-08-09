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
  const { checkLogin } = useNostr()
  const { repliesMap } = useReply()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const replyCount = useMemo(() => {
    if (hideUntrustedInteractions) {
      return repliesMap.get(event.id)?.events.filter((evt) => isUserTrusted(evt.pubkey)).length ?? 0
    }
    return repliesMap.get(event.id)?.events.length ?? 0
  }, [repliesMap, event.id, hideUntrustedInteractions])
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="flex gap-1 items-center text-muted-foreground enabled:hover:text-blue-400 pr-3 h-full"
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
