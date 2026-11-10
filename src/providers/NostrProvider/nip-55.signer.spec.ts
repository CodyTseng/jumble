import { beforeEach, describe, expect, it, vi } from 'vitest'
import { finalizeEvent, generateSecretKey, getPublicKey, type EventTemplate } from 'nostr-tools'

const native = vi.hoisted(() => ({ request: vi.fn(), android: true }))
vi.mock('@/lib/native-signer', () => ({ requestNativeSignature: native.request }))
vi.mock('@/lib/platform', () => ({ isAndroid: () => native.android }))
import { Nip55Signer } from './nip-55.signer'

const secret = generateSecretKey()
const pubkey = getPublicKey(secret)
const packageName = 'com.greenart7c3.nostrsigner'
const draft: EventTemplate = { kind: 1, content: 'Hello #nostr? مرحبا', created_at: 123, tags: [] }

beforeEach(() => {
  native.request.mockReset()
  native.android = true
})

describe('NIP-55 signer', () => {
  it('stores the selected signer identity and restores without another authorization', async () => {
    native.request.mockResolvedValue({ result: pubkey, packageName })
    const signer = await Nip55Signer.login()
    expect(await signer.getPublicKey()).toBe(pubkey)
    expect(signer.packageName).toBe(packageName)
    expect(native.request).toHaveBeenCalledWith({ type: 'get_public_key', payload: '' })
    native.request.mockClear()
    expect(await new Nip55Signer(pubkey, packageName).getPublicKey()).toBe(pubkey)
    expect(native.request).not.toHaveBeenCalled()
  })

  it('rejects unsupported runtimes and malformed stored identities', async () => {
    expect(() => new Nip55Signer('npub-invalid', packageName)).toThrow('Invalid')
    expect(() => new Nip55Signer(pubkey, 'invalid/package')).toThrow('Invalid')
    native.android = false
    expect(() => new Nip55Signer(pubkey, packageName)).toThrow('Android app')
  })

  it.each([true, false])(
    'verifies signed events including signature-only responses (%s)',
    async (full) => {
      const event = finalizeEvent(draft, secret)
      native.request.mockResolvedValue({
        result: event.sig,
        ...(full ? { event: JSON.stringify(event) } : {})
      })
      const signed = await new Nip55Signer(pubkey, packageName).signEvent(draft)
      expect(signed.id).toBe(event.id)
      expect(signed.sig).toBe(event.sig)
      expect(native.request).toHaveBeenCalledWith({
        type: 'sign_event',
        payload: JSON.stringify({ ...draft, pubkey, id: event.id }),
        packageName,
        currentUser: pubkey,
        pubkey: undefined
      })
    }
  )

  it('rejects a valid signature for changed content or a different account', async () => {
    const signer = new Nip55Signer(pubkey, packageName)
    for (const event of [
      finalizeEvent({ ...draft, content: 'changed' }, secret),
      finalizeEvent(draft, generateSecretKey())
    ]) {
      native.request.mockResolvedValue({ result: event.sig, event: JSON.stringify(event) })
      await expect(signer.signEvent(draft)).rejects.toThrow('invalid signed event')
    }
    native.request.mockResolvedValue({ result: '0'.repeat(128) })
    await expect(signer.signEvent(draft)).rejects.toThrow('invalid signed event')
  })

  it.each([
    ['nip04Encrypt', 'nip04_encrypt'],
    ['nip04Decrypt', 'nip04_decrypt'],
    ['nip44Encrypt', 'nip44_encrypt'],
    ['nip44Decrypt', 'nip44_decrypt']
  ] as const)('routes %s to the stored package and current account', async (method, type) => {
    native.request.mockResolvedValue({ result: '' })
    expect(await new Nip55Signer(pubkey, packageName)[method](pubkey, 'payload')).toBe('')
    expect(native.request).toHaveBeenCalledWith({
      type,
      payload: 'payload',
      pubkey,
      packageName,
      currentUser: pubkey
    })
  })

  it('propagates rejection without treating it as an empty decryption', async () => {
    native.request.mockRejectedValue(new Error('Rejected'))
    await expect(
      new Nip55Signer(pubkey, packageName).nip44Decrypt(pubkey, 'ciphertext')
    ).rejects.toThrow('Rejected')
  })
})
