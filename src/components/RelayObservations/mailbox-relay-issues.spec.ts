import { emptyObservationDay } from '@/lib/relay-observation'
import { describe, expect, it } from 'vitest'
import { getMailboxRelayIssues, getMailboxRelaySeverity } from './mailbox-relay-issues'

describe('mailbox relay issues', () => {
  it('tolerates occasional connection failures while flagging high failure rates', () => {
    const day = emptyObservationDay('2026-10-09')
    expect(getMailboxRelaySeverity(day, 'both')).toBeUndefined()
    day.connections = 100
    day.connectionFailures = { timeout: 15 }
    expect(getMailboxRelaySeverity(day, 'both')).toBe('healthy')
    day.connectionFailures.timeout = 16
    expect(getMailboxRelaySeverity(day, 'both')).toBe('warning')
    day.connectionFailures.timeout = 30
    expect(getMailboxRelaySeverity(day, 'both')).toBe('warning')
    day.connectionFailures.timeout = 31
    expect(getMailboxRelaySeverity(day, 'both')).toBe('degraded')
    day.connectionFailures.timeout = 50
    expect(getMailboxRelaySeverity(day, 'both')).toBe('degraded')
    day.writeTimeouts = 1
    expect(getMailboxRelaySeverity(day, 'both')).toBe('degraded')
    day.connectionFailures.timeout = 51
    expect(getMailboxRelaySeverity(day, 'both')).toBe('critical')
  })

  it('flags read/write issues only for the configured direction', () => {
    const day = emptyObservationDay('2026-10-09')
    day.connections = 100
    day.writeTimeouts = 1
    expect(getMailboxRelaySeverity(day, 'read')).toBe('healthy')
    expect(getMailboxRelaySeverity(day, 'write')).toBe('warning')
    day.writeTimeouts = 0
    day.readRejections = { restricted: 1 }
    expect(getMailboxRelaySeverity(day, 'read')).toBe('warning')
    expect(getMailboxRelaySeverity(day, 'write')).toBe('healthy')
  })

  it('counts connection issues and only the configured read/write directions', () => {
    const day = emptyObservationDay('2026-10-09')
    day.connections = 10
    day.connectionFailures = { timeout: 2 }
    day.readRejections = { restricted: 3 }
    day.readTimeouts = { 'first-event': 4 }
    day.writeRejections = { blocked: 5 }
    day.writeTimeouts = 6
    expect(getMailboxRelayIssues(day, 'read')).toBe(9)
    expect(getMailboxRelayIssues(day, 'write')).toBe(13)
    expect(getMailboxRelayIssues(day, 'both')).toBe(20)
  })

  it('distinguishes absent samples from operations with no recorded issues', () => {
    const day = emptyObservationDay('2026-10-09')
    expect(getMailboxRelayIssues(undefined, 'both')).toBeUndefined()
    expect(getMailboxRelayIssues(day, 'both')).toBeUndefined()
    day.readTime.count = 1
    expect(getMailboxRelayIssues(day, 'read')).toBe(0)
    expect(getMailboxRelayIssues(day, 'write')).toBeUndefined()
    day.writeTimeouts = 1
    expect(getMailboxRelayIssues(day, 'write')).toBe(1)
  })
})
