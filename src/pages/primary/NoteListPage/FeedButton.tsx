import FeedSwitcher from '@/components/FeedSwitcher'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { simplifyUrl } from '@/lib/url'
import { useFeed } from '@/providers/FeedProvider'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ChevronDown, Server, UsersRound } from 'lucide-react'
import { forwardRef, HTMLAttributes, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FeedButton() {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  if (isSmallScreen) {
    return (
      <>
        <FeedSwitcherTrigger onClick={() => setOpen(true)} />
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[80vh]">
            <div className="p-4 overflow-auto">
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
        <FeedSwitcherTrigger />
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-96 p-4 max-h-[80vh] overflow-auto">
        <FeedSwitcher close={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

const FeedSwitcherTrigger = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const { t } = useTranslation()
    const { feedType } = useFeed()
    const { relayGroups, temporaryRelayUrls } = useRelaySettings()
    const activeGroup = relayGroups.find((group) => group.isActive)
    const title =
      feedType === 'following'
        ? t('Following')
        : temporaryRelayUrls.length > 0
          ? temporaryRelayUrls.length === 1
            ? simplifyUrl(temporaryRelayUrls[0])
            : t('Temporary')
          : activeGroup
            ? activeGroup.relayUrls.length === 1
              ? simplifyUrl(activeGroup.relayUrls[0])
              : activeGroup.groupName
            : t('Choose a relay collection')

    return (
      <div
        className="flex items-center gap-2 clickable px-3 h-full rounded-lg"
        ref={ref}
        {...props}
      >
        {feedType === 'following' ? <UsersRound /> : <Server />}
        <div className="text-lg font-semibold">{title}</div>
        <ChevronDown />
      </div>
    )
  }
)
