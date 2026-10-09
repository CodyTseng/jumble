import { RelayObservationDay, sumCounts } from '@/lib/relay-observation'
import { TMailboxRelayScope } from '@/types'
import { ConnectionQuality, getConnectionQuality } from './connection-quality'

export function getMailboxRelayIssues(
  day: RelayObservationDay | undefined,
  scope: TMailboxRelayScope
) {
  if (!day) return undefined
  let issues = sumCounts(day.connectionFailures)
  let samples = day.connections
  if (scope !== 'write') {
    issues += sumCounts(day.readRejections) + sumCounts(day.readTimeouts)
    samples += day.readTime.count
  }
  if (scope !== 'read') {
    issues += sumCounts(day.writeRejections) + day.writeTimeouts
    samples += day.writeTime.count
  }
  return samples || issues ? issues : undefined
}

export function getMailboxRelaySeverity(
  day: RelayObservationDay | undefined,
  scope: TMailboxRelayScope
): ConnectionQuality | undefined {
  const issues = getMailboxRelayIssues(day, scope)
  if (!day || issues === undefined) return undefined
  const failures = sumCounts(day.connectionFailures)
  const failureRate = day.connections ? failures / day.connections : 0
  const quality = getConnectionQuality(failureRate)
  if (quality === 'critical' || quality === 'degraded') return quality
  // Read/write request totals are unavailable, so their issue counts have no rate.
  if (issues > failures) return 'warning'
  return quality
}
