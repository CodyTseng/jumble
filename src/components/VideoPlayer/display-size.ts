import type { CSSProperties } from 'react'

export type VideoSize = { width: number; height: number }

export function getVideoDisplayStyle(size?: VideoSize | null): CSSProperties {
  const validSize =
    size &&
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  const ratio = validSize ? size.width / size.height : 16 / 9
  const maxHeight = ratio < 1 ? 70 : 60

  // Limit width as well as height so the container always keeps the video ratio.
  return {
    width: `min(100%, ${maxHeight * ratio}vh)`,
    aspectRatio: ratio,
    alignSelf: 'flex-start'
  }
}
