import client from '@renderer/services/client.service'
import { Event, Filter, nip19 } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useFetchEventById(id?: string) {
  const [event, setEvent] = useState<Event | undefined>(undefined)

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return

      let filter: Filter = {}
      if (/^[0-9a-f]{64}$/.test(id)) {
        filter = { ids: [id] }
      } else {
        const { type, data } = nip19.decode(id)
        switch (type) {
          case 'note':
            filter = { ids: [data] }
            break
          case 'nevent':
            if (data.id) {
              filter.ids = [data.id]
            }
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

      if (!filter) return

      let event: Event | undefined
      if (filter.ids) {
        event = await client.fetchEventById(filter.ids[0])
      } else {
        event = await client.fetchEventByFilter(filter)
      }
      if (event) {
        setEvent(event)
      } else {
        setEvent(undefined)
      }
    }

    fetchEvent()
  }, [id])

  return event
}
