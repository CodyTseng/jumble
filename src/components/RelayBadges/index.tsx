import { Badge } from '@/components/ui/badge'
import { TRelayInfo } from '@/types'
import { useMemo } from 'react'

export default function RelayBadges({ relayInfo }: { relayInfo: TRelayInfo }) {
  const badges = useMemo(() => {
    const b: string[] = []
    if (relayInfo.limitation?.auth_required) {
      b.push('Auth')
    }
    if (relayInfo.supported_nips?.includes(50)) {
      b.push('Search')
    }
    if (relayInfo.limitation?.payment_required) {
      b.push('Payment')
    }
    if (relayInfo.supported_nips?.includes(29)) {
      b.push('Groups')
    }
    return b
  }, [relayInfo])

  if (!badges.length) {
    return null
  }

  return (
    <div className="flex gap-2">
      {badges.includes('Auth') && (
        <Badge className="bg-green-400 hover:bg-green-400/80">Auth</Badge>
      )}
      {badges.includes('Search') && (
        <Badge className="bg-pink-400 hover:bg-pink-400/80">Search</Badge>
      )}
      {badges.includes('Payment') && (
        <Badge className="bg-orange-400 hover:bg-orange-400/80">Payment</Badge>
      )}
      {badges.includes('Groups') && (
        <Badge className="bg-blue-400 hover:bg-blue-400/80">Groups</Badge>
      )}
    </div>
  )
}
