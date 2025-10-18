import { useFetchEvent, useTranslatedEvent } from '@/hooks'
import { createFakeEvent } from '@/lib/event'
import { toNote } from '@/lib/link'
import { isValidPubkey } from '@/lib/pubkey'
import { generateBech32IdFromATag, generateBech32IdFromETag } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Content from '../Content'
import ContentPreview from '../ContentPreview'
import ExternalLink from '../ExternalLink'
import UserAvatar from '../UserAvatar'

export default function Highlight({ event, className }: { event: Event; className?: string }) {
  const translatedEvent = useTranslatedEvent(event.id)
  const comment = useMemo(
    () => (translatedEvent?.tags ?? event.tags).find((tag) => tag[0] === 'comment')?.[1],
    [event, translatedEvent]
  )

  return (
    <div className={cn('text-wrap break-words whitespace-pre-wrap space-y-4', className)}>
      {comment && <Content event={createFakeEvent({ content: comment })} />}
      <div className="flex gap-4">
        <div className="w-1 flex-shrink-0 my-1 bg-primary/60 rounded-md" />
        <div className="italic whitespace-pre-line">
          {translatedEvent?.content ?? event.content}
        </div>
      </div>
      <HighlightSource event={event} />
    </div>
  )
}

function HighlightSource({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const sourceTag = useMemo(() => {
    let sourceTag: string[] | undefined
    for (const tag of event.tags) {
      if (tag[2] === 'source') {
        sourceTag = tag
        break
      }
      if (tag[0] === 'r') {
        sourceTag = tag
        continue
      } else if (tag[0] === 'a') {
        if (!sourceTag || sourceTag[0] !== 'r') {
          sourceTag = tag
        }
        continue
      } else if (tag[0] === 'e') {
        if (!sourceTag || sourceTag[0] === 'e') {
          sourceTag = tag
        }
        continue
      }
    }

    return sourceTag
  }, [event])
  const { event: referenceEvent } = useFetchEvent(
    sourceTag
      ? sourceTag[0] === 'e'
        ? generateBech32IdFromETag(sourceTag)
        : sourceTag[0] === 'a'
          ? generateBech32IdFromATag(sourceTag)
          : undefined
      : undefined
  )
  const referenceEventId = useMemo(() => {
    if (!sourceTag || sourceTag[0] === 'r') return
    if (sourceTag[0] === 'e') {
      return sourceTag[1]
    }
    if (sourceTag[0] === 'a') {
      return generateBech32IdFromATag(sourceTag)
    }
  }, [sourceTag])
  const pubkey = useMemo(() => {
    if (referenceEvent) {
      return referenceEvent.pubkey
    }
    if (sourceTag && sourceTag[0] === 'a') {
      const [, pubkey] = sourceTag[1].split(':')
      if (isValidPubkey(pubkey)) {
        return pubkey
      }
    }
  }, [sourceTag, referenceEvent])

  if (!sourceTag) {
    return null
  }

  if (sourceTag[0] === 'r') {
    return (
      <div className="truncate text-muted-foreground">
        {t('From')}{' '}
        <ExternalLink
          url={sourceTag[1]}
          className="underline italic text-muted-foreground hover:text-foreground"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="shrink-0">{t('From')}</div>
      {pubkey && <UserAvatar userId={pubkey} size="xSmall" className="cursor-pointer" />}
      {referenceEventId && (
        <div
          className="truncate underline pointer-events-auto cursor-pointer hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation()
            push(toNote(referenceEvent ?? referenceEventId))
          }}
        >
          {referenceEvent ? <ContentPreview event={referenceEvent} /> : referenceEventId}
        </div>
      )}
    </div>
  )
}
