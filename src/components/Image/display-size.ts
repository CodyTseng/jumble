export type ImageSize = { width: number; height: number }

export const INLINE_IMAGE_WIDTH = 480
const LIGHTBOX_TARGET = { width: 720, height: 540 }

export function isValidImageSize(size?: ImageSize): size is ImageSize {
  return (
    !!size &&
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  )
}

export function isSmallInlineImage(size?: ImageSize) {
  return isValidImageSize(size) && size.width < INLINE_IMAGE_WIDTH
}

export function shouldFillImageRow(size: ImageSize | undefined, rowWidth: number) {
  return (
    isValidImageSize(size) &&
    Number.isFinite(rowWidth) &&
    rowWidth > 0 &&
    size.width >= rowWidth * 0.8 &&
    size.width < rowWidth
  )
}

export function isSmallLightboxImage(size?: ImageSize) {
  return (
    isValidImageSize(size) &&
    size.width < LIGHTBOX_TARGET.width &&
    size.height < LIGHTBOX_TARGET.height
  )
}

// The target is a box to fit inside, rather than minimums on both axes.
// Never enlarge media that already fills either axis of the target box.
export function getLightboxImageSize(natural: ImageSize, pane: ImageSize): ImageSize {
  if (!isValidImageSize(natural) || !isValidImageSize(pane)) return natural
  const targetScale = Math.min(
    LIGHTBOX_TARGET.width / natural.width,
    LIGHTBOX_TARGET.height / natural.height
  )
  const fitScale = Math.min(pane.width / natural.width, pane.height / natural.height)
  const scale = Math.min(fitScale, Math.max(1, targetScale))
  return { width: natural.width * scale, height: natural.height * scale }
}

export function getImageMaxZoom(natural: ImageSize, display: ImageSize, pixelRatio = 1) {
  if (!isValidImageSize(natural) || !isValidImageSize(display)) return 1
  return Math.max(1, (natural.width * pixelRatio) / display.width)
}
