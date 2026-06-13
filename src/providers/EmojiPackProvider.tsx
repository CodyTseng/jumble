import {
  buildATag,
  buildEmojiTag,
  createEmojiSetDraftEvent,
  createUserEmojiListDraftEvent
} from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { getReplaceableCoordinateFromEvent } from '@/lib/event'
import client from '@/services/client.service'
import customEmojiService from '@/services/custom-emoji.service'
import { TEmoji } from '@/types'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useMemo } from 'react'
import { toast } from 'sonner'
import { useNostr } from './NostrProvider'

type TStandaloneEmoji = Pick<TEmoji, 'shortcode' | 'url'>

type TEmojiPackContext = {
  emojiPackCoordinateSet: Set<string>
  addEmojiPack: (event: Event) => Promise<void>
  removeEmojiPack: (event: Event) => Promise<void>
  addStandaloneEmoji: (emoji: TStandaloneEmoji) => Promise<void>
  removeStandaloneEmoji: (emoji: TStandaloneEmoji) => Promise<void>
  editStandaloneEmoji: (target: TStandaloneEmoji, newShortcode: string) => Promise<void>
  setStandaloneEmojis: (emojis: TStandaloneEmoji[]) => Promise<boolean>
  createEmojiSet: (title: string, emojis: TStandaloneEmoji[]) => Promise<Event | null>
  editEmojiSet: (
    setEvent: Event,
    title: string,
    emojis: TStandaloneEmoji[]
  ) => Promise<Event | null>
  refreshCustomEmojis: () => void
}

const EmojiPackContext = createContext<TEmojiPackContext | undefined>(undefined)

export const useEmojiPack = () => {
  const context = useContext(EmojiPackContext)
  if (!context) {
    throw new Error('useEmojiPack must be used within a EmojiPackProvider')
  }
  return context
}

const isEmojiTagOf = (tag: string[], emoji: TStandaloneEmoji) =>
  tag[0] === 'emoji' && tag[1] === emoji.shortcode && tag[2] === emoji.url

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

  const refreshCustomEmojis = () => {
    customEmojiService.init(userEmojiListEvent)
  }

  // Publish a new kind 10030 built from the latest remote tags transformed by `transform`.
  // Returns true if the list was actually changed and published.
  const updateUserEmojiList = async (transform: (tags: string[][]) => string[][] | null) => {
    if (!accountPubkey) return false
    const latest = await client.fetchUserEmojiListEvent(accountPubkey)
    const currentTags = latest?.tags ?? []
    const newTags = transform(currentTags)
    if (!newTags) return false

    const draft = createUserEmojiListDraftEvent(newTags, latest?.content)
    const newEvent = await publish(draft)
    await updateUserEmojiListEvent(newEvent)
    return true
  }

  const addEmojiPack = async (event: Event) => {
    if (!accountPubkey || event.kind !== kinds.Emojisets) return
    const coordinate = getReplaceableCoordinateFromEvent(event)
    try {
      await updateUserEmojiList((tags) => {
        if (tags.some((tag) => tag[0] === 'a' && tag[1] === coordinate)) return null
        return [...tags, buildATag(event)]
      })
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`Failed to add emoji pack: ${err}`, { duration: 10_000 })
      })
    }
  }

  const removeEmojiPack = async (event: Event) => {
    if (!accountPubkey) return
    const coordinate = getReplaceableCoordinateFromEvent(event)
    try {
      await updateUserEmojiList((tags) => {
        const newTags = tags.filter((tag) => tag[0] !== 'a' || tag[1] !== coordinate)
        return newTags.length === tags.length ? null : newTags
      })
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`Failed to remove emoji pack: ${err}`, { duration: 10_000 })
      })
    }
  }

  const addStandaloneEmoji = async (emoji: TStandaloneEmoji) => {
    if (!accountPubkey) return
    try {
      await updateUserEmojiList((tags) => {
        if (tags.some((tag) => isEmojiTagOf(tag, emoji))) return null
        return [...tags, buildEmojiTag(emoji)]
      })
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`Failed to add emoji: ${err}`, { duration: 10_000 })
      })
    }
  }

  const removeStandaloneEmoji = async (emoji: TStandaloneEmoji) => {
    if (!accountPubkey) return
    try {
      await updateUserEmojiList((tags) => {
        const newTags = tags.filter((tag) => !isEmojiTagOf(tag, emoji))
        return newTags.length === tags.length ? null : newTags
      })
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`Failed to remove emoji: ${err}`, { duration: 10_000 })
      })
    }
  }

  const editStandaloneEmoji = async (target: TStandaloneEmoji, newShortcode: string) => {
    if (!accountPubkey || newShortcode === target.shortcode) return
    try {
      await updateUserEmojiList((tags) => {
        if (!tags.some((tag) => isEmojiTagOf(tag, target))) return null
        return tags.map((tag) =>
          isEmojiTagOf(tag, target)
            ? buildEmojiTag({ shortcode: newShortcode, url: target.url })
            : tag
        )
      })
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`Failed to edit emoji: ${err}`, { duration: 10_000 })
      })
    }
  }

  // Replace the whole standalone emoji list (the `emoji` tags) while keeping pack `a` tags.
  // Returns true if the list was published.
  const setStandaloneEmojis = async (emojis: TStandaloneEmoji[]) => {
    if (!accountPubkey) return false
    try {
      return await updateUserEmojiList((tags) => {
        const others = tags.filter((tag) => tag[0] !== 'emoji')
        return [...others, ...emojis.map((emoji) => buildEmojiTag(emoji))]
      })
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`Failed to save emojis: ${err}`, { duration: 10_000 })
      })
      return false
    }
  }

  const createEmojiSet = async (title: string, emojis: TStandaloneEmoji[]) => {
    if (!accountPubkey) return null
    try {
      const setEvent = await publish(createEmojiSetDraftEvent(emojis, title))
      await client.updateEmojiSetCache(setEvent)
      await addEmojiPack(setEvent)
      return setEvent
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`Failed to create emoji set: ${err}`, { duration: 10_000 })
      })
      return null
    }
  }

  const editEmojiSet = async (setEvent: Event, title: string, emojis: TStandaloneEmoji[]) => {
    if (!accountPubkey || setEvent.pubkey !== accountPubkey) return null
    const d = setEvent.tags.find((tag) => tag[0] === 'd')?.[1] ?? ''
    const coordinate = getReplaceableCoordinateFromEvent(setEvent)
    try {
      const newSetEvent = await publish(createEmojiSetDraftEvent(emojis, title, d))
      await client.updateEmojiSetCache(newSetEvent)
      if (emojiPackCoordinateSet.has(coordinate)) {
        // Already referenced → 10030 is unchanged, so reload manually to reflect new content.
        refreshCustomEmojis()
      } else {
        // Not referenced yet → adding the a-tag re-triggers init with the fresh list.
        await addEmojiPack(newSetEvent)
      }
      return newSetEvent
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`Failed to edit emoji set: ${err}`, { duration: 10_000 })
      })
      return null
    }
  }

  return (
    <EmojiPackContext.Provider
      value={{
        emojiPackCoordinateSet,
        addEmojiPack,
        removeEmojiPack,
        addStandaloneEmoji,
        removeStandaloneEmoji,
        editStandaloneEmoji,
        setStandaloneEmojis,
        createEmojiSet,
        editEmojiSet,
        refreshCustomEmojis
      }}
    >
      {children}
    </EmojiPackContext.Provider>
  )
}
