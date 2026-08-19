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
 * The one exception is the EXIF Orientation tag: cameras and phones commonly
 * store photos in a fixed sensor orientation and rely on this tag to display
 * them upright. Dropping it along with the rest of the metadata would leave the
 * un-rotated pixels with nothing to rotate them, so the image shows up
 * sideways. We therefore extract the orientation first and re-inject a minimal
 * metadata block that carries *only* it — orientation is not sensitive (it
 * reveals neither location nor device), so this preserves correct display
 * without leaking anything. See `buildOrientationTiff`.
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
    return new File([new Uint8Array(stripped)], file.name, {
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
 * Read the EXIF Orientation tag (0x0112) from a raw TIFF block — the bytes that
 * follow "Exif\0\0" in a JPEG APP1 segment, or the payload of a PNG eXIf / WebP
 * EXIF chunk, which are all the same little-/big-endian TIFF structure.
 * Returns the orientation value (1-8) or null if it is absent or invalid.
 */
function readOrientationFromTiff(tiff: Uint8Array): number | null {
  if (tiff.length < 8) {
    return null
  }
  let little: boolean
  if (tiff[0] === 0x49 && tiff[1] === 0x49) {
    little = true // 'II' — little-endian
  } else if (tiff[0] === 0x4d && tiff[1] === 0x4d) {
    little = false // 'MM' — big-endian
  } else {
    return null
  }
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  if (view.getUint16(2, little) !== 0x002a) {
    return null
  }
  const ifdOffset = view.getUint32(4, little)
  if (ifdOffset + 2 > tiff.length) {
    return null
  }
  const count = view.getUint16(ifdOffset, little)
  let pos = ifdOffset + 2
  for (let i = 0; i < count; i++) {
    if (pos + 12 > tiff.length) {
      return null
    }
    if (view.getUint16(pos, little) === 0x0112) {
      // SHORT value, left-justified in the 4-byte value field at pos + 8.
      const value = view.getUint16(pos + 8, little)
      return value >= 1 && value <= 8 ? value : null
    }
    pos += 12
  }
  return null
}

/**
 * Build a minimal big-endian TIFF/EXIF block carrying only the Orientation tag.
 * This is the payload shared by every format's metadata container, so the
 * format-specific helpers just wrap it (JPEG APP1, PNG eXIf, WebP EXIF).
 */
function buildOrientationTiff(orientation: number): Uint8Array {
  const tiff = new Uint8Array(26)
  const view = new DataView(tiff.buffer)
  tiff[0] = 0x4d // 'MM' — big-endian
  tiff[1] = 0x4d
  view.setUint16(2, 0x002a, false) // TIFF magic
  view.setUint32(4, 8, false) // IFD0 starts right after the 8-byte header
  view.setUint16(8, 1, false) // one entry
  view.setUint16(10, 0x0112, false) // tag: Orientation
  view.setUint16(12, 3, false) // type: SHORT
  view.setUint32(14, 1, false) // count: 1
  view.setUint16(18, orientation, false) // value (left-justified in 4-byte field)
  view.setUint32(22, 0, false) // next IFD offset: none
  return tiff
}

/**
 * Strip a JPEG by dropping the marker segments that carry sensitive metadata:
 * APP1 (EXIF/GPS, XMP), APP13 (Photoshop/IPTC) and COM (free-text comment).
 * APP0 (JFIF), APP2 (ICC profile) and other segments are kept so colors and
 * structure are preserved. The EXIF Orientation tag is extracted before APP1 is
 * dropped and re-injected as a minimal APP1 so the image stays upright.
 */
function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const DROP = new Set([0xe1, 0xed, 0xfe])
  const keep: [number, number][] = [[0, 2]] // SOI
  let orientation: number | null = null

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
    // Before discarding APP1, salvage the orientation if this is an EXIF block.
    if (marker === 0xe1) {
      const found = readJpegApp1Orientation(bytes, pos + 4, segEnd)
      if (found !== null) {
        orientation = found
      }
    }
    if (!DROP.has(marker)) {
      keep.push([pos, segEnd])
    }
    pos = segEnd
  }

  const out = assemble(bytes, keep)
  if (orientation === null || orientation === 1) {
    return out
  }
  // Re-insert a minimal EXIF APP1 right after the SOI marker.
  const app1 = buildJpegOrientationApp1(orientation)
  const merged = new Uint8Array(out.length + app1.length)
  merged.set(out.subarray(0, 2), 0) // SOI
  merged.set(app1, 2)
  merged.set(out.subarray(2), 2 + app1.length)
  return merged
}

/**
 * Read the Orientation tag from a JPEG APP1 segment if it is an EXIF block.
 * `contentStart` points at the "Exif\0\0" header (just after the length field);
 * `segEnd` is the end of the segment.
 */
function readJpegApp1Orientation(
  bytes: Uint8Array,
  contentStart: number,
  segEnd: number
): number | null {
  if (
    segEnd - contentStart < 6 ||
    bytes[contentStart] !== 0x45 || // 'E'
    bytes[contentStart + 1] !== 0x78 || // 'x'
    bytes[contentStart + 2] !== 0x69 || // 'i'
    bytes[contentStart + 3] !== 0x66 || // 'f'
    bytes[contentStart + 4] !== 0x00 ||
    bytes[contentStart + 5] !== 0x00
  ) {
    return null
  }
  return readOrientationFromTiff(bytes.subarray(contentStart + 6, segEnd))
}

/** Wrap a minimal orientation TIFF in a JPEG APP1 (EXIF) segment. */
function buildJpegOrientationApp1(orientation: number): Uint8Array {
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] // "Exif\0\0"
  const tiff = buildOrientationTiff(orientation)
  const payloadLen = exifHeader.length + tiff.length
  const seg = new Uint8Array(4 + payloadLen) // marker (2) + length (2) + payload
  seg[0] = 0xff
  seg[1] = 0xe1
  // The length field counts itself plus the payload, but not the marker.
  new DataView(seg.buffer).setUint16(2, 2 + payloadLen, false)
  seg.set(exifHeader, 4)
  seg.set(tiff, 4 + exifHeader.length)
  return seg
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Strip a PNG by dropping the ancillary chunks that carry metadata: eXIf,
 * tEXt/iTXt/zTXt (text, may hold descriptions or GPS) and tIME. Color, gamma
 * and structural chunks are kept. The EXIF Orientation is extracted from the
 * eXIf chunk before it is dropped and re-injected as a minimal eXIf chunk.
 */
function stripPng(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'])
  const keep: [number, number][] = [[0, 8]] // signature
  let orientation: number | null = null

  let pos = 8
  while (pos + 12 <= bytes.length) {
    const dataLen = view.getUint32(pos)
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7])
    const chunkEnd = pos + 12 + dataLen
    if (chunkEnd > bytes.length) {
      return null
    }
    if (type === 'eXIf') {
      const found = readOrientationFromTiff(bytes.subarray(pos + 8, pos + 8 + dataLen))
      if (found !== null) {
        orientation = found
      }
    }
    if (!DROP.has(type)) {
      keep.push([pos, chunkEnd])
    }
    pos = chunkEnd
    if (type === 'IEND') {
      break
    }
  }

  const out = assemble(bytes, keep)
  if (orientation === null || orientation === 1) {
    return out
  }
  // Re-insert a minimal eXIf chunk just before the trailing IEND chunk
  // (a fixed 12 bytes: length 0 + "IEND" + CRC). Bail out if it is not there.
  const cut = out.length - 12
  if (
    cut < 8 ||
    out[cut + 4] !== 0x49 || // 'I'
    out[cut + 5] !== 0x45 || // 'E'
    out[cut + 6] !== 0x4e || // 'N'
    out[cut + 7] !== 0x44 // 'D'
  ) {
    return out
  }
  const chunk = buildPngOrientationChunk(orientation)
  const merged = new Uint8Array(out.length + chunk.length)
  merged.set(out.subarray(0, cut), 0)
  merged.set(chunk, cut)
  merged.set(out.subarray(cut), cut + chunk.length)
  return merged
}

/** Wrap a minimal orientation TIFF in a PNG eXIf chunk (with CRC). */
function buildPngOrientationChunk(orientation: number): Uint8Array {
  const tiff = buildOrientationTiff(orientation)
  const chunk = new Uint8Array(12 + tiff.length) // length (4) + type (4) + data + CRC (4)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, tiff.length, false)
  chunk[4] = 0x65 // 'e'
  chunk[5] = 0x58 // 'X'
  chunk[6] = 0x49 // 'I'
  chunk[7] = 0x66 // 'f'
  chunk.set(tiff, 8)
  // CRC covers the chunk type and data, not the length.
  view.setUint32(8 + tiff.length, crc32(chunk.subarray(4, 8 + tiff.length)), false)
  return chunk
}

let CRC_TABLE: Uint32Array | null = null

/** Standard PNG/zlib CRC-32 over a byte range. */
function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      CRC_TABLE[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Strip a WebP by dropping the EXIF and XMP chunks from the RIFF container.
 * The RIFF size field and the VP8X feature flags are updated to match. The EXIF
 * Orientation is extracted before the EXIF chunk is dropped and re-injected as
 * a minimal EXIF chunk, with the VP8X EXIF feature flag kept set.
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
  let droppedAny = false
  let orientation: number | null = null

  let pos = 12
  while (pos + 8 <= bytes.length) {
    const fourcc = ascii(pos, 4)
    const size = view.getUint32(pos + 4, true) // little-endian
    const chunkEnd = pos + 8 + size + (size & 1) // chunks are padded to even size
    if (chunkEnd > bytes.length) {
      return null
    }
    if (DROP.has(fourcc)) {
      droppedAny = true
      if (fourcc === 'EXIF') {
        const found = readOrientationFromTiff(bytes.subarray(pos + 8, pos + 8 + size))
        if (found !== null) {
          orientation = found
        }
      }
    } else {
      keep.push([pos, chunkEnd])
    }
    pos = chunkEnd
  }
  if (!droppedAny) {
    return bytes
  }

  const reinject = orientation !== null && orientation !== 1
  let out = assemble(bytes, keep)
  if (reinject) {
    // Append a minimal EXIF chunk after the kept chunks (spec puts it near the
    // end). The 26-byte TIFF payload is even, so no padding byte is needed.
    const tiff = buildOrientationTiff(orientation as number)
    const chunk = new Uint8Array(8 + tiff.length)
    chunk[0] = 0x45 // 'E'
    chunk[1] = 0x58 // 'X'
    chunk[2] = 0x49 // 'I'
    chunk[3] = 0x46 // 'F'
    new DataView(chunk.buffer).setUint32(4, tiff.length, true)
    chunk.set(tiff, 8)
    const merged = new Uint8Array(out.length + chunk.length)
    merged.set(out, 0)
    merged.set(chunk, out.length)
    out = merged
  }

  const outView = new DataView(out.buffer)
  // RIFF size field = total file size minus the 8-byte 'RIFF' + size header.
  outView.setUint32(4, out.length - 8, true)
  // VP8X, when present, is always the first chunk. Align its EXIF (0x08) and
  // XMP (0x04) feature-flag bits with the chunks now present.
  if (
    out.length >= 21 &&
    out[12] === 0x56 && // 'V'
    out[13] === 0x50 && // 'P'
    out[14] === 0x38 && // '8'
    out[15] === 0x58 // 'X'
  ) {
    out[20] &= ~0x0c // clear EXIF + XMP
    if (reinject) {
      out[20] |= 0x08 // keep EXIF flag for the re-injected orientation chunk
    }
  }
  return out
}
