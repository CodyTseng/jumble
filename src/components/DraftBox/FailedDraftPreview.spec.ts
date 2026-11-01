// @vitest-environment jsdom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Event } from 'nostr-tools'
import { afterEach, expect, it, vi } from 'vitest'
import FailedDraftPreview from './FailedDraftPreview'

vi.mock('../Note', () => ({
  default: ({ event }: { event: Event }) => {
    // Match the tag access in the full note renderer.
    event.tags.find(([name]) => name === 'e')
    return createElement('article', null, event.content)
  }
}))

afterEach(() => vi.restoreAllMocks())

it('keeps failed draft content and outbox actions accessible when the preview throws', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const container = document.createElement('div')
  const root = createRoot(container)
  const event = { id: 'broken', content: 'Unsent message' } as Event
  try {
    await act(async () => {
      root.render(
        createElement(
          'div',
          null,
          createElement(FailedDraftPreview, { event }),
          createElement('button', null, 'Retry'),
          createElement('button', null, 'Delete')
        )
      )
    })
    expect(container.textContent).toContain('Unsent message')
    expect(container.querySelector('[dir="auto"]')).not.toBeNull()
    expect(container.querySelectorAll('button')).toHaveLength(2)

    // Replacing the failed event allows the full preview to recover.
    await act(async () => {
      root.render(
        createElement(FailedDraftPreview, {
          event: { ...event, id: 'valid', tags: [], pubkey: 'a'.repeat(64), kind: 1, created_at: 1 }
        })
      )
    })
    expect(container.querySelector('article')?.textContent).toBe('Unsent message')
  } finally {
    await act(async () => root.unmount())
  }
})
