const blobSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')!.get!
const bufferSize = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!

/** postMessage values received in the carrier belong to its realm, not the shell's. */
export function isBlob(value: unknown): value is Blob {
  try {
    blobSize.call(value)
    return true
  } catch {
    return false
  }
}

export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  try {
    bufferSize.call(value)
    return true
  } catch {
    return false
  }
}
