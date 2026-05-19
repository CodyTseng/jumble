// Image MIME types whose metadata we know how to strip at the byte level.
const STRIPPERS: Record<string, (bytes: Uint8Array) => Uint8Array | null> = {
  'image/jpeg': stripJpeg,
  'image/png': stripPng,
  'image/webp': stripWebp
}

/**
 * Remove potentially sensitive metadata (EXIF/GPS, XMP, IPTC, comments, ...)
 * from an image file before it is uploaded.
 *
 * Metadata is stripped by editing the file's byte stream directly — dropping
 * the relevant marker segments / chunks — rather than re-encoding through a
 * <canvas>. This keeps the pixels bit-for-bit identical (lossless) and,
 * crucially, works in privacy browsers such as Tor, whose canvas
 * fingerprinting resistance corrupts any canvas read-back and would otherwise
 * turn the uploaded image into garbage.
 *
 * Unsupported or malformed files are returned unchanged so uploads never break.
 */
export async function stripImageMetadata(file: File): Promise<File> {
  const stripper = STRIPPERS[file.type]
  if (!stripper) {
    return file
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const stripped = stripper(bytes)
    // null => malformed/unrecognized layout; equal length => nothing removed.
    // In both cases keep the original file untouched.
    if (!stripped || stripped.length === bytes.length) {
      return file
    }
    return new File([stripped], file.name, {
      type: file.type,
      lastModified: file.lastModified
    })
  } catch {
    return file
  }
}

/** Concatenate the given byte ranges of `bytes` into a new array. */
function assemble(bytes: Uint8Array, ranges: [number, number][]): Uint8Array {
  let total = 0
  for (const [start, end] of ranges) {
    total += end - start
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const [start, end] of ranges) {
    out.set(bytes.subarray(start, end), offset)
    offset += end - start
  }
  return out
}

/**
 * Strip a JPEG by dropping the marker segments that carry sensitive metadata:
 * APP1 (EXIF/GPS, XMP), APP13 (Photoshop/IPTC) and COM (free-text comment).
 * APP0 (JFIF), APP2 (ICC profile) and other segments are kept so colors and
 * structure are preserved.
 */
function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const DROP = new Set([0xe1, 0xed, 0xfe])
  const keep: [number, number][] = [[0, 2]] // SOI

  let pos = 2
  while (pos + 1 < bytes.length) {
    if (bytes[pos] !== 0xff) {
      return null
    }
    // Collapse 0xFF fill bytes between segments.
    if (bytes[pos + 1] === 0xff) {
      pos++
      continue
    }
    const marker = bytes[pos + 1]
    // Start of Scan: entropy-coded image data follows to the end; copy verbatim.
    if (marker === 0xda) {
      keep.push([pos, bytes.length])
      break
    }
    if (pos + 4 > bytes.length) {
      return null
    }
    const segLen = view.getUint16(pos + 2)
    const segEnd = pos + 2 + segLen
    if (segLen < 2 || segEnd > bytes.length) {
      return null
    }
    if (!DROP.has(marker)) {
      keep.push([pos, segEnd])
    }
    pos = segEnd
  }

  return assemble(bytes, keep)
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Strip a PNG by dropping the ancillary chunks that carry metadata: eXIf,
 * tEXt/iTXt/zTXt (text, may hold descriptions or GPS) and tIME. Color, gamma
 * and structural chunks are kept.
 */
function stripPng(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'])
  const keep: [number, number][] = [[0, 8]] // signature

  let pos = 8
  while (pos + 12 <= bytes.length) {
    const dataLen = view.getUint32(pos)
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7])
    const chunkEnd = pos + 12 + dataLen
    if (chunkEnd > bytes.length) {
      return null
    }
    if (!DROP.has(type)) {
      keep.push([pos, chunkEnd])
    }
    pos = chunkEnd
    if (type === 'IEND') {
      break
    }
  }

  return assemble(bytes, keep)
}

/**
 * Strip a WebP by dropping the EXIF and XMP chunks from the RIFF container.
 * The RIFF size field and the VP8X feature flags are updated to match.
 */
function stripWebp(bytes: Uint8Array): Uint8Array | null {
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length))
  if (bytes.length < 12 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const DROP = new Set(['EXIF', 'XMP '])
  const keep: [number, number][] = [[0, 12]] // RIFF header + 'WEBP'

  let pos = 12
  let droppedAny = false
  while (pos + 8 <= bytes.length) {
    const fourcc = ascii(pos, 4)
    const size = view.getUint32(pos + 4, true) // little-endian
    const chunkEnd = pos + 8 + size + (size & 1) // chunks are padded to even size
    if (chunkEnd > bytes.length) {
      return null
    }
    if (DROP.has(fourcc)) {
      droppedAny = true
    } else {
      keep.push([pos, chunkEnd])
    }
    pos = chunkEnd
  }
  if (!droppedAny) {
    return bytes
  }

  const out = assemble(bytes, keep)
  const outView = new DataView(out.buffer)
  // RIFF size field = total file size minus the 8-byte 'RIFF' + size header.
  outView.setUint32(4, out.length - 8, true)
  // VP8X, when present, is always the first chunk. Clear its EXIF (0x08) and
  // XMP (0x04) feature-flag bits so they match the chunks now present.
  if (out.length >= 21 && ascii(12, 4) === 'VP8X') {
    out[20] &= ~0x0c
  }
  return out
}
