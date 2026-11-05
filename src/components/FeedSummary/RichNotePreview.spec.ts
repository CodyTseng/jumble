// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Event } from 'nostr-tools'
import { useNotePreview } from '@/providers/NotePreviewProvider'
import RichNotePreview from './RichNotePreview'

vi.mock('@/components/NoteContent', () => ({
  default: function MockNoteContent({ event }: { event: Event }) {
    const preview = useNotePreview()
    return createElement('div', { 'data-compact-preview': String(preview) }, event.content)
  }
}))

const event: Event = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  kind: 1,
  content: 'Rich content',
  tags: [],
  created_at: 1,
  sig: ''
}
let root: Root
let container: HTMLDivElement
let height = 80
const observers = new Set<() => void>()
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  height = 80
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(192)
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => height)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: () => void) {
        observers.add(callback)
      }
      observe() {}
      disconnect() {
        observers.delete(this.callback)
      }
    }
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function render() {
  await act(async () => root.render(createElement(RichNotePreview, { event })))
}

describe('RichNotePreview', () => {
  it('uses the shared note renderer in compact read-only mode', async () => {
    await render()
    expect(container.querySelector('[data-compact-preview="true"]')?.textContent).toBe(
      event.content
    )
    expect(container.querySelector('[inert]')).not.toBeNull()
    expect(container.firstElementChild?.className).toContain('max-h-48')
  })

  it('keeps short notes fully opaque', async () => {
    await render()
    expect(container.firstElementChild?.className).not.toContain('mask-image')
  })

  it('fades only overflowing content and responds to image loads and resizing', async () => {
    await render()
    await act(async () => {
      height = 400
      observers.forEach((measure) => measure())
    })
    expect(container.firstElementChild?.className).toContain('mask-image')
    await act(async () => {
      height = 100
      observers.forEach((measure) => measure())
    })
    expect(container.firstElementChild?.className).not.toContain('mask-image')
  })
})
