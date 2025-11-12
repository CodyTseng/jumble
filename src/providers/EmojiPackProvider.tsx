import { buildATag, createUserEmojiListDraftEvent } from '@/lib/draft-event'
import { getReplaceableCoordinateFromEvent } from '@/lib/event'
import client from '@/services/client.service'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useMemo } from 'react'
import { useNostr } from './NostrProvider'

type TEmojiPackContext = {
  emojiPackCoordinateSet: Set<string>
  addEmojiPack: (event: Event) => Promise<void>
  removeEmojiPack: (event: Event) => Promise<void>
}

const EmojiPackContext = createContext<TEmojiPackContext | undefined>(undefined)

export const useEmojiPack = () => {
  const context = useContext(EmojiPackContext)
  if (!context) {
    throw new Error('useEmojiPack must be used within a EmojiPackProvider')
  }
  return context
}

export function EmojiPackProvider({ children }: { children: React.ReactNode }) {
  const {
    pubkey: accountPubkey,
    userEmojiListEvent,
    publish,
    updateUserEmojiListEvent
  } = useNostr()
  const emojiPackCoordinateSet = useMemo(() => {
    const set = new Set<string>()
    userEmojiListEvent?.tags.forEach((tag) => {
      if (tag[0] === 'a') {
        set.add(tag[1])
      }
    })
    return set
  }, [userEmojiListEvent])

  const addEmojiPack = async (event: Event) => {
    if (!accountPubkey || event.kind !== kinds.Emojisets) return

    const userEmojiListEvent = await client.fetchUserEmojiListEvent(accountPubkey)
    const currentTags = userEmojiListEvent?.tags || []
    const coordinate = getReplaceableCoordinateFromEvent(event)

    // Check if already exists
    if (currentTags.some((tag) => tag[0] === 'a' && tag[1] === coordinate)) {
      return
    }

    const newUserEmojiListDraftEvent = createUserEmojiListDraftEvent(
      [...currentTags, buildATag(event)],
      userEmojiListEvent?.content
    )
    const newUserEmojiListEvent = await publish(newUserEmojiListDraftEvent)
    await updateUserEmojiListEvent(newUserEmojiListEvent)
  }

  const removeEmojiPack = async (event: Event) => {
    if (!accountPubkey) return

    const userEmojiListEvent = await client.fetchUserEmojiListEvent(accountPubkey)
    if (!userEmojiListEvent) return

    const coordinate = getReplaceableCoordinateFromEvent(event)
    const newTags = userEmojiListEvent.tags.filter((tag) => tag[0] !== 'a' || tag[1] !== coordinate)
    if (newTags.length === userEmojiListEvent.tags.length) return

    const newUserEmojiListDraftEvent = createUserEmojiListDraftEvent(
      newTags,
      userEmojiListEvent.content
    )
    const newUserEmojiListEvent = await publish(newUserEmojiListDraftEvent)
    await updateUserEmojiListEvent(newUserEmojiListEvent)
  }

  return (
    <EmojiPackContext.Provider
      value={{
        emojiPackCoordinateSet,
        addEmojiPack,
        removeEmojiPack
      }}
    >
      {children}
    </EmojiPackContext.Provider>
  )
}
