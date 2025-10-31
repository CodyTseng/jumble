import Icon from '@/assets/Icon'
import Logo from '@/assets/Logo'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { useLogoStyle } from '@/providers/LogoStyleProvider'
import { useReadsVisibility } from '@/providers/ReadsVisibilityProvider'
import { useListsVisibility } from '@/providers/ListsVisibilityProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { cn } from '@/lib/utils'
import AccountButton from './AccountButton'
import RelaysButton from './ExploreButton'
import HomeButton from './HomeButton'
import NotificationsButton from './NotificationButton'
import PostButton from './PostButton'
import ProfileButton from './ProfileButton'
import ReadsButton from './ReadsButton'
import ListsButton from './ListsButton'
import SearchButton from './SearchButton'
import SettingsButton from './SettingsButton'
import MultiColumnToggle from './MultiColumnToggle'

export default function PrimaryPageSidebar() {
  const { isSmallScreen } = useScreenSize()
  const { compactSidebar } = useCompactSidebar()
  const { logoStyle } = useLogoStyle()
  const { hideReadsInNavigation } = useReadsVisibility()
  const { hideListsInNavigation } = useListsVisibility()

  if (isSmallScreen) return null

  return (
    <nav
      className={cn(
        "flex flex-col pb-2 pt-4 px-2 justify-between h-full shrink-0 transition-all duration-300",
        compactSidebar ? "w-16" : "w-16 xl:w-52 xl:px-4"
      )}
      aria-label="Primary navigation"
    >
      <div className="space-y-2">
        <div className={cn(
          "mb-6 w-full transition-all duration-300",
          compactSidebar ? "" : "xl:px-4"
        )}>
          <Icon className={cn(compactSidebar ? "" : "xl:hidden")} />
          {logoStyle === 'image' ? (
            <Logo className={cn(compactSidebar ? "hidden" : "max-xl:hidden")} />
          ) : (
            <div className={cn(
              "text-2xl font-bold max-xl:hidden",
              compactSidebar && "hidden"
            )}>
              JumbleKat
            </div>
          )}
        </div>
        <HomeButton />
        {!hideReadsInNavigation && <ReadsButton />}
        {!hideListsInNavigation && <ListsButton />}
        <RelaysButton />
        <NotificationsButton />
        <SearchButton />
        <ProfileButton />
        <SettingsButton />
        <PostButton />
      </div>
      <div className="space-y-2">
        <MultiColumnToggle />
        <AccountButton />
      </div>
    </nav>
  )
}
