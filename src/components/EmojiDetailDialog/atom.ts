import { TEmoji } from '@/types'
import { atom } from 'jotai'

// The custom emoji currently shown in the EmojiDetailDialog, or null when closed.
// Kept in its own module so the leaf Emoji component can open the dialog without
// importing the dialog component itself (avoids a circular import).
export const emojiDetailAtom = atom<TEmoji | null>(null)
