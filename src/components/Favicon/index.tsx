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
  // Best practice 2025: Prioritize favicon services to avoid CORS errors
  const faviconFormats = [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=32`, // Google S2 API (no CORS, fast, cached)
    `https://icons.duckduckgo.com/ip3/${domain}.ico`, // DuckDuckGo fallback
    `https://${domain}/favicon.svg`, // Try direct SVG (modern)
    `https://${domain}/favicon.ico` // Legacy ICO fallback
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
        src={faviconFormats[currentFormat]}
        alt={domain}
        className={cn('absolute inset-0', loading && 'opacity-0', className)}
        onError={handleError}
        onLoad={() => setLoading(false)}
      />
    </div>
  )
}
