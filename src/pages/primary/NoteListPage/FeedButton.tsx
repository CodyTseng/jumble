import FeedSwitcher from '@/components/FeedSwitcher'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { simplifyUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useCustomFeeds } from '@/providers/CustomFeedsProvider'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { BookmarkIcon, Box, ChevronDown, Hash, Highlighter, Search, UsersRound } from 'lucide-react'
import { forwardRef, HTMLAttributes, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FeedButton({ className }: { className?: string }) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  if (isSmallScreen) {
    return (
      <>
        <FeedSwitcherTrigger className={className} onClick={() => setOpen(true)} />
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[80vh]">
            <div
              className="overflow-y-auto overscroll-contain py-2 px-4"
              style={{ touchAction: 'pan-y' }}
            >
              <FeedSwitcher close={() => setOpen(false)} />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FeedSwitcherTrigger className={className} />
      </PopoverTrigger>
      <PopoverContent
        sideOffset={0}
        side="bottom"
        className="w-96 p-4 max-h-[80vh] overflow-auto scrollbar-hide"
      >
        <FeedSwitcher close={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

const FeedSwitcherTrigger = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { t } = useTranslation()
    const { feedInfo, relayUrls } = useFeed()
    const { relaySets } = useFavoriteRelays()
    const { customFeeds } = useCustomFeeds()
    const activeRelaySet = useMemo(() => {
      return feedInfo.feedType === 'relays' && feedInfo.id
        ? relaySets.find((set) => set.id === feedInfo.id)
        : undefined
    }, [feedInfo, relaySets])
    const activeCustomFeed = useMemo(() => {
      return feedInfo.feedType === 'custom' && feedInfo.id
        ? customFeeds.find((feed) => feed.id === feedInfo.id)
        : undefined
    }, [feedInfo, customFeeds])
    const title = useMemo(() => {
      if (feedInfo.feedType === 'following') {
        return t('Following')
      }
      if (feedInfo.feedType === 'bookmarks') {
        return t('Bookmarks')
      }
      if (feedInfo.feedType === 'highlights') {
        return t('Highlights')
      }
      if (feedInfo.feedType === 'custom') {
        return activeCustomFeed?.name ?? t('Custom Feed')
      }
      if (feedInfo.feedType === 'relay') {
        return simplifyUrl(feedInfo.id ?? '')
      }
      if (feedInfo.feedType === 'relays') {
        return activeRelaySet?.name ?? activeRelaySet?.id
      }
      // Fallback
      return t('Choose a relay')
    }, [feedInfo, activeRelaySet, activeCustomFeed, relayUrls])

    const icon = useMemo(() => {
      if (feedInfo.feedType === 'following') {
        return <UsersRound />
      }
      if (feedInfo.feedType === 'bookmarks') {
        return <BookmarkIcon />
      }
      if (feedInfo.feedType === 'highlights') {
        return <Highlighter />
      }
      if (feedInfo.feedType === 'custom') {
        if (activeCustomFeed?.searchParams.type === 'hashtag') {
          return <Hash />
        }
        return <Search />
      }
      return <Box />
    }, [feedInfo, activeCustomFeed])

    return (
      <div
        className={cn('flex items-center gap-2 clickable px-3 h-full rounded-lg [&_svg]:text-muted-foreground', className)}
        ref={ref}
        {...props}
      >
        {icon}
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>{title}</div>
        <ChevronDown />
      </div>
    )
  }
)
