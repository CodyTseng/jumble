import { createBookmarkDraftEvent } from '@/lib/draft-event'
import { createContext, useContext, useMemo } from 'react'
import { useNostr } from './NostrProvider'
import client from '@/services/client.service'

type TBookmarksContext = {
  bookmarks: string[][]
  addBookmark: (eventId: string, eventPubkey: string, relayHint?: string) => Promise<void>
  removeBookmark: (eventId: string) => Promise<void>
}

const BookmarksContext = createContext<TBookmarksContext | undefined>(undefined)

export const useBookmarks = () => {
  const context = useContext(BookmarksContext)
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarksProvider')
  }
  return context
}

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const { pubkey: accountPubkey, bookmarkListEvent, publish, updateBookmarkListEvent } = useNostr()
  const bookmarks = useMemo(
    () => (bookmarkListEvent ? bookmarkListEvent.tags : []),
    [bookmarkListEvent]
  )

  const addBookmark = async (eventId: string, eventPubkey: string, relayHint?: string) => {
    if (!accountPubkey) return

    const relayHintToUse = relayHint || client.getEventHint(eventId)

    const newTag = ['e', eventId, relayHintToUse, eventPubkey]

    const currentTags = bookmarkListEvent?.tags || []

    const isDuplicate = currentTags.some((tag) => tag[0] === 'e' && tag[1] === eventId)

    if (isDuplicate) return

    const newTags = [...currentTags, newTag]

    const newBookmarkDraftEvent = createBookmarkDraftEvent(newTags)
    const newBookmarkEvent = await publish(newBookmarkDraftEvent)
    await updateBookmarkListEvent(newBookmarkEvent)
  }

  const removeBookmark = async (eventId: string) => {
    if (!accountPubkey || !bookmarkListEvent) return

    const newTags = bookmarkListEvent.tags.filter((tag) => !(tag[0] === 'e' && tag[1] === eventId))

    if (newTags.length === bookmarkListEvent.tags.length) return

    const newBookmarkDraftEvent = createBookmarkDraftEvent(newTags)
    const newBookmarkEvent = await publish(newBookmarkDraftEvent)
    await updateBookmarkListEvent(newBookmarkEvent)
  }

  return (
    <BookmarksContext.Provider
      value={{
        bookmarks,
        addBookmark,
        removeBookmark
      }}
    >
      {children}
    </BookmarksContext.Provider>
  )
}
