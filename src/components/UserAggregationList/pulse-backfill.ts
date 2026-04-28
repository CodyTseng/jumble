// Pure helpers for the Pulse-tab per-author backfill planner.
//
// This file is deliberately kept framework-free so it can be unit-tested
// without spinning up React or the Nostr client.
//
// Design intent:
//   The Pulse feed aggregates events by author and shows up to N most
//   recent events per author. The initial timeline subscription fetches
//   a bounded number of recent events across ALL followees together;
//   prolific authors saturate the limit and inactive authors may get
//   zero or very few events back. The backfill planner's job is to
//   top up each author to N events efficiently, without bugs.
//
// The important bug we're avoiding:
//   Using a SHARED `until` across authors with different oldest
//   timestamps silently drops events for authors whose oldest known
//   event is more recent than the group minimum. E.g. author A's
//   oldest=2020 and author B's oldest=2025 with shared until=2020
//   means B's 2021-2024 events are never queried. Fix: one query per
//   author with their own `until = oldest - 1`.
import { Event, Filter } from 'nostr-tools'

export type PulseSubRequest = {
  urls: string[]
  filter: Omit<Filter, 'since' | 'until'>
}

export type PlannedQuery = {
  // Identifies the origin so callers can track per-author state.
  //   'fresh'        : grouped catch-all on feed relays for authors with 0
  //                    events — cheap first pass.
  //   'fresh-author' : per-author catch-all intended to run on that author's
  //                    write relays (caller merges them in). Needed because
  //                    the grouped pass only hits the feed's relays, which
  //                    may not overlap with the author's outbox.
  //   'partial'      : per-author backfill for authors who already have some
  //                    events but fewer than the cap.
  kind: 'fresh' | 'fresh-author' | 'partial'
  // Set for 'fresh-author' and 'partial' (single-author queries).
  pubkey?: string
  urls: string[]
  filter: Filter
}

export type PlanInput = {
  subRequests: PulseSubRequest[]
  showKinds: number[]
  // Events accumulated so far (from initial fetch + prior backfill rounds).
  accumulated: Event[]
  // Per-author target count.
  perUserCap: number
  // Previously-queried backfill floor per author. If we've already
  // queried down to floor F and the author's oldest is still F, we
  // know the relay has nothing older — skip unless `deeper` is set.
  floors: Map<string, number>
  // Authors we've already queried on their own write relays without finding
  // anything. Skip re-issuing a per-author fresh query for these.
  freshTried?: Set<string>
  // Per-author timestamp of the last SUCCESSFUL check (EOSE received, no
  // errors). When set, the per-author fresh query becomes a gap-fill with
  // `since: lastCheckedAt` instead of an unbounded fetch. Authors not in
  // this map are treated as never-checked and get an unbounded query.
  sinceByAuthor?: Map<string, number>
  // When true, re-query authors whose floor has already been reached.
  // Used by the explicit "Load earlier" button.
  deeper: boolean
  // Limit for the fresh-author catch-all query.
  freshLimit: number
  // Limit for per-author partial queries.
  partialLimit: number
}

export type PlanOutput = {
  queries: PlannedQuery[]
  needy: string[]
  freshAuthors: string[]
  partialAuthors: string[]
}

// Count events per author and track each author's oldest timestamp.
function summarize(
  allAuthors: string[],
  accumulated: Event[]
): {
  count: Map<string, number>
  oldestByAuthor: Map<string, number>
} {
  const count = new Map<string, number>()
  const oldestByAuthor = new Map<string, number>()
  const authorSet = new Set(allAuthors)
  for (const a of allAuthors) count.set(a, 0)
  for (const e of accumulated) {
    if (!authorSet.has(e.pubkey)) continue
    count.set(e.pubkey, (count.get(e.pubkey) ?? 0) + 1)
    const prev = oldestByAuthor.get(e.pubkey)
    if (prev === undefined || e.created_at < prev) {
      oldestByAuthor.set(e.pubkey, e.created_at)
    }
  }
  return { count, oldestByAuthor }
}

/**
 * Plan the next round of backfill queries.
 *
 * Returns the queries to run plus the bookkeeping the caller needs
 * (needy/fresh/partial lists are exposed primarily for test assertions).
 */
export function planBackfillRound(input: PlanInput): PlanOutput {
  const { subRequests, showKinds, accumulated, perUserCap, floors, deeper } =
    input

  const allAuthors = Array.from(
    new Set(subRequests.flatMap(({ filter }) => filter.authors ?? []))
  )
  if (allAuthors.length === 0) {
    return { queries: [], needy: [], freshAuthors: [], partialAuthors: [] }
  }

  const { count, oldestByAuthor } = summarize(allAuthors, accumulated)

  const needy = allAuthors.filter((a) => (count.get(a) ?? 0) < perUserCap)
  if (needy.length === 0) {
    return { queries: [], needy: [], freshAuthors: [], partialAuthors: [] }
  }

  const freshAuthors = needy.filter((a) => !oldestByAuthor.has(a))
  const partialAuthors = needy.filter((a) => oldestByAuthor.has(a))

  const queries: PlannedQuery[] = []
  const freshTried = input.freshTried ?? new Set<string>()

  // (1) Grouped catch-all on the feed's relays — cheap first pass that works
  // whenever the feed's relays happen to hold the author's posts. Skip any
  // authors who've already been through this pass without results (tracked
  // via freshTried); they need a per-author try on their own write relays.
  if (freshAuthors.length > 0) {
    for (const { urls, filter } of subRequests) {
      const inGroup = (filter.authors ?? []).filter(
        (a) => freshAuthors.includes(a) && !freshTried.has(a)
      )
      if (inGroup.length === 0) continue
      queries.push({
        kind: 'fresh',
        urls,
        filter: {
          kinds: showKinds,
          ...filter,
          authors: inGroup,
          limit: input.freshLimit
        }
      })
    }
  }

  // (2) Per-author catch-all intended for each fresh author's write relays.
  // This is what catches authors whose posts live on relays the feed doesn't
  // read from (classic "outbox" mismatch — the Lyn Alden case). The caller
  // is responsible for merging in the author's NIP-65 write relays before
  // firing these; the planner just marks them as 'fresh-author'.
  //
  // If we have a `sinceByAuthor` entry for an author, the query is a
  // gap-fill since the last successful check: `since: lastCheckedAt`. That
  // avoids re-fetching an author's whole timeline every session — the
  // cache holds the older events and we only ask relays for what's new.
  const sinceByAuthor = input.sinceByAuthor
  for (const pubkey of freshAuthors) {
    if (freshTried.has(pubkey) && !deeper) continue
    const since = sinceByAuthor?.get(pubkey)
    for (const { urls, filter } of subRequests) {
      if (!(filter.authors ?? []).includes(pubkey)) continue
      const perFilter: Filter = {
        kinds: showKinds,
        ...filter,
        authors: [pubkey],
        limit: input.partialLimit
      }
      // `deeper=true` means the user wants a full historical refetch,
      // so ignore the since-hint in that mode.
      if (since !== undefined && since > 0 && !deeper) {
        perFilter.since = since
      }
      queries.push({
        kind: 'fresh-author',
        pubkey,
        urls,
        filter: perFilter
      })
    }
  }

  // One partial-author query per (author, subRequest group), each with
  // that author's own `until`. This is the fix for the skip bug.
  for (const pubkey of partialAuthors) {
    const oldest = oldestByAuthor.get(pubkey)!
    const prevFloor = floors.get(pubkey)
    // Skip if we've already queried back to (or beyond) this author's
    // current oldest and got nothing — unless the caller asks to dig deeper.
    if (!deeper && prevFloor !== undefined && prevFloor <= oldest) continue

    for (const { urls, filter } of subRequests) {
      if (!(filter.authors ?? []).includes(pubkey)) continue
      queries.push({
        kind: 'partial',
        pubkey,
        urls,
        filter: {
          kinds: showKinds,
          ...filter,
          authors: [pubkey],
          until: oldest - 1,
          limit: input.partialLimit
        }
      })
    }
  }

  return { queries, needy, freshAuthors, partialAuthors }
}
