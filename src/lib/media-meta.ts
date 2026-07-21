import { base64 } from '@scure/base'
import { rgbaToThumbHash } from 'thumbhash'

const THUMBHASH_MAX_SIZE = 100

/**
 * Read display metadata for a local media file before upload: dimensions for
 * images and videos, plus a base64 thumbhash for images. Never throws — files
 * that can't be decoded yield an empty result.
 */
export function getMediaMeta(file: File): Promise<{ dim?: string; thumbHash?: string }> {
  return new Promise((resolve) => {
    try {
      if (file.type.startsWith('image/')) {
        const img = new window.Image()
        img.onload = () => {
          const dim = `${img.naturalWidth}x${img.naturalHeight}`

          // Generate thumbhash
          const { naturalWidth: w, naturalHeight: h } = img
          const scale = Math.min(THUMBHASH_MAX_SIZE / w, THUMBHASH_MAX_SIZE / h, 1)
          const tw = Math.round(w * scale)
          const th = Math.round(h * scale)
          const canvas = document.createElement('canvas')
          canvas.width = tw
          canvas.height = th
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, tw, th)
          const pixels = ctx.getImageData(0, 0, tw, th)
          let thumbHash: string | undefined
          try {
            const hash = rgbaToThumbHash(tw, th, pixels.data)
            thumbHash = base64.encode(hash)
          } catch {
            /***/
          }

          URL.revokeObjectURL(img.src)
          resolve({ dim, thumbHash })
        }
        img.onerror = () => {
          URL.revokeObjectURL(img.src)
          resolve({})
        }
        img.src = URL.createObjectURL(file)
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = () => {
          const dim = `${video.videoWidth}x${video.videoHeight}`
          URL.revokeObjectURL(video.src)
          resolve({ dim })
        }
        video.onerror = () => {
          URL.revokeObjectURL(video.src)
          resolve({})
        }
        video.src = URL.createObjectURL(file)
      } else {
        resolve({})
      }
    } catch {
      // Non-browser environments may lack Image/createObjectURL; metadata is
      // best-effort and must never break an upload.
      resolve({})
    }
  })
}
