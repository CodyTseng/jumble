import { truncateUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

export default function ExternalLink({ url, className }: { url: string; className?: string }) {
  const displayUrl = useMemo(() => truncateUrl(url), [url])

  return (
    <a
      className={cn('text-primary hover:underline', className)}
      href={url}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      rel="noreferrer"
      title={url}
    >
      {displayUrl}
    </a>
  )
}
