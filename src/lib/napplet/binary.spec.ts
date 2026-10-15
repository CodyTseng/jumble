import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { isArrayBuffer, isBlob } from './binary'
import { intentMessageBytes } from './vendor/runtime/src/intent-session'

it('recognizes cross-realm buffers and accounts for their actual byte length', () => {
  const buffer: ArrayBuffer = runInNewContext('new ArrayBuffer(2 * 1024 * 1024)')
  expect(buffer instanceof ArrayBuffer).toBe(false)
  expect(isArrayBuffer(buffer)).toBe(true)
  expect(() => intentMessageBytes({ type: 'intent.invoke', payload: buffer })).toThrow('too large')
})

it('rejects spoofed binary objects without trusting user-defined properties', () => {
  for (const value of [
    null,
    {},
    { size: 1, type: 'image/png', [Symbol.toStringTag]: 'Blob' },
    { byteLength: 1, [Symbol.toStringTag]: 'ArrayBuffer' },
    new Uint8Array(1)
  ]) {
    expect(isBlob(value)).toBe(false)
    expect(isArrayBuffer(value)).toBe(false)
  }
  expect(isBlob(new Blob(['file']))).toBe(true)
  expect(isArrayBuffer(new ArrayBuffer(1))).toBe(true)
})
