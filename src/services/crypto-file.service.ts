function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function encryptFile(
  blob: Blob
): Promise<{ encryptedBlob: Blob; key: Uint8Array; nonce: Uint8Array; originalHash: string }> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt'
  ])
  const nonce = crypto.getRandomValues(new Uint8Array(12))

  const plaintext = await blob.arrayBuffer()

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext)

  const hashBuffer = await crypto.subtle.digest('SHA-256', plaintext)
  const originalHash = bytesToHex(new Uint8Array(hashBuffer))

  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key))

  return {
    encryptedBlob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    key: rawKey,
    nonce,
    originalHash
  }
}

async function decryptFile(
  encryptedData: ArrayBuffer,
  key: Uint8Array,
  nonce: Uint8Array
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, [
    'decrypt'
  ])
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, encryptedData)
}

export default { encryptFile, decryptFile, bytesToHex, hexToBytes }
