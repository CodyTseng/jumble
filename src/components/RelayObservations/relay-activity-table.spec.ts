import { describe, expect, it } from 'vitest'
import { emptyObservationDay } from '@/lib/relay-observation'
import {
  compareRelayActivityRows,
  createRelayActivityRow,
  RelayActivityRow
} from './relay-activity-table'

const row = (url: string, overrides: Partial<RelayActivityRow> = {}): RelayActivityRow => ({
  url,
  totalConnections: 0,
  ...overrides
})

describe('relay activity table', () => {
  it('shows latest-day metrics separately from retained total connections', () => {
    const older = emptyObservationDay('2026-10-01')
    older.connections = 40
    older.readRejections = { restricted: 10 }
    older.readTime = { count: 1, buckets: { '100': 1 } }
    const latest = emptyObservationDay('2026-10-08')
    latest.connections = 4
    latest.connectionFailures = { timeout: 2 }
    latest.readRejections = { restricted: 1 }
    latest.connectionTime = { count: 1, buckets: { '200': 1 } }
    expect(
      createRelayActivityRow('wss://relay.example/', {
        url: 'wss://relay.example/',
        updatedAt: Date.now(),
        days: [older, latest]
      })
    ).toMatchObject({
      date: '2026-10-08',
      totalConnections: 44,
      connections: 4,
      failures: 2,
      failureRate: 0.5,
      readRejections: 1,
      connectionTime: 200,
      readTime: undefined
    })
  })

  it('sorts numeric values numerically and keeps absent latency last in either direction', () => {
    const rows = [
      row('unknown'),
      row('ten', { writeTime: 10 }),
      row('two', { writeTime: 2 }),
      row('zero', { writeTime: 0 })
    ]
    expect(
      [...rows]
        .sort((a, b) => compareRelayActivityRows(a, b, { column: 'writeTime', direction: 'asc' }))
        .map((item) => item.url)
    ).toEqual(['zero', 'two', 'ten', 'unknown'])
    expect(
      [...rows]
        .sort((a, b) => compareRelayActivityRows(a, b, { column: 'writeTime', direction: 'desc' }))
        .map((item) => item.url)
    ).toEqual(['ten', 'two', 'zero', 'unknown'])
  })

  it('orders dates and resolves ties consistently when sorting before pagination', () => {
    const rows = [
      row('b', { date: '2026-10-08', totalConnections: 10 }),
      row('c', { date: '2026-10-01', totalConnections: 2 }),
      row('a', { date: '2026-10-08', totalConnections: 10 })
    ]
    expect(
      rows
        .sort((a, b) =>
          compareRelayActivityRows(a, b, { column: 'totalConnections', direction: 'desc' })
        )
        .slice(0, 2)
        .map((item) => item.url)
    ).toEqual(['a', 'b'])
    expect(
      rows
        .sort((a, b) => compareRelayActivityRows(a, b, { column: 'date', direction: 'asc' }))
        .map((item) => item.url)
    ).toEqual(['c', 'a', 'b'])
  })
})
