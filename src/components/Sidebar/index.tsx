import Icon from '@/assets/Icon'
import Logo from '@/assets/Logo'
import AccountButton from './AccountButton'
import HomeButton from './HomeButton'
import NotificationsButton from './NotificationButton'
import PostButton from './PostButton'
import RelaysButton from './ExploreButton'
import SearchButton from './SearchButton'
import SettingsButton from './SettingsButton'

export default function PrimaryPageSidebar() {
  return (
    <div className="w-16 xl:w-52 hidden sm:flex flex-col pb-2 pt-4 px-2 justify-between h-full shrink-0">
      <div className="space-y-2">
        <div className="px-2 mb-8 w-full">
          <Icon className="xl:hidden" />
          <Logo className="max-xl:hidden" />
        </div>
        <HomeButton />
        <RelaysButton />
        <NotificationsButton />
        <SearchButton />
        <SettingsButton />
        <PostButton />
      </div>
      <AccountButton />
    </div>
  )
}
