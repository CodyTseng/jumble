import Logo from '@/assets/Logo'
import Icon from '@/assets/Icon'
import AccountButton from './AccountButton'
import AboutInfoButton from './AboutInfoButton'
import NotificationButton from './NotificationButton'
import PostButton from './PostButton'
import RelaySettingsButton from './RelaySettingsButton'
import SearchButton from './SearchButton'

export default function PrimaryPageSidebar() {
  return (
    <div className="w-16 xl:w-52 hidden sm:flex flex-col pb-2 pt-4 px-2 justify-between h-full shrink-0">
      <div className="space-y-2">
        <div className="px-2 mb-10 w-full">
          <Icon className="xl:hidden" />
          <Logo className="max-xl:hidden" />
        </div>
        <PostButton />
        <RelaySettingsButton />
        <NotificationButton />
        <SearchButton />
        <AboutInfoButton />
      </div>
      <AccountButton />
    </div>
  )
}
