import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import { MessageCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function ReplyButton({
  event,
  variant = 'note'
}: {
  event: Event
  variant?: 'note' | 'reply'
}) {
  const { t } = useTranslation()
  const { checkLogin } = useNostr()
  const { noteStatsMap } = useNoteStats()
  const { replyCount } = useMemo(
    () => (variant === 'reply' ? {} : (noteStatsMap.get(event.id) ?? {})),
    [noteStatsMap, event.id, variant]
  )
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
        {variant !== 'reply' && !!replyCount && (
          <div className="text-sm">{formatCount(replyCount)}</div>
        )}
      </button>
      <PostEditor parentEvent={event} open={open} setOpen={setOpen} />
    </>
  )
}
