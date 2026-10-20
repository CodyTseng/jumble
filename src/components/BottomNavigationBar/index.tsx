import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import HomeButton from './HomeButton'
import MessagesButton from './MessagesButton'
import NotificationsButton from './NotificationsButton'
import PostButton from './PostButton'
import ProfileButton from './ProfileButton'
import SearchButton from './SearchButton'

export default function BottomNavigationBar() {
  const { enableDm } = useUserPreferences()

  return (
    <div
      className={cn('safe-area-x bg-background fixed inset-x-0 bottom-0 z-40 w-full border-t')}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <div className="flex w-full items-center justify-around [&_svg]:size-4 [&_svg]:shrink-0">
        <HomeButton />
        <SearchButton />
        <PostButton />
        {enableDm && <MessagesButton />}
        <NotificationsButton />
        {!enableDm && <ProfileButton />}
      </div>
    </div>
  )
}
