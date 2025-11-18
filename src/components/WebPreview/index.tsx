import { useFetchWebMetadata } from '@/hooks/useFetchWebMetadata'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useMemo } from 'react'
import Image from '../Image'
import ExternalLink from '../ExternalLink'

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
  const { isSmallScreen } = useScreenSize()
  const { title, description, image } = useFetchWebMetadata(url)

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }, [url])

  if (!autoLoadMedia && !mustLoad) {
    return null
  }

  if (!title) {
    if (mustLoad) {
      return <ExternalLink url={url} justOpenLink />
    } else {
      return null
    }
  }

  if (isSmallScreen && image) {
    return (
      <div
        className="rounded-lg border mt-2 overflow-hidden"
        onClick={(e) => {
          e.stopPropagation()
          window.open(url, '_blank')
        }}
      >
        <Image image={{ url: image }} className="w-full h-44 rounded-none" hideIfError />
        <div className="bg-muted p-2 w-full">
          <div className="text-xs text-muted-foreground">{hostname}</div>
          <div className="font-semibold line-clamp-1">{title}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('p-0 clickable flex w-full border rounded-lg overflow-hidden', className)}
      onClick={(e) => {
        e.stopPropagation()
        window.open(url, '_blank')
      }}
    >
      {image && (
        <Image
          image={{ url: image }}
          className="aspect-[4/3] xl:aspect-video bg-foreground h-44 rounded-none"
          hideIfError
        />
      )}
      <div className="flex-1 w-0 p-2">
        <div className="text-xs text-muted-foreground">{hostname}</div>
        <div className="font-semibold line-clamp-2">{title}</div>
        <div className="text-xs text-muted-foreground line-clamp-5">{description}</div>
      </div>
    </div>
  )
}
