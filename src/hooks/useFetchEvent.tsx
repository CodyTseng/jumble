import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useReply } from '@/providers/ReplyProvider'
import client from '@/services/client.service'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useFetchEvent(eventId?: string) {
  const { isEventDeleted } = useDeletedEvent()
  const [isFetching, setIsFetching] = useState(true)
  const { addReplies } = useReply()
  const [error, setError] = useState<Error | null>(null)
  const [event, setEvent] = useState<Event | undefined>(undefined)

  useEffect(() => {
    const fetchEvent = async () => {
      setIsFetching(true)
      if (!eventId) {
        setIsFetching(false)
        setError(new Error('No id provided'))
        return
      }

      const event = await client.fetchEvent(eventId)
      if (event && !isEventDeleted(event)) {
        setEvent(event)
        addReplies([event])
      }
    }

    fetchEvent()
      .catch((err) => {
        console.error('Error fetching event in useFetchEvent:', eventId, error)
        setError(err as Error)
      })
      .finally(() => {
        setIsFetching(false)
      })
  }, [eventId])

  useEffect(() => {
    if (event && isEventDeleted(event)) {
      setEvent(undefined)
    }
  }, [isEventDeleted])

  return { isFetching, error, event }
}
