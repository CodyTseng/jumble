// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Event, nip19 } from 'nostr-tools'
import FeedSummary, { FeedSummaryScope } from './index'
import { TFeedSummaryItem } from '@/lib/feed-summary'
import feedTopicService from '@/services/feed-topic.service'

const state = vi.hoisted(() => ({
  active: true,
  singleColumn: true,
  wide: true,
  showFeedTopics: true,
  showFeedPopularNotes: true,
  fetchEvent: vi.fn(),
  push: vi.fn(),
  muted: new Set<string>(),
  deleted: new Set<string>(),
  replyCounts: new Map<string, number>(),
  threadRevision: 0,
  threadListeners: new Set<() => void>()
}))
vi.mock('@/components/UserAvatar', () => ({ SimpleUserAvatar: () => null }))
vi.mock('./RichNotePreview', () => ({
  default: ({ event }: { event: Event }) =>
    createElement(
      'div',
      {},
      event.content || event.tags.find(([name]) => name === 'title')?.[1] || 'Rendered note'
    )
}))
vi.mock('@/hooks/useFetchProfile', () => ({
  useFetchProfile: () => ({ profile: { username: 'Author' } })
}))
vi.mock('@/PageManager', () => ({ useSecondaryPage: () => ({ push: state.push }) }))
vi.mock('@/lib/link', () => ({
  toNote: (event: Event | string) => `/notes/${typeof event === 'string' ? event : event.id}`,
  toFeedTopic: (snapshotId: string) => `/notes?feed-topic=${snapshotId}`
}))
vi.mock('@/services/client.service', () => ({ default: { fetchEvent: state.fetchEvent } }))
vi.mock('@/services/thread.service', () => ({
  default: {
    getRevision: () => state.threadRevision,
    getLoadedReplyCount: (key: string) => state.replyCounts.get(key) ?? 0,
    listenChanges: (listener: () => void) => {
      state.threadListeners.add(listener)
      return () => {
        state.threadListeners.delete(listener)
      }
    }
  }
}))
vi.mock('@/providers/PageActiveProvider', () => ({ usePageActive: () => state.active }))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: false })
}))
vi.mock('@/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => ({
    enableSingleColumnLayout: state.singleColumn,
    showFeedTopics: state.showFeedTopics,
    updateShowFeedTopics: (show: boolean) => {
      state.showFeedTopics = show
    },
    showFeedPopularNotes: state.showFeedPopularNotes,
    updateShowFeedPopularNotes: (show: boolean) => {
      state.showFeedPopularNotes = show
    }
  })
}))
vi.mock('@/providers/ContentPolicyProvider', () => ({
  useContentPolicy: () => ({
    nsfwDisplayPolicy: 'hide_content',
    hideContentMentioningMutedUsers: true
  })
}))
vi.mock('@/providers/DeletedEventProvider', () => ({
  useDeletedEvent: () => ({ isEventDeleted: (event: Event) => state.deleted.has(event.id) })
}))
vi.mock('@/providers/MuteListProvider', () => ({
  useMuteList: () => ({ mutePubkeySet: state.muted, mutedWords: [] })
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values: Record<string, string> = {}) =>
      key.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? ''),
    i18n: { resolvedLanguage: 'en' }
  })
}))

const hex = (n: number) => n.toString(16).padStart(64, '0')
const make = (id: number, pubkey: number, tags: string[][] = [], content = ''): Event => ({
  id: hex(id),
  pubkey: hex(pubkey),
  created_at: id,
  kind: 1,
  tags,
  content,
  sig: ''
})
function quotedTargets(from: number, to: number): TFeedSummaryItem[] {
  return Array.from({ length: to - from }, (_, i) => i + from).flatMap((id) => [
    { event: make(id * 10 + 1000, 1, [['q', hex(id)]]) },
    { event: make(id * 10 + 1001, 2, [['q', hex(id)]]) },
    { event: make(id * 10 + 1002, 3, [['q', hex(id)]]) }
  ])
}
let root: Root
let container: HTMLDivElement
async function render(items: TFeedSummaryItem[], scopeKey = 'feed') {
  await act(async () => {
    root.render(
      createElement(FeedSummaryScope, {
        children: createElement(FeedSummary, { items, scopeKey })
      })
    )
  })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  state.active = true
  state.singleColumn = true
  state.wide = true
  state.showFeedTopics = true
  state.showFeedPopularNotes = true
  state.muted.clear()
  state.deleted.clear()
  state.replyCounts.clear()
  state.threadRevision = 0
  state.push.mockReset()
  state.fetchEvent.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('matchMedia', () => ({
    matches: state.wide,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('FeedSummary', () => {
  it('promotes a loaded note when cached replies arrive without querying events', async () => {
    const event = make(100, 10, [], 'Reply-driven popular note')
    await render([{ event }])
    expect(container.querySelector('aside')).toBeNull()
    await act(async () => {
      state.replyCounts.set(event.id, 3)
      state.threadRevision++
      state.threadListeners.forEach((listener) => listener())
    })
    expect(container.textContent).toContain('Reply-driven popular note')
    expect(state.fetchEvent).not.toHaveBeenCalled()
  })

  it('updates weighted rankings when loaded reply counts change', async () => {
    const a = make(100, 10, [], 'Shared note')
    const b = make(101, 11, [], 'Replied note')
    state.replyCounts.set(b.id, 3)
    await render([{ event: a, reposters: [hex(1), hex(2)] }, { event: b }])
    const content = () => container.querySelector('[aria-label="Trending Notes"]')!.textContent!
    expect(content().indexOf('Replied note')).toBeLessThan(content().indexOf('Shared note'))
    await act(async () => {
      state.replyCounts.set(a.id, 10)
      state.threadRevision++
      state.threadListeners.forEach((listener) => listener())
    })
    expect(content().indexOf('Shared note')).toBeLessThan(content().indexOf('Replied note'))
    expect(state.fetchEvent).not.toHaveBeenCalled()
  })

  it('hides topics independently while keeping popular notes visible', async () => {
    state.showFeedTopics = false
    await render([
      ...[1, 2].map((id) => ({ event: make(id, id, [], '#nostr') })),
      { event: make(100, 10, [], 'Popular note'), reposters: [hex(1), hex(2)] }
    ])
    expect(container.querySelector('[aria-label="Feed topics"]')).toBeNull()
    expect(container.querySelector('[aria-label="Trending Notes"]')).not.toBeNull()
  })

  it('stops popular-note lookups when disabled and resumes when enabled', async () => {
    state.showFeedPopularNotes = false
    const items = [
      ...[1, 2].map((id) => ({ event: make(id, id, [], '#nostr') })),
      ...quotedTargets(10, 11)
    ]
    await render(items)
    expect(container.querySelector('[aria-label="Feed topics"]')).not.toBeNull()
    expect(state.fetchEvent).not.toHaveBeenCalled()
    state.showFeedPopularNotes = true
    await render(items)
    expect(state.fetchEvent).toHaveBeenCalledTimes(1)
  })

  it('does not render or fetch when both sections are disabled', async () => {
    state.showFeedTopics = false
    state.showFeedPopularNotes = false
    await render(quotedTargets(1, 8))
    expect(container.querySelector('aside')).toBeNull()
    expect(state.fetchEvent).not.toHaveBeenCalled()
  })

  it('hides single-author topics and skips lookups for notes shared by only one person', async () => {
    await render([
      { event: make(1, 1, [], '#small') },
      { event: make(2, 1, [], '#small') },
      { event: make(3, 1, [['q', hex(100)]]) },
      { event: make(4, 1, [['q', hex(100)]]) }
    ])
    expect(container.querySelector('aside')).toBeNull()
    expect(state.fetchEvent).not.toHaveBeenCalled()
  })

  it('shows popular notes with one reposter and one different quoter', async () => {
    await render([
      { event: make(100, 10, [], 'Shared note'), reposters: [hex(1)] },
      { event: make(101, 2, [['q', hex(100)]]) }
    ])
    expect(container.querySelector('[aria-label="Trending Notes"]')).not.toBeNull()
    expect(container.textContent).toContain('Shared note')
    expect(container.textContent).toBe('Trending NotesAuthorShared note')
    expect(container.textContent).toContain('Author')
    expect(state.fetchEvent).not.toHaveBeenCalled()
  })

  it('counts a person who both reposts and quotes only once', async () => {
    await render([
      { event: make(100, 10, [], 'Shared note'), reposters: [hex(1)] },
      { event: make(101, 1, [['q', hex(100)]]) }
    ])
    expect(container.querySelector('aside')).toBeNull()
    expect(state.fetchEvent).not.toHaveBeenCalled()
  })

  it.each([
    ['https://example.com/photo.jpg', [], 1],
    ['https://example.com/one.jpg https://example.com/two.png', [], 1],
    ['https://example.com/hash', [['imeta', 'url https://example.com/hash', 'm image/jpeg']], 1],
    ['https://example.com/hash', [['image', 'https://example.com/hash']], 1],
    ['https://example.com/hash', [['imeta', 'url https://example.com/hash']], 20],
    ['', [], 20]
  ] as [string, string[][], number][])(
    'keeps an image-aware accessible label for rich previews (%s)',
    async (url, tags, kind) => {
      await render([{ event: { ...make(100, 10, tags, url), kind }, reposters: [hex(1), hex(2)] }])
      const section = container.querySelector('[aria-label="Trending Notes"]')!
      const label = section.querySelector('[role="link"]')!.getAttribute('aria-label')
      expect(label).toContain('[Image]')
      if (url) for (const part of url.split(/\s+/)) expect(label).not.toContain(part)
      expect(state.fetchEvent).not.toHaveBeenCalled()
    }
  )

  it('keeps videos as media and ordinary links as links', async () => {
    await render([
      {
        event: make(100, 10, [], 'https://example.com/video.mp4 https://example.com/article'),
        reposters: [hex(1), hex(2)]
      }
    ])
    const section = container.querySelector('[aria-label="Trending Notes"]')!
    const label = section.querySelector('[role="link"]')!.getAttribute('aria-label')
    expect(label).toContain('[Media]')
    expect(label).toContain('https://example.com/article')
    expect(label).not.toContain('[Image]')
  })

  it('shows a topic when two different authors participate', async () => {
    await render([1, 2].map((id) => ({ event: make(id, id, [], '#nostr') })))
    expect(container.querySelector('[aria-label="Feed topics"]')).not.toBeNull()
    expect(container.textContent).toBe('Feed topics#nostr2')
    expect(state.fetchEvent).not.toHaveBeenCalled()
  })

  it('shows a compact topic row and hides the empty popular-notes section', async () => {
    await render([1, 2, 3].map((id) => ({ event: make(id, id, [], '#nostr') })))
    expect(container.querySelector('[aria-label="Feed topics"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Trending Notes"]')).toBeNull()
    expect(container.textContent).toBe('Feed topics#nostr3')
  })

  it('hides empty topics and waits for actual note content before showing popular notes', async () => {
    let resolve!: (event: Event) => void
    state.fetchEvent.mockImplementation(
      () =>
        new Promise<Event>((done) => {
          resolve = done
        })
    )
    await render(quotedTargets(1, 2))
    expect(container.querySelector('aside')).toBeNull()
    await act(async () => resolve(make(1, 10, [], 'Popular note preview')))
    expect(container.querySelector('[aria-label="Feed topics"]')).toBeNull()
    expect(container.querySelector('[aria-label="Trending Notes"]')).not.toBeNull()
    expect(container.textContent).toContain('Popular note preview')
    expect(container.textContent).toBe('Trending NotesAuthorPopular note preview')
  })

  it('does not promote many notes written by a single person into a common topic', async () => {
    await render(Array.from({ length: 20 }, (_, id) => ({ event: make(id + 1, 1, [], '#spam') })))
    expect(container.querySelector('aside')).toBeNull()
  })

  it('orders visible topics by note count and filters weak topics before selecting the top five', async () => {
    let id = 0
    const items: TFeedSummaryItem[] = []
    // High-volume topics from one author must not crowd out eligible topics.
    for (let topic = 0; topic < 5; topic++) {
      for (let n = 0; n < 40; n++) items.push({ event: make(++id, 1, [], `#solo${topic}`) })
    }
    for (const [name, notes, people] of [
      ['bitcoin', 30, 4],
      ['crypto', 21, 5],
      ['investing', 7, 3],
      ['trading', 7, 4],
      ['nostr', 8, 3],
      ['extra', 3, 3]
    ] as const) {
      for (let n = 0; n < notes; n++)
        items.push({ event: make(++id, (n % people) + 1, [], `#${name}`) })
    }
    await render(items)
    const rows = [...container.querySelectorAll('[aria-label="Feed topics"] > button')]
    expect(rows.map((row) => row.textContent)).toEqual([
      '#bitcoin30',
      '#crypto21',
      '#nostr8',
      '#trading7',
      '#investing7'
    ])
  })

  it.each(['wide', 'active', 'singleColumn'] as const)(
    'does no work when %s is disabled',
    async (flag) => {
      state[flag] = false
      await render(quotedTargets(1, 8))
      expect(container.querySelector('aside')).toBeNull()
      expect(state.fetchEvent).not.toHaveBeenCalled()
    }
  )

  it('caps missing-target lookups across ranking changes, resetting on feed changes', async () => {
    await render(quotedTargets(1, 8))
    expect(state.fetchEvent).toHaveBeenCalledTimes(5)
    await render(quotedTargets(10, 17))
    expect(state.fetchEvent).toHaveBeenCalledTimes(5)
    await render(quotedTargets(10, 17), 'another-feed')
    expect(state.fetchEvent).toHaveBeenCalledTimes(10)
  })

  it('backfills after the highest-ranked resolved targets are muted, deleted or NSFW', async () => {
    state.muted.add(hex(101))
    state.deleted.add(hex(2))
    state.fetchEvent.mockImplementation(async (id: string) => {
      const n = parseInt(id, 16)
      return make(n, 100 + n, n === 3 ? [['content-warning', '']] : [], `Target ${n}`)
    })
    await render(quotedTargets(1, 6))
    expect(container.textContent).toContain('Target 4')
    expect(container.textContent).toContain('Target 5')
    for (const n of [1, 2, 3]) expect(container.textContent).not.toContain(`Target ${n}`)
    expect(state.fetchEvent.mock.calls.map(([id]) => id)).toEqual([1, 2, 3, 4, 5].map(hex))
  })

  it.each([false, true])(
    'hides the popular section when every resolved target is filtered (topics: %s)',
    async (withTopics) => {
      state.fetchEvent.mockImplementation(async (id: string) => {
        const n = parseInt(id, 16)
        return make(n, 100 + n, n > 3 ? [['content-warning', '']] : [], `Target ${n}`)
      })
      const items = [
        ...quotedTargets(1, 6),
        ...(withTopics
          ? [1, 2].map((author) => ({ event: make(5000 + author, author, [], '#nostr') }))
          : [])
      ]
      await render(items)
      expect(container.querySelector('[aria-label="Trending Notes"]')).not.toBeNull()
      for (const n of [1, 2, 3]) state.deleted.add(hex(n))
      await render(items)
      expect(container.querySelector('[aria-label="Trending Notes"]')).toBeNull()
      expect(Boolean(container.querySelector('aside'))).toBe(withTopics)
      expect(state.fetchEvent).toHaveBeenCalledTimes(5)
    }
  )

  it('backfills failed lookups, cache misses and unsupported repost targets', async () => {
    state.fetchEvent.mockImplementation(async (id: string) => {
      const n = parseInt(id, 16)
      if (n === 1) throw new Error('lookup failed')
      if (n === 2) return undefined
      return { ...make(n, 100 + n, [], `Target ${n}`), kind: n === 3 ? 6 : 1 }
    })
    await render(quotedTargets(1, 6))
    expect(container.textContent).toContain('Target 4')
    expect(container.textContent).toContain('Target 5')
    expect(container.textContent).not.toContain('Target 3')
    expect(state.fetchEvent).toHaveBeenCalledTimes(5)
  })

  it('uses a loaded candidate beyond the top five without exceeding the lookup budget', async () => {
    state.fetchEvent.mockImplementation(async (id: string) => {
      const n = parseInt(id, 16)
      return make(n, 100 + n, [['content-warning', '']], `Hidden ${n}`)
    })
    await render([
      ...quotedTargets(1, 6),
      { event: make(6, 106, [], 'Already loaded candidate'), reposters: [hex(1), hex(2), hex(3)] }
    ])
    expect(container.textContent).toContain('Already loaded candidate')
    expect(container.textContent).not.toContain('Hidden')
    expect(state.fetchEvent).toHaveBeenCalledTimes(5)
    expect(state.fetchEvent).not.toHaveBeenCalledWith(hex(6))
  })

  it.each([
    ['q', 'article:chapter/one:你好'],
    ['a', 'article:chapter/one:你好'],
    ['q', ''],
    ['a', '']
  ])(
    'fetches uncached %s coordinates as naddr and resolves them under the original key (%s)',
    async (tag, identifier) => {
      const coordinate = `30023:${hex(10)}:${identifier}`
      const article = {
        ...make(100, 10, [
          ['d', identifier],
          ['title', 'Addressable article']
        ]),
        kind: 30023
      }
      state.fetchEvent.mockImplementation(async (id: string) => {
        // Match the real client's cache-miss requirement: coordinates cannot be decoded here.
        expect(nip19.decode(id)).toMatchObject({
          type: 'naddr',
          data: { kind: 30023, pubkey: hex(10), identifier }
        })
        return article
      })
      const items = [1, 2].map((author) => ({
        event: { ...make(author, author, [[tag, coordinate]]), kind: tag === 'a' ? 16 : 1 }
      }))
      await render(items)
      expect(state.fetchEvent).toHaveBeenCalledWith(
        nip19.naddrEncode({ kind: 30023, pubkey: hex(10), identifier })
      )
      expect(container.textContent).toContain('Addressable article')
      await render(items)
      expect(state.fetchEvent).toHaveBeenCalledTimes(1)
    }
  )

  it('keeps completed lookups when rankings change during a pending request', async () => {
    const pending = new Map<string, (event: Event) => void>()
    state.fetchEvent.mockImplementation(
      (key: string) =>
        new Promise<Event>((done) => {
          pending.set(key, done)
        })
    )
    const original = quotedTargets(1, 2)
    await render(original)
    await render([...original, ...quotedTargets(2, 3)])
    await act(async () => pending.get(hex(1))!(make(1, 12, [], 'Resolved preview')))
    expect(container.textContent).toContain('Resolved preview')
  })

  it('preserves the lookup budget when leaving and returning to the feed', async () => {
    await render(quotedTargets(1, 8))
    state.active = false
    await render(quotedTargets(1, 8))
    state.active = true
    await render(quotedTargets(10, 17))
    expect(state.fetchEvent).toHaveBeenCalledTimes(5)
  })

  it('shows a pending lookup that completes after returning to the feed', async () => {
    let resolve!: (event: Event) => void
    state.fetchEvent.mockImplementation(
      () =>
        new Promise<Event>((done) => {
          resolve = done
        })
    )
    const items = quotedTargets(1, 2)
    await render(items)
    state.active = false
    await render(items)
    state.active = true
    await render(items)
    await act(async () => resolve(make(1, 12, [], 'Returned preview')))
    expect(container.textContent).toContain('Returned preview')
    expect(state.fetchEvent).toHaveBeenCalledTimes(1)
  })

  it('opens topics and excludes protected content from previews and topics', async () => {
    const items = [
      { event: make(1, 1, [], '#nostr') },
      { event: make(4, 4, [], '#nostr') },
      { event: make(5, 5, [], '#nostr') },
      { event: make(2, 2, [['content-warning', '']], '#hidden') },
      ...quotedTargets(3, 4)
    ]
    state.fetchEvent.mockResolvedValue(make(3, 30, [['content-warning', '']], 'Protected preview'))
    await render(items)
    expect(container.textContent).not.toContain('Protected preview')
    expect(container.textContent).not.toContain('#hidden')
    const topic = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.startsWith('#nostr')
    )!
    await act(async () => topic.click())
    expect(state.push).toHaveBeenCalledWith(expect.stringMatching(/^\/notes\?feed-topic=/))
    const snapshotId = state.push.mock.calls[0][0].split('feed-topic=')[1]
    const snapshot = feedTopicService.getSnapshot(snapshotId)!
    expect(snapshot.name).toBe('nostr')
    expect(snapshot.events.map((event) => event.id).sort()).toEqual([hex(1), hex(4), hex(5)])
  })
})
