import { Skeleton } from '@/components/ui/skeleton'
import { toExternalContent } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExternalLink from '../ExternalLink'

export default function XEmbeddedPost({
  url,
  className,
  mustLoad = false,
  embedded = true
}: {
  url: string
  className?: string
  mustLoad?: boolean
  embedded?: boolean
}) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { autoLoadMedia } = useContentPolicy()
  const { push } = useSecondaryPage()
  const [display, setDisplay] = useState(autoLoadMedia)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const { tweetId } = useMemo(() => parseXUrl(url), [url])
  const loadingRef = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoLoadMedia) {
      setDisplay(true)
    } else {
      setDisplay(false)
    }
  }, [autoLoadMedia])

  useEffect(() => {
    if (!tweetId || !containerRef.current || (!mustLoad && !display) || loadingRef.current) return
    loadingRef.current = true

    // Load Twitter widgets script if not already loaded
    if (!window.twttr) {
      const script = document.createElement('script')
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.onload = () => {
        embedTweet()
      }
      script.onerror = () => {
        setError(true)
        loadingRef.current = false
      }
      document.body.appendChild(script)
    } else {
      embedTweet()
    }

    function embedTweet() {
      if (!containerRef.current || !window.twttr || !tweetId) return

      // Clear container
      containerRef.current.innerHTML = ''

      window.twttr.widgets
        .createTweet(tweetId, containerRef.current, {
          theme: theme === 'light' ? 'light' : 'dark',
          dnt: true, // Do not track
          conversation: 'none' // Hide conversation thread
        })
        .then((element: HTMLElement | undefined) => {
          if (element) {
            setTimeout(() => setLoaded(true), 100)
          } else {
            setError(true)
          }
        })
        .catch(() => {
          setError(true)
        })
        .finally(() => {
          loadingRef.current = false
        })
    }
  }, [tweetId, display, mustLoad, theme])

  const handleViewComments = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      push(toExternalContent(url))
    },
    [url, push]
  )

  if (error || !tweetId) {
    return <ExternalLink url={url} />
  }

  if (!mustLoad && !display) {
    return (
      <div
        className="text-primary hover:underline truncate w-fit cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          setDisplay(true)
        }}
      >
        [{t('Click to load X post')}]
      </div>
    )
  }

  return (
    <div
      className={cn('relative group', className)}
      style={{
        maxWidth: '550px',
        minHeight: '225px'
      }}
    >
      <div ref={containerRef} className="cursor-pointer" onClick={handleViewComments} />
      {!loaded && <Skeleton className="absolute inset-0 w-full h-full rounded-xl" />}
      {loaded && embedded && (
        /* Hover overlay mask */
        <div
          className="absolute inset-0 bg-muted/30 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer rounded-xl"
          onClick={handleViewComments}
        >
          <div className="flex flex-col items-center gap-3">
            <MessageCircle className="size-12" strokeWidth={1.5} />
            <span className="text-lg font-medium">{t('View Nostr comments')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function parseXUrl(url: string): { tweetId: string | null } {
  const pattern = /(?:twitter\.com|x\.com)\/(?:#!\/)?(?:\w+)\/status(?:es)?\/(\d+)/i
  const match = url.match(pattern)
  return {
    tweetId: match ? match[1] : null
  }
}
