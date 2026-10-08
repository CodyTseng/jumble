import { medianTiming, RelayObservationRecord, sumCounts } from '@/lib/relay-observation'

export type RelayActivityRow = {
  url: string
  date?: string
  totalConnections: number
  connections?: number
  failures?: number
  failureRate?: number
  connectionTime?: number
  writeTime?: number
  readTime?: number
  readRejections?: number
  readTimeouts?: number
  writeRejections?: number
  writeTimeouts?: number
}
export type RelayActivityColumn = keyof RelayActivityRow
export type RelayActivitySort = { column: RelayActivityColumn; direction: 'asc' | 'desc' }

export function createRelayActivityRow(
  url: string,
  record?: RelayObservationRecord
): RelayActivityRow {
  const day = record?.days[record.days.length - 1]
  const failures = day ? sumCounts(day.connectionFailures) : undefined
  return {
    url,
    date: day?.date,
    totalConnections: record?.days.reduce((sum, day) => sum + day.connections, 0) ?? 0,
    connections: day?.connections,
    failures,
    failureRate: day?.connections ? failures! / day.connections : undefined,
    connectionTime: day ? medianTiming(day.connectionTime) : undefined,
    writeTime: day ? medianTiming(day.writeTime) : undefined,
    readTime: day ? medianTiming(day.readTime) : undefined,
    readRejections: day ? sumCounts(day.readRejections) : undefined,
    readTimeouts: day ? sumCounts(day.readTimeouts) : undefined,
    writeRejections: day ? sumCounts(day.writeRejections) : undefined,
    writeTimeouts: day?.writeTimeouts
  }
}

export function compareRelayActivityRows(
  a: RelayActivityRow,
  b: RelayActivityRow,
  sort: RelayActivitySort
) {
  const left = a[sort.column]
  const right = b[sort.column]
  // Missing observations remain last in either direction; they are not zero latency.
  if (left === undefined && right !== undefined) return 1
  if (left !== undefined && right === undefined) return -1
  const comparison =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left ?? '').localeCompare(String(right ?? ''))
  return (sort.direction === 'asc' ? comparison : -comparison) || a.url.localeCompare(b.url)
}
