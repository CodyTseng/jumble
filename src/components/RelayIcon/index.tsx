import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useFetchRelayInfo } from '@/hooks'
import { Server } from 'lucide-react'
import { useMemo } from 'react'

export default function RelayIcon({
  url,
  className = 'w-6 h-6',
  iconSize = 14
}: {
  url: string
  className?: string
  iconSize?: number
}) {
  const { relayInfo } = useFetchRelayInfo(url)
  const iconUrl = useMemo(() => {
    if (relayInfo?.icon) {
      return relayInfo.icon
    }
    const u = new URL(url)
    return `${u.protocol === 'wss:' ? 'https:' : 'http:'}//${u.host}/favicon.ico`
  }, [url, relayInfo])

  return (
    <Avatar className={className}>
      <AvatarImage src={iconUrl} />
      <AvatarFallback>
        <Server size={iconSize} />
      </AvatarFallback>
    </Avatar>
  )
}
