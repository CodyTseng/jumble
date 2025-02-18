import { cn } from '@/lib/utils'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'

export default function ParentNotePreview({
  event,
  className,
  onClick
}: {
  event: Event
  className?: string
  onClick?: React.MouseEventHandler<HTMLDivElement> | undefined
}) {
  const { t } = useTranslation()
  const { mutePubkeys } = useMuteList()
  const isMuted = useMemo(() => mutePubkeys.includes(event.pubkey), [mutePubkeys, event])

  return (
    <div
      className={cn(
        'flex space-x-1 items-center text-sm rounded-full px-2 bg-muted w-fit max-w-full text-muted-foreground hover:text-foreground cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="shrink-0">{t('reply to')}</div>
      <UserAvatar className="shrink-0" userId={event.pubkey} size="tiny" />
      {isMuted ? (
        <div className="truncate">{t('[muted]')}</div>
      ) : (
        <div className="truncate">{event.content}</div>
      )}
    </div>
  )
}
