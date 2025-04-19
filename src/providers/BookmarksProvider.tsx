import { createBookmarkDraftEvent } from '@/lib/draft-event'
import client from '@/services/client.service'
import { createContext, useContext } from 'react'
import { useNostr } from './NostrProvider'
import { Event } from 'nostr-tools'

type TBookmarksContext = {
  addBookmark: (event: Event) => Promise<void>
  removeBookmark: (event: Event) => Promise<void>
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
  const { pubkey: accountPubkey, publish, updateBookmarkListEvent } = useNostr()

  const addBookmark = async (event: Event) => {
    if (!accountPubkey) return

    const bookmarkListEvent = await client.fetchBookmarkListEvent(accountPubkey)
    const currentTags = bookmarkListEvent?.tags || []

    if (currentTags.some((tag) => tag[0] === 'e' && tag[1] === event.id)) return

    const newBookmarkDraftEvent = createBookmarkDraftEvent(
      [...currentTags, ['e', event.id, client.getEventHint(event.id), '', event.pubkey]],
      bookmarkListEvent?.content
    )
    const newBookmarkEvent = await publish(newBookmarkDraftEvent)
    await updateBookmarkListEvent(newBookmarkEvent)
  }

  const removeBookmark = async (event: Event) => {
    if (!accountPubkey) return

    const bookmarkListEvent = await client.fetchBookmarkListEvent(accountPubkey)
    if (!bookmarkListEvent) return

    const newTags = bookmarkListEvent.tags.filter((tag) => !(tag[0] === 'e' && tag[1] === event.id))
    if (newTags.length === bookmarkListEvent.tags.length) return

    const newBookmarkDraftEvent = createBookmarkDraftEvent(newTags, bookmarkListEvent.content)
    const newBookmarkEvent = await publish(newBookmarkDraftEvent)
    await updateBookmarkListEvent(newBookmarkEvent)
  }

  return (
    <BookmarksContext.Provider
      value={{
        addBookmark,
        removeBookmark
      }}
    >
      {children}
    </BookmarksContext.Provider>
  )
}
