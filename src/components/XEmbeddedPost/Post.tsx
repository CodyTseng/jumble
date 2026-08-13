import { Skeleton } from '@/components/ui/skeleton'
import { canHover } from '@/lib/device'
import { toExternalContent } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useTheme } from '@/providers/ThemeProvider'
import { MessageCircle } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PostProps {
  tweetId: string
  url: string
  className?: string
  embedded?: boolean
}

const Post = memo(({ tweetId, url, className, embedded = true }: PostProps) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { push } = useSecondaryPage()
  const supportsHover = useMemo(() => canHover(), [])
  const [loaded, setLoaded] = useState(false)
  const [height, setHeight] = useState(225)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      dnt: 'true',
      frame: 'false',
      hideCard: 'false',
      hideThread: 'true',
      id: tweetId,
      theme: theme === 'light' ? 'light' : 'dark',
      width: '550px'
    })
    return `https://platform.twitter.com/embed/Tweet.html?${params}`
  }, [tweetId, theme])

  useEffect(() => {
    setLoaded(false)
    setHeight(225)

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://platform.twitter.com') return
      if (event.source !== iframeRef.current?.contentWindow) return
      const message = event.data?.['twttr.embed'] as
        | { method?: string; params?: { height?: number }[] }
        | undefined
      if (!message) return

      if (message.method === 'twttr.private.rendered') {
        setLoaded(true)
      } else if (
        message.method === 'twttr.private.resize' &&
        typeof message.params?.[0]?.height === 'number' &&
        Number.isFinite(message.params[0].height)
      ) {
        setHeight(Math.max(225, Math.min(1_000, Math.ceil(message.params[0].height))))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [iframeSrc])

  const handleViewComments = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      push(toExternalContent(url))
    },
    [url, push]
  )

  return (
    <div
      className={cn('group relative rounded-lg', className)}
      style={{
        maxWidth: '550px'
      }}
    >
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title={t('X post')}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="block w-full border-0"
        style={{ height }}
      />
      {!loaded && <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />}
      {loaded && embedded && supportsHover && (
        /* Hover overlay */
        <div
          className="bg-background/40 absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg border opacity-0 backdrop-blur-sm transition-opacity duration-200 ease-out group-hover:opacity-100"
          onClick={handleViewComments}
        >
          <div className="bg-background text-foreground ring-border flex scale-95 items-center gap-2 rounded-full px-4 py-2 shadow-lg ring-1 transition-transform duration-200 ease-out group-hover:scale-100">
            <MessageCircle className="size-4" strokeWidth={2} />
            <span className="text-sm font-medium">{t('View Nostr comments')}</span>
          </div>
        </div>
      )}
    </div>
  )
})

Post.displayName = 'XPost'

export default Post
