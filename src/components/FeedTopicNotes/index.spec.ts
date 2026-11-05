// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Event } from 'nostr-tools'
import { DeletedEventProvider, useDeletedEvent } from '@/providers/DeletedEventProvider'
import FeedTopicNotes from './index'
import { TFeedTopicSnapshot } from '@/services/feed-topic.service'

vi.mock('@/lib/event', async () => await import('@/lib/event-core'))
vi.mock('@/components/NoteCard', () => ({
  default: ({ event }: { event: Event }) =>
    createElement('article', { 'data-note-id': event.id }, event.content)
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const note = (id: number): Event => ({
  id: id.toString(16).padStart(64, '0'),
  pubkey: 'ab'.repeat(32),
  created_at: id,
  kind: 1,
  tags: [],
  content: `Note ${id}`,
  sig: ''
})

function DeleteControls({ events }: { events: Event[] }) {
  const { addDeletedEvent } = useDeletedEvent()
  return createElement(
    'div',
    {},
    ...events.map((event) =>
      createElement(
        'button',
        {
          key: event.id,
          'data-delete-id': event.id,
          onClick: () => addDeletedEvent(event)
        },
        'Delete'
      )
    )
  )
}

let root: Root
let container: HTMLDivElement
async function render(snapshot: TFeedTopicSnapshot, visible = true) {
  await act(async () =>
    root.render(
      createElement(DeletedEventProvider, {
        children: [
          createElement(DeleteControls, { key: 'controls', events: snapshot.events }),
          visible ? createElement(FeedTopicNotes, { key: 'notes', snapshot }) : null
        ]
      })
    )
  )
}
async function deleteNote(event: Event) {
  await act(async () =>
    container.querySelector<HTMLButtonElement>(`[data-delete-id="${event.id}"]`)!.click()
  )
}
const displayedIds = () =>
  [...container.querySelectorAll('article')].map((node) => node.getAttribute('data-note-id'))

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('FeedTopicNotes deletion filtering', () => {
  it('removes a deleted note immediately without mutating the saved snapshot', async () => {
    const snapshot = { name: 'nostr', events: [note(1), note(2)] }
    await render(snapshot)
    await deleteNote(snapshot.events[0])
    expect(displayedIds()).toEqual([snapshot.events[1].id])
    expect(snapshot.events).toHaveLength(2)
  })

  it('filters before pagination so later notes fill the visible page', async () => {
    const snapshot = { name: 'nostr', events: Array.from({ length: 12 }, (_, i) => note(i + 1)) }
    await render(snapshot)
    await deleteNote(snapshot.events[0])
    await deleteNote(snapshot.events[1])
    expect(displayedIds()).toEqual(snapshot.events.slice(2).map((event) => event.id))
  })

  it('honors deletions made while the topic view is unmounted', async () => {
    const snapshot = { name: 'nostr', events: [note(1), note(2)] }
    await render(snapshot, false)
    await deleteNote(snapshot.events[0])
    await render(snapshot)
    expect(displayedIds()).toEqual([snapshot.events[1].id])
  })

  it('shows the empty state when every saved note is deleted', async () => {
    const snapshot = { name: 'nostr', events: [note(1)] }
    await render(snapshot)
    await deleteNote(snapshot.events[0])
    expect(displayedIds()).toEqual([])
    expect(container.textContent).toContain('No notes found')
  })
})
