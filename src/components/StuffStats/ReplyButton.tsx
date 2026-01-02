import { useFilteredAllReplies } from '@/hooks'
import { useStuff } from '@/hooks/useStuff'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { MessageCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function ReplyButton({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { checkLogin } = useNostr()
  const { stuffKey } = useStuff(stuff)
  const { replies, hasReplied } = useFilteredAllReplies(stuffKey)
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
        {!!replies.length && <div className="text-sm">{formatCount(replies.length)}</div>}
      </button>
      <PostEditor parentStuff={stuff} open={open} setOpen={setOpen} />
    </>
  )
}
