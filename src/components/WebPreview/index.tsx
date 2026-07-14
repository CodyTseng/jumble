import { useFetchWebMetadata } from '@/hooks/useFetchWebMetadata'
import { isInsecureUrl, truncateUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { ExternalLink as ExternalLinkIcon, Globe2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from '../Image'
import { Skeleton } from '../ui/skeleton'

export default function WebPreview({
  url,
  className,
  mustLoad
}: {
  url: string
  className?: string
  mustLoad?: boolean
}) {
  const { autoLoadMedia } = useContentPolicy()
  const { allowInsecureConnection } = useUserPreferences()
  const previewRef = useRef<HTMLAnchorElement>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const shouldShow =
    (autoLoadMedia || Boolean(mustLoad)) &&
    (allowInsecureConnection || !isInsecureUrl(url))
  const { metadata, isLoading } = useFetchWebMetadata(url, shouldShow && isNearViewport)
  const { title, description, image } = metadata

  const { hostname, displayUrl } = useMemo(() => {
    try {
      const parsedUrl = new URL(url)
      return {
        hostname: parsedUrl.hostname.replace(/^www\./, ''),
        displayUrl: truncateUrl(url, 72)
      }
    } catch {
      return { hostname: '', displayUrl: truncateUrl(url, 72) }
    }
  }, [url])

  useEffect(() => {
    if (!shouldShow || isNearViewport) return

    const element = previewRef.current
    if (!element) return

    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setIsNearViewport(true)
        observer.disconnect()
      },
      { rootMargin: '400px 0px' }
    )
    observer.observe(element)

    return () => observer.disconnect()
  }, [shouldShow, isNearViewport])

  if (!shouldShow) return null

  const showLoading = !isNearViewport || isLoading
  const displayTitle = title || hostname || displayUrl
  const displayDescription = description || displayUrl

  return (
    <div className={cn('@container w-full', className)}>
      <a
        ref={previewRef}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="group bg-card hover:bg-accent/30 focus-visible:ring-ring flex h-24 w-full overflow-hidden rounded-xl border text-start transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:outline-none @[15rem]:h-28 @[28rem]:h-32"
        title={url}
      >
        <div className="bg-muted text-muted-foreground hidden h-full shrink-0 border-e @[15rem]:block @[15rem]:aspect-square @[15rem]:w-auto @[28rem]:aspect-[1.91/1]">
          {showLoading && <Skeleton className="h-full w-full rounded-none" />}
          {!showLoading && image && (
            <Image
              image={{ url: image }}
              alt={displayTitle}
              className="h-full w-full"
              classNames={{
                wrapper: 'h-full w-full rounded-none',
                skeleton: 'rounded-none',
                errorPlaceholder: 'text-muted-foreground'
              }}
              errorPlaceholder={<Globe2 className="size-7 opacity-50" />}
            />
          )}
          {!showLoading && !image && (
            <div className="flex h-full w-full items-center justify-center">
              <Globe2 className="size-7 opacity-50" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-2.5 @[15rem]:p-3">
          <div
            dir="ltr"
            className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs"
          >
            <span className="truncate">{hostname || displayUrl}</span>
            <ExternalLinkIcon className="size-3 shrink-0 opacity-60" />
          </div>
          {showLoading ? (
            <>
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="hidden h-3 w-full @[15rem]:block" />
              <Skeleton className="hidden h-3 w-2/3 @[28rem]:block" />
            </>
          ) : (
            <>
              <div dir="auto" className="line-clamp-2 font-semibold leading-snug">
                {displayTitle}
              </div>
              <div className="hidden @[15rem]:block">
                <div
                  dir="auto"
                  className="text-muted-foreground line-clamp-1 text-xs leading-relaxed @[28rem]:line-clamp-2"
                >
                  {displayDescription}
                </div>
              </div>
            </>
          )}
        </div>
      </a>
    </div>
  )
}
