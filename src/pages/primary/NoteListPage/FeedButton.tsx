import FeedSwitcher from '@/components/FeedSwitcher'
import RelayIcon from '@/components/RelayIcon'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { IS_COMMUNITY_MODE, COMMUNITY_RELAY_SETS, COMMUNITY_RELAYS } from '@/constants'
import { simplifyUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ChevronDown, Server, Star, UsersRound } from 'lucide-react'
import { forwardRef, HTMLAttributes, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FeedButton({ className }: { className?: string }) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  if (IS_COMMUNITY_MODE && COMMUNITY_RELAY_SETS.length + COMMUNITY_RELAYS.length <= 1) {
    return <FeedSwitcherTrigger className={className} />
  }

  if (isSmallScreen) {
    return (
      <>
        <FeedSwitcherTrigger className={className} onClick={() => setOpen(true)} />
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh]">
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
              style={{
                touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch'
              }}
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
      <PopoverContent sideOffset={0} side="bottom" className="w-[400px] overflow-hidden p-0">
        <div
          className="max-h-[calc(100vh-16rem)] overflow-y-auto overscroll-contain px-4 py-3"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <FeedSwitcher close={() => setOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

const FeedSwitcherTrigger = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { t } = useTranslation()
    const { feedInfo, relayUrls } = useFeed()
    const { relaySets } = useFavoriteRelays()
    const activeRelaySet = useMemo(() => {
      return feedInfo?.feedType === 'relays' && feedInfo.id
        ? (relaySets.find((set) => set.id === feedInfo.id) ??
            COMMUNITY_RELAY_SETS.find((set) => set.id === feedInfo.id))
        : undefined
    }, [feedInfo, relaySets])
    const title = useMemo(() => {
      if (feedInfo?.feedType === 'following') {
        return t('Following')
      }
      if (feedInfo?.feedType === 'pinned') {
        return t('Special Follow')
      }
      if (relayUrls.length === 0) {
        return t('Choose a feed')
      }
      if (feedInfo?.feedType === 'relay') {
        return simplifyUrl(feedInfo?.id ?? '')
      }
      if (feedInfo?.feedType === 'relays') {
        return feedInfo.name ?? activeRelaySet?.name ?? activeRelaySet?.id
      }
    }, [feedInfo, activeRelaySet])

    const icon = useMemo(() => {
      if (feedInfo?.feedType === 'following') return <UsersRound />
      if (feedInfo?.feedType === 'pinned') return <Star />
      if (feedInfo?.feedType === 'relay' && feedInfo.id) {
        return <RelayIcon url={feedInfo.id} />
      }

      return <Server />
    }, [feedInfo])

    const clickable =
      !IS_COMMUNITY_MODE || COMMUNITY_RELAY_SETS.length + COMMUNITY_RELAYS.length > 1

    return (
      <div
        className={cn(
          'flex h-full items-center gap-2 rounded-xl px-3',
          clickable && 'clickable',
          className
        )}
        ref={ref}
        {...props}
      >
        {icon}
        <div className="truncate text-lg font-semibold">{title}</div>
        {clickable && <ChevronDown />}
      </div>
    )
  }
)
