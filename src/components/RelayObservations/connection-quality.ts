export type ConnectionQuality = 'healthy' | 'warning' | 'degraded' | 'critical'

export function getConnectionQuality(
  failureRate: number | undefined
): ConnectionQuality | undefined {
  if (failureRate === undefined) return undefined
  if (failureRate <= 0.15) return 'healthy'
  if (failureRate <= 0.3) return 'warning'
  if (failureRate <= 0.5) return 'degraded'
  return 'critical'
}

export const connectionQualityBackgrounds: Record<ConnectionQuality, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-yellow-400',
  degraded: 'bg-orange-500',
  critical: 'bg-red-500'
}
