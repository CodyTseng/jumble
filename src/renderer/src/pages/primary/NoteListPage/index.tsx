import NoteList, { TNoteListRef } from '@renderer/components/NoteList'
import { TitlebarButton } from '@renderer/components/Titlebar'
import PrimaryPageLayout, { TPrimaryPageLayoutRef } from '@renderer/layouts/PrimaryPageLayout'
import { isCommentEvent } from '@renderer/lib/event'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { RefreshCcw } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function NoteListPage() {
  const layoutRef = useRef<TPrimaryPageLayoutRef>(null)
  const noteListRef = useRef<TNoteListRef>(null)
  const [newEvents, setNewEvents] = useState<Event[]>([])
  const [newEventIdSet, setNewEventIdSet] = useState<Set<string>>(new Set())
  const [refreshAt, setRefreshAt] = useState<number>(() => dayjs().unix())

  useEffect(() => {
    const subscription = client.listenNewEvents(
      { kinds: [kinds.ShortTextNote, kinds.Repost], since: refreshAt + 1, limit: 0 },
      (event) => {
        if (
          newEvents.length <= 50 &&
          !isCommentEvent(event) &&
          event.created_at > refreshAt &&
          !newEventIdSet.has(event.id)
        ) {
          setNewEvents((oldEvents) => [event, ...oldEvents])
          setNewEventIdSet((oldSet) => new Set(oldSet).add(event.id))
        }
      },
      50
    )

    return () => {
      setNewEvents([])
      subscription.unsubscribe()
    }
  }, [refreshAt])

  const handleRefresh = useCallback(() => {
    layoutRef.current?.scrollToTop()
    if (newEvents.length < 50) {
      noteListRef.current?.addNewNotes(newEvents)
    } else {
      noteListRef.current?.refresh()
    }
    setRefreshAt(dayjs().unix())
  }, [newEvents])

  return (
    <PrimaryPageLayout
      ref={layoutRef}
      titlebarContent={<Titlebar onRefresh={handleRefresh} hasNewNotes={!!newEvents.length} />}
    >
      <NoteList ref={noteListRef} />
    </PrimaryPageLayout>
  )
}

function Titlebar({ onRefresh, hasNewNotes }: { onRefresh: () => void; hasNewNotes: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    setLoading(true)
    onRefresh()
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  return (
    <TitlebarButton disabled={!hasNewNotes || loading} onClick={handleClick}>
      <RefreshCcw className={`text-foreground ${loading ? 'animate-spin' : ''}`} size={18} />
    </TitlebarButton>
  )
}
