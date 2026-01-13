import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExternalLink from '../ExternalLink'
import Post from './Post'

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
  const { autoLoadMedia } = useContentPolicy()
  const [display, setDisplay] = useState(autoLoadMedia || mustLoad)
  const { tweetId } = useMemo(() => parseXUrl(url), [url])

  useEffect(() => {
    if (autoLoadMedia || mustLoad) {
      setDisplay(true)
    }
  }, [autoLoadMedia, mustLoad])

  if (!tweetId) {
    return <ExternalLink url={url} />
  }

  if (!display) {
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

  return <Post tweetId={tweetId} url={url} className={className} embedded={embedded} />
}

function parseXUrl(url: string): { tweetId: string | null } {
  const pattern = /(?:twitter\.com|x\.com)\/(?:#!\/)?(?:\w+)\/status(?:es)?\/(\d+)/i
  const match = url.match(pattern)
  return {
    tweetId: match ? match[1] : null
  }
}
