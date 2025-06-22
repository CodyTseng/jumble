import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'

export function useTranslatedEvent(eventId?: string) {
  const { translatedEventIdSet, getTranslatedEvent } = useTranslationService()
  const translated = useMemo(() => {
    return eventId ? translatedEventIdSet.has(eventId) : false
  }, [eventId, translatedEventIdSet])
  const [translatedEvent, setTranslatedEvent] = useState<Event | null>(null)

  useEffect(() => {
    if (translated && eventId) {
      setTranslatedEvent(getTranslatedEvent(eventId))
    } else {
      setTranslatedEvent(null)
    }
  }, [translated, eventId])

  return translatedEvent
}
