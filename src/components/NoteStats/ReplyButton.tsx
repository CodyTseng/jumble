import { useNoteStats } from '@/providers/NoteStatsProvider'
import { MessageCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function ReplyButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { noteStatsMap } = useNoteStats()
  const { replyCount } = useMemo(() => noteStatsMap.get(event.id) ?? {}, [noteStatsMap, event.id])
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="flex gap-1 items-center text-muted-foreground enabled:hover:text-blue-400"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title={t('Reply')}
      >
        <MessageCircle size={16} />
        <div className="text-sm">{formatCount(replyCount)}</div>
      </button>
      <PostEditor parentEvent={event} open={open} setOpen={setOpen} />
    </>
  )
}
