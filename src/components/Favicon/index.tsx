import { cn } from '@/lib/utils'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentFormat, setCurrentFormat] = useState(0)

  // Try multiple favicon formats in order of preference
  const faviconFormats = [
    `/favicon.ico`,
    `/favicon.png`,
    `/favicon.svg`,
    `/apple-touch-icon.png`,
    `/android-chrome-192x192.png`
  ]

  if (error) return fallback

  const handleError = () => {
    // Try next format
    if (currentFormat < faviconFormats.length - 1) {
      setCurrentFormat(currentFormat + 1)
      setLoading(true)
    } else {
      setError(true)
    }
  }

  return (
    <div className={cn('relative', className)}>
      {loading && <div className={cn('absolute inset-0', className)}>{fallback}</div>}
      <img
        src={`https://${domain}${faviconFormats[currentFormat]}`}
        alt={domain}
        className={cn('absolute inset-0', loading && 'opacity-0', className)}
        onError={handleError}
        onLoad={() => setLoading(false)}
      />
    </div>
  )
}
