import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import threadService from '@/services/thread.service'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useFetchEvent(eventId?: string) {
  const { isEventDeleted } = useDeletedEvent()
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [event, setEvent] = useState<Event | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const fetchEvent = async () => {
      setIsFetching(true)
      setError(null)
      setEvent(undefined)
      if (!eventId) {
        setIsFetching(false)
        setError(new Error('No id provided'))
        return
      }

      const event = await client.fetchEvent(eventId)
      if (event?.kind === kinds.Zap && !(await lightning.validateZapReceipt(event))) {
        if (!cancelled) {
          setEvent(undefined)
          setError(new Error('Invalid zap receipt'))
        }
        return
      }
      if (!cancelled && event && !isEventDeleted(event)) {
        setEvent(event)
        threadService.addRepliesToThread([event])
      }
    }

    fetchEvent()
      .catch((err) => {
        console.error('Error fetching event in useFetchEvent:', eventId, err)
        if (!cancelled) setError(err as Error)
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  useEffect(() => {
    if (event && isEventDeleted(event)) {
      setEvent(undefined)
    }
  }, [isEventDeleted])

  return { isFetching, error, event }
}

export function useFetchEvents(eventIds: readonly string[]) {
  const { isEventDeleted } = useDeletedEvent()
  const [isFetching, setIsFetching] = useState(eventIds.length > 0)
  const [eventsById, setEventsById] = useState<Map<string, Event>>(new Map())

  useEffect(() => {
    let cancelled = false

    if (eventIds.length === 0) {
      setEventsById(new Map())
      setIsFetching(false)
      return
    }

    setIsFetching(true)
    Promise.allSettled(eventIds.map((id) => client.fetchEvent(id)))
      .then(async (results) => {
        const events = new Map<string, Event>()
        await Promise.all(
          results.map(async (result) => {
            if (result.status !== 'fulfilled' || !result.value) return
            const event = result.value
            if (event.kind === kinds.Zap && !(await lightning.validateZapReceipt(event))) return
            if (!isEventDeleted(event)) events.set(event.id, event)
          })
        )
        if (!cancelled) setEventsById(events)
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventIds])

  useEffect(() => {
    setEventsById((events) => {
      let changed = false
      const next = new Map(events)
      for (const [id, event] of events) {
        if (isEventDeleted(event)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : events
    })
  }, [isEventDeleted])

  return { isFetching, eventsById }
}
