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
import WalletButton from './WalletButton'

export default function PrimaryPageSidebar() {
  const { isSmallScreen } = useScreenSize()
  const { themeSetting } = useTheme()
  const { sidebarCollapse, updateSidebarCollapse, enableSingleColumnLayout, showWalletInSidebar } = useUserPreferences()
  const { pubkey } = useNostr()
  const { navigate } = usePrimaryPage()

  if (isSmallScreen) return null

  return (
    <div
      className={cn(
        'relative flex h-full shrink-0 flex-col justify-between pb-2 pt-3',
        sidebarCollapse ? 'w-16 px-2' : 'w-52 px-4'
      )}
    >
      <div className="space-y-2">
        {sidebarCollapse ? (
          <button
            className="mb-4 w-full cursor-pointer px-3 py-1 transition-opacity hover:opacity-80"
            onClick={() => navigate('home')}
            aria-label="Go to home"
          >
            <Icon />
          </button>
        ) : (
          <button
            className="mb-4 w-full cursor-pointer px-4 transition-opacity hover:opacity-80"
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
        {showWalletInSidebar && <WalletButton collapse={sidebarCollapse} />}
        <AccountButton collapse={sidebarCollapse} />
      </div>
      <button
        className={cn(
          'absolute flex h-6 w-5 flex-col items-center justify-center rounded-l-md p-0 text-muted-foreground transition-colors hover:bg-background hover:text-foreground hover:shadow-md [&_svg]:size-4',
          themeSetting === 'pure-black' || enableSingleColumnLayout
            ? 'right-0 top-3'
            : '-right-0.5 top-5'
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
