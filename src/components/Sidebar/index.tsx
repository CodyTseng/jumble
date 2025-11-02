import Icon from '@/assets/Icon'
import Logo from '@/assets/Logo'
import { cn } from '@/lib/utils'
import { usePrimaryPage } from '@/PageManager'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { ChevronsLeft, ChevronsRight, Globe } from 'lucide-react'
import { useState } from 'react'
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

function CommunityFavicon({ domain, size }: { domain: string; size: number }) {
  const [faviconUrlIndex, setFaviconUrlIndex] = useState(0)

  // Use inline styles for dynamic sizing
  const sizeInRem = size * 0.25 // Tailwind size-8 = 2rem, size-12 = 3rem
  const style = {
    width: `${sizeInRem}rem`,
    height: `${sizeInRem}rem`
  }

  // Add cache busting parameter to force fresh loads
  const cacheBuster = Date.now()

  // Try multiple favicon sources in order of preference
  const faviconUrls = [
    `https://${domain}/favicon.svg?v=${cacheBuster}`,
    `https://${domain}/favicon.png?v=${cacheBuster}`,
    `https://${domain}/favicon.ico?v=${cacheBuster}`,
    `https://${domain}/apple-touch-icon.png?v=${cacheBuster}`
  ]

  const handleError = () => {
    // Try next favicon URL
    if (faviconUrlIndex < faviconUrls.length - 1) {
      setFaviconUrlIndex(faviconUrlIndex + 1)
    } else {
      // All URLs failed, will show globe
      setFaviconUrlIndex(-1)
    }
  }

  if (faviconUrlIndex === -1) {
    // All favicon attempts failed, fallback to globe icon
    return <Globe style={style} className="text-primary" />
  }

  return (
    <img
      src={faviconUrls[faviconUrlIndex]}
      alt={`${domain} favicon`}
      style={style}
      className="object-contain"
      onError={handleError}
    />
  )
}

export default function PrimaryPageSidebar() {
  const { isSmallScreen } = useScreenSize()
  const { themeSetting } = useTheme()
  const { sidebarCollapse, updateSidebarCollapse, enableSingleColumnLayout } = useUserPreferences()
  const { pubkey } = useNostr()
  const { feedInfo } = useFeed()
  const { navigate } = usePrimaryPage()

  // Check if user has a community domain
  const hasCommunity = feedInfo.feedType === 'nip05-domain' && feedInfo.id

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
            className="px-3 py-1 mb-4 w-full cursor-pointer hover:opacity-80 transition-opacity flex justify-center"
            onClick={() => navigate('home')}
            aria-label="Go to home"
          >
            {hasCommunity ? (
              <CommunityFavicon key={feedInfo.id} domain={feedInfo.id!} size={8} />
            ) : (
              <Icon />
            )}
          </button>
        ) : (
          <button
            className="px-4 mb-4 w-full cursor-pointer hover:opacity-80 transition-opacity flex justify-center"
            onClick={() => navigate('home')}
            aria-label="Go to home"
          >
            {hasCommunity ? (
              <CommunityFavicon key={feedInfo.id} domain={feedInfo.id!} size={12} />
            ) : (
              <Logo />
            )}
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
