import client from '@renderer/services/client.service'
import { Event, Filter, nip19 } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useFetchEventById(id?: string) {
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [event, setEvent] = useState<Event | undefined>(undefined)

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        setIsFetching(false)
        setError(new Error('No id provided'))
        return
      }

      let filter: Filter | undefined
      if (/^[0-9a-f]{64}$/.test(id)) {
        filter = { ids: [id] }
      } else {
        const { type, data } = nip19.decode(id)
        switch (type) {
          case 'note':
            filter = { ids: [data] }
            break
          case 'nevent':
            filter = { ids: [data.id] }
            break
          case 'naddr':
            filter = {
              authors: [data.pubkey],
              kinds: [data.kind],
              limit: 1
            }
            if (data.identifier) {
              filter['#d'] = [data.identifier]
            }
        }
      }
      if (!filter) {
        setIsFetching(false)
        setError(new Error('Invalid id'))
        return
      }

      let event: Event | undefined
      if (filter.ids) {
        event = await client.fetchEventById(filter.ids[0])
      } else {
        event = await client.fetchEventByFilter(filter)
      }
      if (event) {
        setEvent(event)
      }
      setIsFetching(false)
    }

    fetchEvent().catch((err) => {
      setError(err as Error)
      setIsFetching(false)
    })
  }, [id])

  return { isFetching, error, event }
}
