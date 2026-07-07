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
    <div className={cn('space-y-4 whitespace-pre-wrap text-wrap wrap-break-word', className)}>
      {comment && <Content event={createFakeEvent({ content: comment, tags: event.tags })} />}
      <div className="flex gap-4">
        <div className="my-1 w-1 shrink-0 rounded-md bg-primary/60" />
        <div
          className="whitespace-pre-line italic"
          style={{
            overflowWrap: 'anywhere'
          }}
        >
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
      // Highest priority: 'source' tag
      if (tag[2] === 'source') {
        sourceTag = tag
        break
      }

      // Give 'e' tags highest priority
      if (tag[0] === 'e') {
        sourceTag = tag
        continue
      }

      // Give 'a' tags second priority over 'e' tags
      if (tag[0] === 'a' && (!sourceTag || sourceTag[0] !== 'e')) {
        sourceTag = tag
        continue
      }

      // Give 'r' tags lowest priority
      if (tag[0] === 'r' && (!sourceTag || sourceTag[0] === 'r')) {
        sourceTag = tag
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
          className="italic text-muted-foreground underline hover:text-foreground"
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
          className="pointer-events-auto cursor-pointer truncate underline hover:text-foreground"
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
