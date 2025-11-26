import { useSecondaryPage } from '@/PageManager'
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger
} from '@/components/ui/responsive-menu'
import { toExternalContent } from '@/lib/link'
import { truncateUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { ExternalLink as ExternalLinkIcon, MessageSquare } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function ExternalLink({
  url,
  className,
  justOpenLink
}: {
  url: string
  className?: string
  justOpenLink?: boolean
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const displayUrl = useMemo(() => truncateUrl(url), [url])

  if (justOpenLink) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn('cursor-pointer text-primary hover:underline', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {displayUrl}
      </a>
    )
  }

  const handleOpenLink = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    window.open(url, '_blank', 'noreferrer')
  }

  const handleViewDiscussions = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setTimeout(() => push(toExternalContent(url)), 100) // wait for menu to close
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <ResponsiveMenu>
        <ResponsiveMenuTrigger asChild>
          <span
            className={cn('cursor-pointer text-primary hover:underline', className)}
            title={url}
          >
            {displayUrl}
          </span>
        </ResponsiveMenuTrigger>
        <ResponsiveMenuContent align="start">
          <ResponsiveMenuItem onClick={handleOpenLink}>
            <ExternalLinkIcon />
            {t('Open link')}
          </ResponsiveMenuItem>
          <ResponsiveMenuItem onClick={handleViewDiscussions}>
            <MessageSquare />
            {t('View Nostr discussions')}
          </ResponsiveMenuItem>
        </ResponsiveMenuContent>
      </ResponsiveMenu>
    </div>
  )
}
