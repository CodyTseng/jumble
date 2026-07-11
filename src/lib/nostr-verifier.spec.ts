import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure'
import { describe, expect, it } from 'vitest'
import { initializeNostrVerifier, verifyEvent } from './nostr-verifier'

describe('nostr verifier', () => {
  it('uses the pure-JS verifier before WASM initialization finishes', () => {
    const event = finalizeEvent(
      {
        kind: 1,
        created_at: 1,
        tags: [],
        content: 'fallback'
      },
      generateSecretKey()
    )

    expect(verifyEvent(JSON.parse(JSON.stringify(event)))).toBe(true)
  })

  it('verifies valid events with WASM and rejects modified events', async () => {
    await expect(initializeNostrVerifier()).resolves.toBe(true)

    const event = finalizeEvent(
      {
        kind: 1,
        created_at: 1,
        tags: [],
        content: 'test'
      },
      generateSecretKey()
    )

    expect(verifyEvent(event)).toBe(true)

    const modifiedEvent = JSON.parse(JSON.stringify(event))
    modifiedEvent.content = 'modified'
    expect(verifyEvent(modifiedEvent)).toBe(false)
  })
})
