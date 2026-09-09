import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toExternalContent } from '@/lib/link'
import { getSafeExternalUrl, truncateUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Copy, ExternalLink as ExternalLinkIcon, MessageSquare } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function ExternalLink({
  url,
  className,
  children,
  justOpenLink
}: {
  url: string
  className?: string
  children?: React.ReactNode
  justOpenLink?: boolean
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { push } = useSecondaryPage()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const displayUrl = useMemo(() => truncateUrl(url), [url])
  const safeUrl = useMemo(() => getSafeExternalUrl(url), [url])

  const openInNewTab = () => {
    if (safeUrl) window.open(safeUrl, '_blank', 'noreferrer')
  }

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSmallScreen) {
      setIsDrawerOpen(false)
    }
    openInNewTab()
  }

  const handleViewDiscussions = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSmallScreen) {
      setIsDrawerOpen(false)
      setTimeout(() => push(toExternalContent(url)), 100) // wait for drawer to close
      return
    }
    push(toExternalContent(url))
  }

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(url)
    toast.success(t('Copied to Clipboard'))
    if (isSmallScreen) {
      setIsDrawerOpen(false)
    }
  }

  if (!safeUrl) {
    return <span className={cn('wrap-break-word', className)}>{children ?? displayUrl}</span>
  }

  if (justOpenLink) {
    return (
      <a
        href={safeUrl}
        target="_blank"
        rel="noreferrer noopener"
        className={cn('text-primary cursor-pointer hover:underline', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children ?? displayUrl}
      </a>
    )
  }

  // Middle-click or ctrl/cmd+left-click should open the link directly in a new tab
  // instead of showing the dropdown/drawer.
  const isNewTabClick = (e: { button: number; ctrlKey: boolean; metaKey: boolean }) =>
    e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))

  const trigger = (
    <span
      className={cn('text-primary cursor-pointer hover:underline', className)}
      onMouseDown={(e) => {
        // Prevent the autoscroll cursor on middle-click
        if (e.button === 1) e.preventDefault()
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          openInNewTab()
          return
        }
        if (isSmallScreen) {
          setIsDrawerOpen(true)
        }
      }}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          e.stopPropagation()
          openInNewTab()
        }
      }}
      title={url}
    >
      {children ?? displayUrl}
    </span>
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent title={t('Open link')}>
            <div className="py-2">
              <Button
                onClick={handleOpenLink}
                className="w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
                variant="ghost"
              >
                <ExternalLinkIcon />
                {t('Open link')}
              </Button>
              <Button
                onClick={handleCopyLink}
                className="w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
                variant="ghost"
              >
                <Copy />
                {t('Copy link')}
              </Button>
              <Button
                onClick={handleViewDiscussions}
                className="w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
                variant="ghost"
              >
                <MessageSquare />
                {t('View Nostr discussions')}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onPointerDown={(e) => {
          if (isNewTabClick(e)) {
            e.preventDefault()
            e.stopPropagation()
            openInNewTab()
          }
        }}
        onMouseDown={(e) => {
          // Prevent the autoscroll cursor on middle-click
          if (e.button === 1) e.preventDefault()
        }}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <span className={cn('text-primary cursor-pointer hover:underline', className)} title={url}>
          {children ?? displayUrl}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handleOpenLink}>
          <ExternalLinkIcon />
          {t('Open link')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <Copy />
          {t('Copy link')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewDiscussions}>
          <MessageSquare />
          {t('View Nostr discussions')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
