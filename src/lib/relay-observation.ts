/** Transport-independent observations. No browser APIs: also used by Electron main. */
export type RelayObservation =
  | { type: 'connection'; url: string; at: number; duration: number; reason?: string }
  | { type: 'read-time'; url: string; at: number; duration: number }
  | { type: 'write-time'; url: string; at: number; duration: number }
  | { type: 'read-rejection' | 'write-rejection'; url: string; at: number; reason: string }
  | { type: 'read-timeout'; url: string; at: number; phase: 'first-event' | 'completion' }
  | { type: 'write-timeout'; url: string; at: number }

export type TimingHistogram = { count: number; buckets: Record<string, number> }
export type RelayObservationDay = {
  date: string
  connections: number
  connectionFailures: Record<string, number>
  readRejections: Record<string, number>
  writeRejections: Record<string, number>
  readTimeouts: Record<string, number>
  writeTimeouts: number
  connectionTime: TimingHistogram
  readTime: TimingHistogram
  writeTime: TimingHistogram
}
export type RelayObservationRecord = { url: string; updatedAt: number; days: RelayObservationDay[] }
export type RelayObserver = (observation: RelayObservation) => void

export function observationDate(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function emptyObservationDay(date: string): RelayObservationDay {
  return {
    date,
    connections: 0,
    connectionFailures: {},
    readRejections: {},
    writeRejections: {},
    readTimeouts: {},
    writeTimeouts: 0,
    connectionTime: { count: 0, buckets: {} },
    readTime: { count: 0, buckets: {} },
    writeTime: { count: 0, buckets: {} }
  }
}

function increment(counts: Record<string, number>, reason: string, amount = 1) {
  // Bound arbitrary relay-provided messages, including relays with changing reasons.
  const key = reason.slice(0, 300) || 'Unknown reason'
  const target =
    Object.prototype.hasOwnProperty.call(counts, key) || Object.keys(counts).length < 50
      ? key
      : 'Other reasons'
  Object.defineProperty(counts, target, {
    value: (Object.prototype.hasOwnProperty.call(counts, target) ? counts[target] : 0) + amount,
    writable: true,
    enumerable: true,
    configurable: true
  })
}

function addTiming(timing: TimingHistogram, duration: number) {
  // A bounded histogram, rather than retaining an unbounded list of requests.
  const ms = Math.max(0, Math.min(duration, 120_000))
  const step = ms < 1_000 ? 10 : ms < 10_000 ? 100 : 1_000
  const bucket = String(Math.round(ms / step) * step)
  timing.count++
  timing.buckets[bucket] = (timing.buckets[bucket] ?? 0) + 1
}

export function applyRelayObservation(
  record: RelayObservationRecord,
  observation: RelayObservation
) {
  const date = observationDate(observation.at)
  let day = record.days.find((item) => item.date === date)
  if (!day) {
    day = emptyObservationDay(date)
    record.days.push(day)
  }
  record.updatedAt = Math.max(record.updatedAt, observation.at)
  switch (observation.type) {
    case 'connection':
      day.connections++
      if (observation.reason !== undefined) increment(day.connectionFailures, observation.reason)
      else addTiming(day.connectionTime, observation.duration)
      break
    case 'read-time':
      addTiming(day.readTime, observation.duration)
      break
    case 'write-time':
      addTiming(day.writeTime, observation.duration)
      break
    case 'read-rejection':
      increment(day.readRejections, observation.reason)
      break
    case 'write-rejection':
      increment(day.writeRejections, observation.reason)
      break
    case 'read-timeout':
      increment(day.readTimeouts, observation.phase)
      break
    case 'write-timeout':
      day.writeTimeouts++
      break
  }
  record.days.sort((a, b) => a.date.localeCompare(b.date))
  // Include days of activity on already-open sockets so reads/writes are never discarded.
  record.days = record.days.slice(-7)
}

/** Merge daily deltas without keeping individual operation logs. */
export function mergeRelayObservationRecord(
  record: RelayObservationRecord,
  delta: RelayObservationRecord
) {
  record.updatedAt = Math.max(record.updatedAt, delta.updatedAt)
  // Drop this retired field when an older record is next persisted.
  for (const day of record.days) {
    delete (day as RelayObservationDay & { authProblems?: unknown }).authProblems
  }
  for (const addition of delta.days) {
    let day = record.days.find((item) => item.date === addition.date)
    if (!day) {
      day = emptyObservationDay(addition.date)
      record.days.push(day)
    }
    day.connections += addition.connections
    day.writeTimeouts += addition.writeTimeouts
    for (const key of [
      'connectionFailures',
      'readRejections',
      'writeRejections',
      'readTimeouts'
    ] as const) {
      for (const [reason, count] of Object.entries(addition[key]))
        increment(day[key], reason, count)
    }
    for (const key of ['connectionTime', 'readTime', 'writeTime'] as const) {
      day[key] = mergeTimings([day[key], addition[key]])
    }
  }
  record.days.sort((a, b) => a.date.localeCompare(b.date))
  record.days = record.days.slice(-7)
}

export function sumCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

export function mergeTimings(timings: TimingHistogram[]): TimingHistogram {
  const result: TimingHistogram = { count: 0, buckets: {} }
  for (const timing of timings) {
    result.count += timing.count
    for (const [bucket, count] of Object.entries(timing.buckets)) {
      result.buckets[bucket] = (result.buckets[bucket] ?? 0) + count
    }
  }
  return result
}

export function medianTiming(timing: TimingHistogram): number | undefined {
  if (!timing.count) return undefined
  let cumulative = 0
  const lower = Math.floor((timing.count + 1) / 2)
  const upper = Math.floor(timing.count / 2) + 1
  let first: number | undefined
  for (const [bucket, count] of Object.entries(timing.buckets).sort((a, b) => +a[0] - +b[0])) {
    cumulative += count
    if (first === undefined && cumulative >= lower) first = +bucket
    if (cumulative >= upper) return ((first ?? +bucket) + +bucket) / 2
  }
}

export function isTransportFailure(reason: string) {
  return /relay connection|closed by caller|closed by pool|network is offline|SendingOnClosedConnection|connection replaced|stale relay|Insecure relay/i.test(
    reason
  )
}

/** Recognize auth-required anywhere in the reason, preserving the original message. */
export function isAuthRequiredReason(reason: string) {
  return reason.toLowerCase().includes('auth-required')
}
