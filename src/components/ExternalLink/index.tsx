import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toExternalContent, toSearch } from '@/lib/link'
import { truncateUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ExternalLink as ExternalLinkIcon, MessageSquare, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  const { isSmallScreen } = useScreenSize()
  const { push } = useSecondaryPage()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const displayUrl = useMemo(() => truncateUrl(url), [url])

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSmallScreen) {
      setIsDrawerOpen(false)
    }
    window.open(url, '_blank', 'noreferrer')
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

  const handleSearchNotes = (e: React.MouseEvent) => {
    e.stopPropagation()
    const searchUrl = toSearch({ type: 'notes', search: url, input: url })
    if (isSmallScreen) {
      setIsDrawerOpen(false)
      setTimeout(() => push(searchUrl), 100) // wait for drawer to close
      return
    }
    push(searchUrl)
  }

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

  const trigger = (
    <span
      className={cn('cursor-pointer text-primary hover:underline', className)}
      onClick={(e) => {
        e.stopPropagation()
        if (isSmallScreen) {
          setIsDrawerOpen(true)
        }
      }}
      title={url}
    >
      {displayUrl}
    </span>
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerOverlay
            onClick={(e) => {
              e.stopPropagation()
              setIsDrawerOpen(false)
            }}
          />
          <DrawerContent hideOverlay>
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
                onClick={handleViewDiscussions}
                className="w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
                variant="ghost"
              >
                <MessageSquare />
                {t('View Nostr discussions')}
              </Button>
              <Button
                onClick={handleSearchNotes}
                className="w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
                variant="ghost"
              >
                <Search />
                {t('Search for notes')}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <span className={cn('cursor-pointer text-primary hover:underline', className)} title={url}>
          {displayUrl}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handleOpenLink}>
          <ExternalLinkIcon />
          {t('Open link')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewDiscussions}>
          <MessageSquare />
          {t('View Nostr discussions')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSearchNotes}>
          <Search />
          {t('Search for notes')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
