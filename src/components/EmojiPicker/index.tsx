import { parseEmojiPickerUnified } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useTheme } from '@/providers/ThemeProvider'
import customEmojiService from '@/services/custom-emoji.service'
import { TEmoji } from '@/types'
import EmojiPickerReact, {
  EmojiStyle,
  SkinTonePickerLocation,
  SuggestionMode,
  Theme
} from 'emoji-picker-react'

export default function EmojiPicker({
  onEmojiClick
}: {
  onEmojiClick: (emoji: string | TEmoji | undefined, event: MouseEvent) => void
}) {
  const { themeSetting } = useTheme()
  const { isSmallScreen } = useScreenSize()

  return (
    <EmojiPickerReact
      theme={
        themeSetting === 'system' ? Theme.AUTO : themeSetting === 'dark' ? Theme.DARK : Theme.LIGHT
      }
      width={isSmallScreen ? '100%' : 350}
      autoFocusSearch={false}
      emojiStyle={EmojiStyle.NATIVE}
      skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
      style={
        {
          '--epr-bg-color': 'hsl(var(--background))',
          '--epr-category-label-bg-color': 'hsl(var(--background))',
          '--epr-text-color': 'hsl(var(--foreground))',
          '--epr-hover-bg-color': 'hsl(var(--muted) / 0.5)',
          '--epr-picker-border-color': 'transparent',
          '--epr-search-input-bg-color': 'hsl(var(--muted) / 0.5)'
        } as React.CSSProperties
      }
      suggestedEmojisMode={SuggestionMode.FREQUENT}
      onEmojiClick={(data, e) => {
        const emoji = parseEmojiPickerUnified(data.unified)
        onEmojiClick(emoji, e)
      }}
      customEmojis={customEmojiService.getAllCustomEmojisForPicker()}
    />
  )
}
