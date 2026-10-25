import Emoji from '@/components/Emoji'
import { applySkinTone, TNativeEmoji } from '@/lib/native-emoji-data'
import { TEmoji, TSkinTone } from '@/types'
import { useEmojiPick } from './useEmojiPick'

const cellClass =
  'flex aspect-square min-w-0 w-full touch-manipulation cursor-pointer items-center justify-center overflow-hidden rounded-md text-3xl leading-none select-none transition-colors hover:bg-muted'

type Props = {
  onClick: (emoji: string | TEmoji) => void
} & (
  | { kind: 'native'; native: TNativeEmoji; skinTone: TSkinTone }
  | { kind: 'custom'; custom: TEmoji }
  | { kind: 'char'; char: string }
)

export default function EmojiCell(props: Props) {
  const emoji =
    props.kind === 'native'
      ? applySkinTone(props.native, props.skinTone)
      : props.kind === 'char'
        ? props.char
        : props.custom
  const pickHandlers = useEmojiPick(emoji, props.onClick)
  if (props.kind === 'native') {
    return (
      <button
        type="button"
        title={props.native.label}
        aria-label={props.native.label}
        {...pickHandlers}
        className={cellClass}
      >
        <span className="pointer-events-none">{emoji as string}</span>
      </button>
    )
  }
  if (props.kind === 'char') {
    return (
      <button type="button" {...pickHandlers} className={cellClass}>
        <Emoji emoji={props.char} classNames={{ img: 'size-8', text: 'pointer-events-none' }} />
      </button>
    )
  }
  return (
    <button
      type="button"
      title={`:${props.custom.shortcode}:`}
      aria-label={props.custom.shortcode}
      {...pickHandlers}
      className={cellClass}
    >
      <Emoji emoji={props.custom} classNames={{ img: 'size-8 rounded' }} />
    </button>
  )
}
