import Icon from '@/assets/Icon'
import Logo from '@/assets/Logo'
import AboutInfoButton from './AboutInfoButton'
import AccountButton from './AccountButton'
import NotificationsButton from './NotificationButton'
import PostButton from './PostButton'
import HomeButton from './HomeButton'

export default function PrimaryPageSidebar() {
  return (
    <div className="w-16 xl:w-52 hidden sm:flex flex-col pb-2 pt-4 px-2 justify-between h-full shrink-0">
      <div className="space-y-2">
        <div className="px-2 mb-10 w-full">
          <Icon className="xl:hidden" />
          <Logo className="max-xl:hidden" />
        </div>
        <HomeButton />
        <NotificationsButton />
        <PostButton />
        <AboutInfoButton />
      </div>
      <AccountButton />
    </div>
  )
}
