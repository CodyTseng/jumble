import { describe, expect, it } from 'vitest'
import {
  applyRelayObservation,
  isAuthRequiredReason,
  emptyObservationDay,
  medianTiming,
  mergeTimings,
  observationDate,
  RelayObservationRecord,
  sumCounts
} from './relay-observation'

const url = 'wss://relay.example/'
function record(): RelayObservationRecord {
  return { url, updatedAt: 0, days: [] }
}

describe('relay observations', () => {
  it.each([
    ['auth-required: restricted', true],
    ['ERROR: auth-required: requested filter requires authentication', true],
    ['  Error: AUTH-REQUIRED: restricted  ', true],
    ['auth-required', true],
    ['restricted: auth-required for another request', true],
    ['auth-required-other: unsupported', true],
    ['permission denied (AUTH-REQUIRED)', true],
    ['restricted: members only', false],
    ['', false]
  ])('recognizes auth-required anywhere in the reason: %s', (reason, expected) => {
    expect(isAuthRequiredReason(reason as string)).toBe(expected)
  })

  it('keeps the newest seven activity dates even with gaps and late observations', () => {
    const stats = record()
    for (let day = 1; day <= 17; day += 2) {
      applyRelayObservation(stats, {
        type: 'connection',
        url,
        at: new Date(2026, 9, day).getTime(),
        duration: 120
      })
    }
    applyRelayObservation(stats, {
      type: 'read-timeout',
      url,
      at: new Date(2026, 9, 1).getTime(),
      phase: 'first-event'
    })
    expect(stats.days.map((day) => day.date)).toEqual([
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-11',
      '2026-10-13',
      '2026-10-15',
      '2026-10-17'
    ])
  })

  it('separates connection failures, rejections and timeout phases', () => {
    const stats = record()
    const at = Date.now()
    applyRelayObservation(stats, { type: 'connection', url, at, duration: 10 })
    applyRelayObservation(stats, {
      type: 'connection',
      url,
      at,
      duration: 10000,
      reason: 'relay connection timed out'
    })
    for (let i = 0; i < 3; i++)
      applyRelayObservation(stats, {
        type: 'write-rejection',
        url,
        at,
        reason: 'rate-limited: slow down'
      })
    applyRelayObservation(stats, { type: 'read-timeout', url, at, phase: 'completion' })
    expect(stats.days[0]).toMatchObject({
      connections: 2,
      connectionFailures: { 'relay connection timed out': 1 },
      writeRejections: { 'rate-limited: slow down': 3 },
      readTimeouts: { completion: 1 }
    })
    expect(stats.days[0].connectionTime.count).toBe(1)
    expect(sumCounts(stats.days[0].readRejections)).toBe(0)
  })

  it('allows read/write activity on an already-open connection on a new day', () => {
    const stats = record()
    const at = new Date(2026, 9, 8).getTime()
    applyRelayObservation(stats, { type: 'read-time', url, at, duration: 120 })
    expect(stats.days[0].connections).toBe(0)
    expect(stats.days[0].readTime.count).toBe(1)
    expect(observationDate(at)).toBe('2026-10-08')
  })

  it('bounds timing storage while keeping every sample in the median', () => {
    const stats = record()
    const at = Date.now()
    for (let duration = 0; duration < 130000; duration++)
      applyRelayObservation(stats, { type: 'write-time', url, at, duration })
    const timing = stats.days[0].writeTime
    expect(timing.count).toBe(130000)
    expect(Object.keys(timing.buckets).length).toBeLessThan(400)
    expect(medianTiming(timing)).toBe(65000)
    expect(
      medianTiming(mergeTimings([emptyObservationDay('2026-10-08').writeTime]))
    ).toBeUndefined()
  })

  it('handles relay-provided object keys and limits arbitrary rejection reasons', () => {
    const stats = record()
    const at = Date.now()
    applyRelayObservation(stats, { type: 'read-rejection', url, at, reason: '__proto__' })
    for (let i = 0; i < 200; i++)
      applyRelayObservation(stats, { type: 'read-rejection', url, at, reason: `restricted: ${i}` })
    expect(stats.days[0].readRejections['__proto__']).toBe(1)
    expect(Object.keys(stats.days[0].readRejections).length).toBe(51)
    expect(sumCounts(stats.days[0].readRejections)).toBe(201)
  })
})
