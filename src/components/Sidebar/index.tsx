import Icon from '@/assets/Icon'
import Logo from '@/assets/Logo'
import { cn } from '@/lib/utils'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import AccountButton from './AccountButton'
import BookmarkButton from './BookmarkButton'
import RelaysButton from './ExploreButton'
import HomeButton from './HomeButton'
import LayoutSwitcher from './LayoutSwitcher'
import NotificationsButton from './NotificationButton'
import PostButton from './PostButton'
import ProfileButton from './ProfileButton'
import SearchButton from './SearchButton'
import SettingsButton from './SettingsButton'

export default function PrimaryPageSidebar() {
  const { isSmallScreen } = useScreenSize()
  const { themeSetting } = useTheme()
  const { sidebarCollapse, updateSidebarCollapse, enableSingleColumnLayout } = useUserPreferences()
  const { pubkey } = useNostr()
  const { navigate } = usePrimaryPage()

  if (isSmallScreen) return null

  return (
    <div
      className={cn(
        'relative flex flex-col pb-2 pt-3 justify-between h-full shrink-0',
        sidebarCollapse ? 'px-2 w-16' : 'px-4 w-52'
      )}
    >
      <div className="space-y-2">
        {sidebarCollapse ? (
          <button
            className="px-3 py-1 mb-6 w-full cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('home')}
            aria-label="Go to home"
          >
            <Icon />
          </button>
        ) : (
          <button
            className="px-4 mb-6 w-full cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('home')}
            aria-label="Go to home"
          >
            <Logo />
          </button>
        )}
        <HomeButton collapse={sidebarCollapse} />
        <RelaysButton collapse={sidebarCollapse} />
        <NotificationsButton collapse={sidebarCollapse} />
        <SearchButton collapse={sidebarCollapse} />
        <ProfileButton collapse={sidebarCollapse} />
        {pubkey && <BookmarkButton collapse={sidebarCollapse} />}
        <SettingsButton collapse={sidebarCollapse} />
        <PostButton collapse={sidebarCollapse} />
      </div>
      <div className="space-y-4">
        <LayoutSwitcher collapse={sidebarCollapse} />
        <AccountButton collapse={sidebarCollapse} />
      </div>
      <button
        className={cn(
          'absolute flex flex-col justify-center items-center right-0 w-5 h-6 p-0 rounded-l-md hover:shadow-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors [&_svg]:size-4',
          themeSetting === 'pure-black' || enableSingleColumnLayout ? 'top-3' : 'top-5'
        )}
        onClick={(e) => {
          e.stopPropagation()
          updateSidebarCollapse(!sidebarCollapse)
        }}
      >
        {sidebarCollapse ? <ChevronsRight /> : <ChevronsLeft />}
      </button>
    </div>
  )
}
