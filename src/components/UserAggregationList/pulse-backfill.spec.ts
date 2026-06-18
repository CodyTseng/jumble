import { describe, expect, it } from 'vitest'
import { Event } from 'nostr-tools'
import { planBackfillRound } from './pulse-backfill'

// Helpers
let nextId = 1
const mkEvent = (pubkey: string, ts: number): Event => ({
  id: String(nextId++).padStart(64, '0'),
  pubkey,
  created_at: ts,
  kind: 1,
  tags: [],
  content: '',
  sig: ''
})

const baseInput = (overrides: Partial<Parameters<typeof planBackfillRound>[0]> = {}) => ({
  subRequests: [
    {
      urls: ['wss://relay.example/'],
      filter: { authors: ['A', 'B', 'C'], kinds: [1] }
    }
  ],
  showKinds: [1],
  accumulated: [] as Event[],
  perUserCap: 10,
  floors: new Map<string, number>(),
  deeper: false,
  freshLimit: 1000,
  partialLimit: 10,
  ...overrides
})

describe('planBackfillRound', () => {
  it('returns no queries when every author already has >= cap events', () => {
    const accumulated: Event[] = []
    for (let i = 0; i < 10; i++) accumulated.push(mkEvent('A', 2_000_000 - i))
    for (let i = 0; i < 10; i++) accumulated.push(mkEvent('B', 2_000_000 - i))
    for (let i = 0; i < 10; i++) accumulated.push(mkEvent('C', 2_000_000 - i))

    const out = planBackfillRound(baseInput({ accumulated }))
    expect(out.queries).toEqual([])
    expect(out.needy).toEqual([])
  })

  it('emits a grouped fresh + a per-author fresh-author query for zero-event authors', () => {
    const out = planBackfillRound(baseInput({ accumulated: [] }))
    expect(out.freshAuthors.sort()).toEqual(['A', 'B', 'C'])
    expect(out.partialAuthors).toEqual([])

    // Grouped catch-all on feed relays.
    const fresh = out.queries.filter((q) => q.kind === 'fresh')
    expect(fresh).toHaveLength(1)
    expect(fresh[0].filter.authors).toEqual(['A', 'B', 'C'])
    expect(fresh[0].filter.until).toBeUndefined()
    expect(fresh[0].filter.limit).toBe(1000)

    // Per-author queries meant to run on each author's write relays
    // (caller merges those in). One per fresh author.
    const freshAuthor = out.queries.filter((q) => q.kind === 'fresh-author')
    expect(freshAuthor.map((q) => q.pubkey).sort()).toEqual(['A', 'B', 'C'])
    for (const q of freshAuthor) {
      expect(q.filter.authors).toEqual([q.pubkey])
      expect(q.filter.until).toBeUndefined()
    }
  })

  it('skips grouped + per-author fresh queries for authors in freshTried', () => {
    // After round 1: A and B have been tried on their write relays without
    // finding anything; C hasn't been tried yet.
    const out = planBackfillRound(
      baseInput({
        accumulated: [],
        freshTried: new Set(['A', 'B'])
      })
    )
    // Grouped fresh should only include still-untried authors.
    const fresh = out.queries.filter((q) => q.kind === 'fresh')
    expect(fresh).toHaveLength(1)
    expect(fresh[0].filter.authors).toEqual(['C'])

    // Per-author fresh likewise only for still-untried authors.
    const freshAuthor = out.queries.filter((q) => q.kind === 'fresh-author')
    expect(freshAuthor.map((q) => q.pubkey)).toEqual(['C'])
  })

  it('re-emits per-author fresh queries for freshTried authors when deeper=true', () => {
    const out = planBackfillRound(
      baseInput({
        accumulated: [],
        freshTried: new Set(['A', 'B', 'C']),
        deeper: true
      })
    )
    // Grouped fresh is still skipped (freshTried wins for the grouped pass).
    // But "Load earlier" should retry per-author even when we think we've
    // exhausted their write relays — the user is explicitly asking.
    const freshAuthor = out.queries.filter((q) => q.kind === 'fresh-author')
    expect(freshAuthor.map((q) => q.pubkey).sort()).toEqual(['A', 'B', 'C'])
  })

  it(
    'uses per-author `until` for partial authors (regression: the "years of ' +
      'discrepancy" bug came from sharing a global min until across authors)',
    () => {
      // A's oldest event is very old (2020-01-01). B's is recent (2025-01-01).
      // If we (buggy) used a shared min until=A.oldest for BOTH, B's events
      // between 2020 and 2025 would never be queried for.
      const A_OLDEST = Math.floor(new Date('2020-01-01Z').getTime() / 1000)
      const B_OLDEST = Math.floor(new Date('2025-01-01Z').getTime() / 1000)
      const accumulated = [
        mkEvent('A', A_OLDEST + 100),
        mkEvent('A', A_OLDEST),
        mkEvent('B', B_OLDEST + 100),
        mkEvent('B', B_OLDEST)
      ]
      const out = planBackfillRound(
        baseInput({
          accumulated,
          subRequests: [
            {
              urls: ['wss://r/'],
              filter: { authors: ['A', 'B'], kinds: [1] }
            }
          ]
        })
      )

      const partial = out.queries.filter((q) => q.kind === 'partial')
      // One partial query per author with their OWN until.
      expect(partial.map((q) => q.pubkey).sort()).toEqual(['A', 'B'])
      const byAuthor = Object.fromEntries(partial.map((q) => [q.pubkey!, q]))
      expect(byAuthor.A.filter.until).toBe(A_OLDEST - 1)
      expect(byAuthor.B.filter.until).toBe(B_OLDEST - 1)
      // Each partial query targets exactly one author, not a group.
      expect(byAuthor.A.filter.authors).toEqual(['A'])
      expect(byAuthor.B.filter.authors).toEqual(['B'])
    }
  )

  it('mixes fresh and partial authors correctly in a single round', () => {
    // A: has events. B: zero events (fresh). C: has events.
    const accumulated = [mkEvent('A', 1000), mkEvent('C', 900)]
    const out = planBackfillRound(baseInput({ accumulated }))

    expect(out.freshAuthors).toEqual(['B'])
    expect(out.partialAuthors.sort()).toEqual(['A', 'C'])

    const fresh = out.queries.filter((q) => q.kind === 'fresh')
    expect(fresh).toHaveLength(1)
    expect(fresh[0].filter.authors).toEqual(['B'])
    expect(fresh[0].filter.until).toBeUndefined()

    // B also gets a per-author fresh query for her write relays.
    const freshAuthor = out.queries.filter((q) => q.kind === 'fresh-author')
    expect(freshAuthor).toHaveLength(1)
    expect(freshAuthor[0].pubkey).toBe('B')

    const partial = out.queries.filter((q) => q.kind === 'partial')
    expect(partial).toHaveLength(2)
    const byPk = Object.fromEntries(partial.map((q) => [q.pubkey!, q]))
    expect(byPk.A.filter.until).toBe(999)
    expect(byPk.C.filter.until).toBe(899)
  })

  it('skips a partial author when their floor has already been reached', () => {
    // A's oldest is 1000; we've previously queried back to 1000.
    // Running the planner again without `deeper` should skip A.
    const accumulated = [mkEvent('A', 1000)]
    const out = planBackfillRound(
      baseInput({
        accumulated,
        floors: new Map([['A', 1000]]),
        subRequests: [
          { urls: [], filter: { authors: ['A'], kinds: [1] } }
        ]
      })
    )
    expect(out.queries).toEqual([])
  })

  it('re-queries partial authors past their floor when deeper=true', () => {
    const accumulated = [mkEvent('A', 1000)]
    const out = planBackfillRound(
      baseInput({
        accumulated,
        floors: new Map([['A', 1000]]),
        deeper: true,
        subRequests: [
          { urls: [], filter: { authors: ['A'], kinds: [1] } }
        ]
      })
    )
    expect(out.queries).toHaveLength(1)
    expect(out.queries[0].kind).toBe('partial')
    expect(out.queries[0].filter.until).toBe(999)
  })

  it('uses sinceByAuthor to scope the per-author fresh query (gap-fill mode)', () => {
    const LAST_OK = 1_700_000_000 // some previous successful check
    const out = planBackfillRound(
      baseInput({
        accumulated: [],
        sinceByAuthor: new Map([['A', LAST_OK]])
      })
    )
    // A has a lastCheckedAt — their fresh-author query must be bounded to
    // `since: LAST_OK` so we only fill the gap.
    const freshAuthor = out.queries.filter((q) => q.kind === 'fresh-author')
    const byAuthor = Object.fromEntries(freshAuthor.map((q) => [q.pubkey!, q]))
    expect(byAuthor.A.filter.since).toBe(LAST_OK)
    // B and C were never checked — their queries stay unbounded.
    expect(byAuthor.B.filter.since).toBeUndefined()
    expect(byAuthor.C.filter.since).toBeUndefined()
  })

  it('deeper=true ignores sinceByAuthor (full historical refetch)', () => {
    const LAST_OK = 1_700_000_000
    const out = planBackfillRound(
      baseInput({
        accumulated: [],
        sinceByAuthor: new Map([['A', LAST_OK]]),
        deeper: true
      })
    )
    const freshAuthor = out.queries.filter((q) => q.kind === 'fresh-author')
    const a = freshAuthor.find((q) => q.pubkey === 'A')!
    expect(a.filter.since).toBeUndefined()
  })

  it('respects subRequest grouping: only queries authors for groups that list them', () => {
    const accumulated: Event[] = []
    const out = planBackfillRound(
      baseInput({
        accumulated,
        subRequests: [
          { urls: ['wss://r1/'], filter: { authors: ['A', 'B'], kinds: [1] } },
          { urls: ['wss://r2/'], filter: { authors: ['C'], kinds: [1] } }
        ]
      })
    )
    // All three authors fresh → one fresh query per subRequest group.
    const fresh = out.queries.filter((q) => q.kind === 'fresh')
    expect(fresh.map((q) => q.filter.authors).sort()).toEqual([['A', 'B'], ['C']])
  })

  it('preserves extra filter fields (e.g. kinds) in built queries', () => {
    const accumulated: Event[] = [mkEvent('A', 1000)]
    const out = planBackfillRound(
      baseInput({
        accumulated,
        showKinds: [1, 6],
        subRequests: [
          {
            urls: [],
            filter: { authors: ['A'], kinds: [1, 6], '#t': ['bitcoin'] } as any
          }
        ]
      })
    )
    const q = out.queries.find((x) => x.kind === 'partial')!
    expect(q.filter.kinds).toEqual([1, 6])
    expect((q.filter as any)['#t']).toEqual(['bitcoin'])
  })

  it('deduplicates authors that appear in multiple subRequest groups', () => {
    // A is in both groups. Fresh queries should be emitted for each group
    // (per-group relay set). Partial queries likewise.
    const accumulated: Event[] = []
    const out = planBackfillRound(
      baseInput({
        accumulated,
        subRequests: [
          { urls: ['wss://r1/'], filter: { authors: ['A'], kinds: [1] } },
          { urls: ['wss://r2/'], filter: { authors: ['A'], kinds: [1] } }
        ]
      })
    )
    expect(out.freshAuthors).toEqual(['A'])
    const fresh = out.queries.filter((q) => q.kind === 'fresh')
    expect(fresh).toHaveLength(2) // one per group
    expect(fresh.map((q) => q.urls[0]).sort()).toEqual([
      'wss://r1/',
      'wss://r2/'
    ])
  })
})
