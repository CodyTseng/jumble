import { useFetchRelayInfo } from '@/hooks'
import { cn } from '@/lib/utils'
import { Server } from 'lucide-react'
import { useMemo } from 'react'
import Image from '../Image'

export default function RelayIcon({
  url,
  className,
  classNames
}: {
  url?: string
  className?: string
  classNames?: {
    fallback?: string
  }
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

  const fallback = <Server className={cn('size-5 bg-transparent', classNames?.fallback)} />

  if (!iconUrl) {
    return fallback
  }

  return (
    <Image
      image={{ url: iconUrl, dim: { width: 20, height: 20 } }}
      className={cn('size-6 rounded-full', className)}
      classNames={{
        skeleton: cn('size-6 rounded-full', className),
        errorPlaceholder: 'bg-transparent rounded-none shrink-0'
      }}
      errorPlaceholder={fallback}
    />
  )
}
