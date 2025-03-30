import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useFetchRelayInfo } from '@/hooks'
import { cn } from '@/lib/utils'
import { Server } from 'lucide-react'
import { useMemo } from 'react'

export default function RelayIcon({
  url,
  className,
  iconSize = 14
}: {
  url?: string
  className?: string
  iconSize?: number
}) {
  const { relayInfo } = useFetchRelayInfo(url)
  const iconUrl = useMemo(() => {
    if (relayInfo?.icon) {
      return relayInfo.icon
    }
    if (!url) return
    const u = new URL(url)
    return `${u.protocol === 'wss:' ? 'https:' : 'http:'}//${u.host}/favicon.ico`
  }, [url, relayInfo])

  return (
    <Avatar className={cn('w-6 h-6', className)}>
      <AvatarImage src={iconUrl} className="object-cover object-center" />
      <AvatarFallback>
        <Server size={iconSize} />
      </AvatarFallback>
    </Avatar>
  )
}
