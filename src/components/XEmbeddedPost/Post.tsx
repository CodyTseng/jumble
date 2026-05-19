import { Skeleton } from '@/components/ui/skeleton'
import { toExternalContent } from '@/lib/link'
import { cn, isTouchDevice } from '@/lib/utils'
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
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const [loaded, setLoaded] = useState(false)
  const loadingRef = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    if (!tweetId || !containerRef.current || loadingRef.current) return
    loadingRef.current = true

    // Load Twitter widgets script if not already loaded
    if (!window.twttr) {
      const script = document.createElement('script')
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.onload = () => {
        if (!unmountedRef.current) {
          embedTweet()
        }
      }
      script.onerror = () => {
        if (!unmountedRef.current) {
          console.error('Failed to load Twitter widgets script')
          loadingRef.current = false
        }
      }
      document.body.appendChild(script)
    } else {
      embedTweet()
    }

    function embedTweet() {
      if (!containerRef.current || !window.twttr || !tweetId || unmountedRef.current) return

      window.twttr.widgets
        .createTweet(tweetId, containerRef.current, {
          theme: theme === 'light' ? 'light' : 'dark',
          dnt: true, // Do not track
          conversation: 'none' // Hide conversation thread
        })
        .then((element: HTMLElement | undefined) => {
          if (unmountedRef.current) return
          if (element) {
            // Twitter's widget adds a 10px vertical margin; drop it so the
            // tweet sits flush with the rounded container and overlay.
            element.style.margin = '0'
            setTimeout(() => {
              if (!unmountedRef.current) {
                setLoaded(true)
              }
            }, 100)
          } else {
            console.error('Failed to embed tweet')
          }
        })
        .catch((error) => {
          if (!unmountedRef.current) {
            console.error('Error embedding tweet:', error)
          }
        })
        .finally(() => {
          loadingRef.current = false
        })
    }

    return () => {
      unmountedRef.current = true
      // Clear the container to prevent memory leaks
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [tweetId, theme])

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
        maxWidth: '550px',
        minHeight: '225px'
      }}
    >
      <div ref={containerRef} className="cursor-pointer" onClick={handleViewComments} />
      {!loaded && <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />}
      {loaded && embedded && !supportTouch && (
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
