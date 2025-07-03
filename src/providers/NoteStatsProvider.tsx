import client from '@/services/client.service'
import noteStats from '@/services/note-stats.service'
import { Event, Filter, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect } from 'react'
import { useNostr } from './NostrProvider'

type TNoteStatsContext = {
  fetchNoteStats: (event: Event) => Promise<Event[]>
}

const NoteStatsContext = createContext<TNoteStatsContext | undefined>(undefined)

export const useNoteStats = () => {
  const context = useContext(NoteStatsContext)
  if (!context) {
    throw new Error('useNoteStats must be used within a NoteStatsProvider')
  }
  return context
}

export function NoteStatsProvider({ children }: { children: React.ReactNode }) {
  const { pubkey } = useNostr()

  useEffect(() => {
    const init = async () => {
      if (!pubkey) return
      const relayList = await client.fetchRelayList(pubkey)
      const events = await client.fetchEvents(relayList.write.slice(0, 4), [
        {
          authors: [pubkey],
          kinds: [kinds.Reaction, kinds.Repost],
          limit: 100
        },
        {
          '#P': [pubkey],
          kinds: [kinds.Zap],
          limit: 100
        }
      ])
      noteStats.updateNoteStatsByEvents(events)
    }
    init()
  }, [pubkey])

  const fetchNoteStats = async (event: Event) => {
    const oldStats = noteStats.getNoteStats(event.id)
    let since: number | undefined
    if (oldStats?.updatedAt) {
      since = oldStats.updatedAt
    }
    const [relayList, authorProfile] = await Promise.all([
      client.fetchRelayList(event.pubkey),
      client.fetchProfile(event.pubkey)
    ])
    const filters: Filter[] = [
      {
        '#e': [event.id],
        kinds: [kinds.Reaction],
        limit: 500
      },
      {
        '#e': [event.id],
        kinds: [kinds.Repost],
        limit: 100
      }
    ]

    if (authorProfile?.lightningAddress) {
      filters.push({
        '#e': [event.id],
        kinds: [kinds.Zap],
        limit: 500
      })
    }

    if (pubkey) {
      filters.push({
        '#e': [event.id],
        authors: [pubkey],
        kinds: [kinds.Reaction, kinds.Repost]
      })

      if (authorProfile?.lightningAddress) {
        filters.push({
          '#e': [event.id],
          '#P': [pubkey],
          kinds: [kinds.Zap]
        })
      }
    }

    if (since) {
      filters.forEach((filter) => {
        filter.since = since
      })
    }
    const events: Event[] = []
    await client.fetchEvents(relayList.read.slice(0, 5), filters, {
      onevent(evt) {
        noteStats.updateNoteStatsByEvents([evt])
        events.push(evt)
      }
    })
    return events
  }

  return (
    <NoteStatsContext.Provider
      value={{
        fetchNoteStats
      }}
    >
      {children}
    </NoteStatsContext.Provider>
  )
}
