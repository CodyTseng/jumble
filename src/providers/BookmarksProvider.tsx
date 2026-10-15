import { buildATag, buildETag, createBookmarkDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { isSameAccount } from '@/lib/account'
import { Event } from 'nostr-tools'
import { createContext, useContext, useRef } from 'react'
import { toast } from 'sonner'
import { useNostr } from './NostrProvider'

type TBookmarksContext = {
  addBookmark: (event: Event, signal?: AbortSignal) => Promise<void>
  removeBookmark: (event: Event, signal?: AbortSignal) => Promise<void>
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
  const { account, pubkey: accountPubkey, publish, updateBookmarkListEvent } = useNostr()
  const isCurrent = () => isSameAccount(account, storage.getCurrentAccount())
  const queues = useRef(new Map<string, Promise<void>>())
  const enqueue = (operation: () => Promise<void>) => {
    const key = accountPubkey ?? ''
    const task = (queues.current.get(key) ?? Promise.resolve()).catch(() => {}).then(operation)
    queues.current.set(key, task)
    const cleanup = () => {
      if (queues.current.get(key) === task) queues.current.delete(key)
    }
    void task.then(cleanup, cleanup)
    return task
  }

  const addBookmark = async (event: Event, signal?: AbortSignal) => {
    if (!accountPubkey || signal?.aborted || !isCurrent()) return

    const bookmarkListEvent = await client.fetchBookmarkListEvent(accountPubkey)
    if (signal?.aborted || !isCurrent()) return
    const currentTags = bookmarkListEvent?.tags || []
    const isReplaceable = isReplaceableEvent(event.kind)
    const eventKey = isReplaceable ? getReplaceableCoordinateFromEvent(event) : event.id

    if (
      currentTags.some((tag) =>
        isReplaceable
          ? tag[0] === 'a' && tag[1] === eventKey
          : tag[0] === 'e' && tag[1] === eventKey
      )
    ) {
      return
    }

    const newBookmarkDraftEvent = createBookmarkDraftEvent(
      [...currentTags, isReplaceable ? buildATag(event) : buildETag(event.id, event.pubkey)],
      bookmarkListEvent?.content
    )
    newBookmarkDraftEvent.created_at = Math.max(
      newBookmarkDraftEvent.created_at,
      (bookmarkListEvent?.created_at ?? 0) + 1
    )
    try {
      const newBookmarkEvent = await publish(newBookmarkDraftEvent, { signal })
      client.addEventToCache(newBookmarkEvent)
      if (!signal?.aborted && isCurrent()) await updateBookmarkListEvent(newBookmarkEvent)
    } catch (error) {
      if (signal?.aborted || !isCurrent()) return
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to add bookmark: ${err}`, { duration: 10_000 })
      })
    }
  }

  const removeBookmark = async (event: Event, signal?: AbortSignal) => {
    if (!accountPubkey || signal?.aborted || !isCurrent()) return

    const bookmarkListEvent = await client.fetchBookmarkListEvent(accountPubkey)
    if (signal?.aborted || !isCurrent()) return
    if (!bookmarkListEvent) return

    const isReplaceable = isReplaceableEvent(event.kind)
    const eventKey = isReplaceable ? getReplaceableCoordinateFromEvent(event) : event.id

    const newTags = bookmarkListEvent.tags.filter((tag) =>
      isReplaceable ? tag[0] !== 'a' || tag[1] !== eventKey : tag[0] !== 'e' || tag[1] !== eventKey
    )
    if (newTags.length === bookmarkListEvent.tags.length) return

    const newBookmarkDraftEvent = createBookmarkDraftEvent(newTags, bookmarkListEvent.content)
    newBookmarkDraftEvent.created_at = Math.max(
      newBookmarkDraftEvent.created_at,
      bookmarkListEvent.created_at + 1
    )
    try {
      const newBookmarkEvent = await publish(newBookmarkDraftEvent, { signal })
      client.addEventToCache(newBookmarkEvent)
      if (!signal?.aborted && isCurrent()) await updateBookmarkListEvent(newBookmarkEvent)
    } catch (error) {
      if (signal?.aborted || !isCurrent()) return
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to remove bookmark: ${err}`, { duration: 10_000 })
      })
    }
  }

  return (
    <BookmarksContext.Provider
      value={{
        addBookmark: (event, signal) => enqueue(() => addBookmark(event, signal)),
        removeBookmark: (event, signal) => enqueue(() => removeBookmark(event, signal))
      }}
    >
      {children}
    </BookmarksContext.Provider>
  )
}
