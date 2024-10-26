import client from '@renderer/services/client.service'
import { Event, Filter, nip19 } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useFetchEventById(id: string) {
  const [event, setEvent] = useState<Event | null>(null)

  useEffect(() => {
    const fetchEvent = async () => {
      let filter: Filter | undefined
      if (/^[0-9a-f]{64}$/.test(id)) {
        filter = { ids: [id] }
      } else if (/^note1[a-z0-9]{58}$/.test(id)) {
        const { data } = nip19.decode(id as `note1${string}`)
        filter = { ids: [data] }
      } else if (id.startsWith('nevent1')) {
        const { data } = nip19.decode(id as `nevent1${string}`)
        filter = {}
        if (data.id) {
          filter.ids = [data.id]
        }
        if (data.author) {
          filter.authors = [data.author]
        }
        if (data.kind) {
          filter.kinds = [data.kind]
        }
      }
      if (!filter) return

      const event = await client.fetchEventWithCache(filter)
      if (event) {
        setEvent(event)
      } else {
        setEvent(null)
      }
    }

    fetchEvent()
  }, [id])

  return event
}