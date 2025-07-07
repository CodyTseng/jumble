import { ExtendedKind } from '@/constants'
import { cn } from '@/lib/utils'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CommunityDefinitionPreview from './CommunityDefinitionPreview'
import GroupMetadataPreview from './GroupMetadataPreview'
import LiveEventPreview from './LiveEventPreview'
import LongFormArticlePreview from './LongFormArticlePreview'
import NormalContentPreview from './NormalContentPreview'

export default function ContentPreview({
  event,
  className,
  onClick
}: {
  event?: Event
  className?: string
  onClick?: React.MouseEventHandler<HTMLDivElement> | undefined
}) {
  const { t } = useTranslation()
  const { mutePubkeys } = useMuteList()
  const isMuted = useMemo(
    () => (event ? mutePubkeys.includes(event.pubkey) : false),
    [mutePubkeys, event]
  )

  if (!event) {
    return <div className={cn('pointer-events-none', className)}>{`[${t('Note not found')}]`}</div>
  }

  if (isMuted) {
    return (
      <div className={cn('pointer-events-none', className)}>[{t('This user has been muted')}]</div>
    )
  }

  if ([kinds.ShortTextNote, ExtendedKind.COMMENT, ExtendedKind.PICTURE].includes(event.kind)) {
    return <NormalContentPreview event={event} className={className} onClick={onClick} />
  }

  if (event.kind === kinds.Highlights) {
    return (
      <div className={cn('pointer-events-none', className)}>
        [{t('Highlight')}] <span className="italic">{event.content}</span>
      </div>
    )
  }

  if (event.kind === kinds.LongFormArticle) {
    return <LongFormArticlePreview event={event} className={className} onClick={onClick} />
  }

  if (event.kind === ExtendedKind.GROUP_METADATA) {
    return <GroupMetadataPreview event={event} className={className} onClick={onClick} />
  }

  if (event.kind === kinds.CommunityDefinition) {
    return <CommunityDefinitionPreview event={event} className={className} onClick={onClick} />
  }

  if (event.kind === kinds.LiveEvent) {
    return <LiveEventPreview event={event} className={className} onClick={onClick} />
  }

  return <div className={className}>[{t('Cannot handle event of kind k', { k: event.kind })}]</div>
}
