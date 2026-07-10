import { useSecondaryPage } from '@/PageManager'
import Content from '@/components/Content'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import { formatAmount } from '@/lib/lightning'
import { toNote, toProfile } from '@/lib/link'
import { cn } from '@/lib/utils'
import { Zap as ZapIcon } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import ClickableCard from '../ClickableCard'
import ParentNotePreview from '../ParentNotePreview'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'
import UnknownNote from './UnknownNote'

export default function Zap({
  className,
  event
}: {
  className?: string
  event: Event
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const info = getZapInfoFromEvent(event)

  if (!info?.senderPubkey || info.amount <= 0) {
    return <UnknownNote className={className} event={event} />
  }
  const targetEventId = info.eventId

  const target = targetEventId ? (
    <ParentNotePreview
      eventId={targetEventId}
      label={t('Zap to')}
      onClick={(e) => {
        e.stopPropagation()
        push(toNote(targetEventId))
      }}
    />
  ) : (
    <ClickableCard
      className="flex w-fit max-w-full cursor-pointer items-center gap-1 rounded-full bg-muted px-2 text-sm text-muted-foreground hover:text-foreground"
      onClick={() => push(toProfile(info.recipientPubkey))}
    >
      <div className="shrink-0">{t('Zap to')}</div>
      <SimpleUserAvatar className="shrink-0" userId={info.recipientPubkey} size="tiny" />
      <SimpleUsername
        userId={info.recipientPubkey}
        className="max-w-36 truncate font-medium"
        skeletonClassName="h-3"
      />
    </ClickableCard>
  )

  return (
    <div className={cn('space-y-2', className)}>
      {target}
      <div className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yellow-400/15 text-yellow-500">
            <ZapIcon className="size-5 fill-yellow-400" />
          </div>
          <div className="flex items-baseline gap-1 text-yellow-500">
            <span className="text-lg font-semibold">{formatAmount(info.amount)}</span>
            <span className="text-sm font-medium">{t('sats')}</span>
          </div>
        </div>
        {info.comment && <Content className="mt-3" content={info.comment} />}
      </div>
    </div>
  )
}
