import { TEmoji } from '@/types'
import { MouseEvent, PointerEvent, useRef } from 'react'

const MOVE_THRESHOLD = 8
const LAYOUT_THRESHOLD = 2

function emojiKey(emoji: string | TEmoji) {
  return typeof emoji === 'string' ? emoji : `${emoji.shortcode}|${emoji.url}`
}

// Keep selection on click for keyboard/accessibility support, but require a
// stable press/release for pointer clicks. A sheet animation, scroll, or list
// update must not turn a press on one visible emoji into a different selection.
export function useEmojiPick(emoji: string | TEmoji, onPick: (emoji: string | TEmoji) => void) {
  const press = useRef<{
    pointerId: number
    x: number
    y: number
    rect: DOMRect
    key: string
    cancelled: boolean
    released: boolean
  } | null>(null)

  const validate = (e: PointerEvent<HTMLButtonElement>) => {
    const start = press.current
    if (!start || start.pointerId !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (
      Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_THRESHOLD ||
      Math.abs(rect.left - start.rect.left) > LAYOUT_THRESHOLD ||
      Math.abs(rect.top - start.rect.top) > LAYOUT_THRESHOLD ||
      Math.abs(rect.width - start.rect.width) > LAYOUT_THRESHOLD ||
      Math.abs(rect.height - start.rect.height) > LAYOUT_THRESHOLD ||
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom ||
      start.key !== emojiKey(emoji)
    ) {
      start.cancelled = true
    }
  }

  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (!e.isPrimary || e.button !== 0) {
        if (press.current) press.current.cancelled = true
        return
      }
      press.current = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        rect: e.currentTarget.getBoundingClientRect(),
        key: emojiKey(emoji),
        cancelled: false,
        released: false
      }
    },
    onPointerMove: validate,
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      validate(e)
      if (press.current?.pointerId === e.pointerId) press.current.released = true
    },
    onPointerCancel: () => {
      if (press.current) press.current.cancelled = true
    },
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      const start = press.current
      press.current = null
      // Keyboard and assistive-technology clicks have no pointer sequence.
      if (e.detail !== 0) {
        const rect = e.currentTarget.getBoundingClientRect()
        if (
          !start ||
          start.cancelled ||
          !start.released ||
          start.key !== emojiKey(emoji) ||
          Math.abs(rect.left - start.rect.left) > LAYOUT_THRESHOLD ||
          Math.abs(rect.top - start.rect.top) > LAYOUT_THRESHOLD ||
          Math.abs(rect.width - start.rect.width) > LAYOUT_THRESHOLD ||
          Math.abs(rect.height - start.rect.height) > LAYOUT_THRESHOLD
        ) {
          e.preventDefault()
          return
        }
      }
      onPick(emoji)
    }
  }
}
