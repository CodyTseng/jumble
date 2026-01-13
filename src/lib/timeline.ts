import { NostrEvent } from 'nostr-tools'
import { compareEvents } from './event'

export function mergeTimelines(timelines: NostrEvent[][], limit?: number) {
  if (timelines.length === 0) return []
  if (timelines.length === 1) return [...timelines[0]]
  return timelines.reduce((merged, current) => _mergeTimelines(merged, current, limit), [])
}

function _mergeTimelines(a: NostrEvent[], b: NostrEvent[], limit?: number): NostrEvent[] {
  if (a.length === 0) return [...b]
  if (b.length === 0) return [...a]

  const result: NostrEvent[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const cmp = compareEvents(a[i], b[j])
    if (cmp > 0) {
      result.push(a[i])
      i++
    } else if (cmp < 0) {
      result.push(b[j])
      j++
    } else {
      result.push(a[i])
      i++
      j++
    }
  }

  if (limit && result.length >= limit) {
    return result
  }

  while (i < a.length && (!limit || result.length < limit)) {
    result.push(a[i])
    i++
  }

  while (j < b.length && (!limit || result.length < limit)) {
    result.push(b[j])
    j++
  }

  return result
}
