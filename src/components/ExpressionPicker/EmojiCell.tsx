import Emoji from '@/components/Emoji'
import { applySkinTone, TNativeEmoji } from '@/lib/native-emoji-data'
import { TEmoji, TSkinTone } from '@/types'

const cellClass =
  'flex aspect-square w-full cursor-pointer items-center justify-center rounded-md text-3xl leading-none transition-colors hover:bg-muted'

type Props = {
  onClick: (emoji: string | TEmoji) => void
} & (
  | { kind: 'native'; native: TNativeEmoji; skinTone: TSkinTone }
  | { kind: 'custom'; custom: TEmoji }
  | { kind: 'char'; char: string }
)

export default function EmojiCell(props: Props) {
  if (props.kind === 'native') {
    const char = applySkinTone(props.native, props.skinTone)
    return (
      <button
        type="button"
        title={props.native.label}
        aria-label={props.native.label}
        onClick={() => props.onClick(char)}
        className={cellClass}
      >
        <span>{char}</span>
      </button>
    )
  }
  if (props.kind === 'char') {
    return (
      <button
        type="button"
        onClick={() => props.onClick(props.char)}
        className={cellClass}
      >
        <span>{props.char}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      title={`:${props.custom.shortcode}:`}
      aria-label={props.custom.shortcode}
      onClick={() => props.onClick(props.custom)}
      className={cellClass}
    >
      <Emoji emoji={props.custom} classNames={{ img: 'size-8 rounded' }} />
    </button>
  )
}
