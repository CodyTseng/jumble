import { registerPlugin } from '@capacitor/core'

interface NativeMediaPlugin {
  saveImage(options: {
    url?: string
    data?: string
    mimeType?: string
    filename: string
  }): Promise<{ uri: string }>
}

const NativeMedia = registerPlugin<NativeMediaPlugin>('JumbleMedia')
const MAX_IMAGE_BYTES = 50 * 1024 * 1024

/** Remote images stream through Android's network stack, avoiding WebView CORS/blob downloads. */
export async function saveNativeImage(
  url: string,
  filename: string,
  preparedBlob?: Blob
): Promise<void> {
  if (/^https?:\/\//i.test(url)) {
    await NativeMedia.saveImage({ url, filename })
    return
  }
  // Local/blob/data images cannot be fetched by the native HTTP stack.
  const blob = preparedBlob ?? (await (await fetch(url)).blob())
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('Image exceeds 50 MB')
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image'))
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(blob)
  })
  await NativeMedia.saveImage({ data, mimeType: blob.type, filename })
}
