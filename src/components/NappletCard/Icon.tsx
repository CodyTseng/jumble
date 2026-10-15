import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { Blocks } from 'lucide-react'
import type { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export default function NappletIcon({ event, className }: { event: Event; className?: string }) {
  const { autoLoadProfilePicture } = useContentPolicy()
  const container = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    if (
      !autoLoadProfilePicture ||
      !container.current ||
      !event.tags.some((tag) => tag[0] === 'icon')
    )
      return
    const controller = new AbortController()
    let objectUrl: string | undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      void (async () => {
        const { validateManifest } = await import('@/lib/napplet/vendor/protocol/src/manifest')
        const { blossomBytes } = await import('@/lib/napplet/vendor/client/src/bytes')
        const { resourceMime } = await import('@/lib/napplet/vendor/client/src/resource-mime')
        const manifest = await validateManifest(event)
        if (!manifest.icon || controller.signal.aborted) return
        const bytes = await blossomBytes(
          manifest.icon.hash,
          manifest.servers,
          AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          1024 * 1024
        )
        if (resourceMime(bytes) !== manifest.icon.mime) return
        const blob = new Blob([bytes], { type: manifest.icon.mime })
        const image = await createImageBitmap(blob)
        const valid = image.width <= 2048 && image.height <= 2048
        image.close()
        if (!valid || controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })().catch(() => {
        /* Invalid icons fall back without blocking the app. */
      })
    })
    observer.observe(container.current)
    return () => {
      controller.abort()
      observer.disconnect()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [event.id, autoLoadProfilePicture])
  return (
    <div
      ref={container}
      className={cn('flex size-10 shrink-0 items-center justify-center', className)}
    >
      {url ? (
        <img src={url} alt="" className="size-full rounded object-contain" />
      ) : (
        <Blocks className="text-primary size-4/5" />
      )}
    </div>
  )
}
