import { faviconUrl } from '@/lib/faviconUrl'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useState } from 'react'

export function Favicon({
  domain,
  className,
  fallback = null
}: {
  domain: string
  className?: string
  fallback?: React.ReactNode
}) {
  const { faviconUrlTemplate } = useContentPolicy()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  if (error) return fallback

  const url = faviconUrl(faviconUrlTemplate, `https://${domain}`)

  return (
    <div className={cn('relative', className)}>
      {loading && <div className={cn('absolute inset-0', className)}>{fallback}</div>}
      <img
        src={url}
        alt={domain}
        className={cn('absolute inset-0', loading && 'opacity-0', className)}
        onError={() => setError(true)}
        onLoad={() => setLoading(false)}
      />
    </div>
  )
}
