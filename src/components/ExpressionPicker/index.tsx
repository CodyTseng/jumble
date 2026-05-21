import klipyService, { TGif } from '@/services/klipy.service'
import { TEmoji } from '@/types'
import { useState } from 'react'
import EmojiContent from './EmojiContent'
import GifContent from './GifContent'
import ModeSwitch, { TExpressionPickerMode } from './ModeSwitch'

export default function ExpressionPicker({
  onEmojiClick,
  onGifClick,
  enableGif = false
}: {
  onEmojiClick: (emoji: string | TEmoji) => void
  onGifClick?: (gif: TGif) => void
  enableGif?: boolean
}) {
  const showGifMode = enableGif && klipyService.isEnabled() && !!onGifClick
  const [mode, setMode] = useState<TExpressionPickerMode>('emoji')

  return (
    <div
      className={
        showGifMode
          ? 'flex h-[400px] w-full flex-col bg-background sm:h-[50vh] sm:w-[420px]'
          : 'flex h-[400px] w-full flex-col bg-background sm:w-[350px]'
      }
    >
      {showGifMode && mode === 'gif' ? (
        <GifContent onGifClick={onGifClick} />
      ) : (
        <EmojiContent onEmojiClick={onEmojiClick} />
      )}
      {showGifMode && <ModeSwitch mode={mode} onChange={setMode} />}
    </div>
  )
}
