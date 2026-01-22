import { IS_COMMUNITY_MODE } from '@/constants'
import { cn } from '@/lib/utils'
import BackgroundAudio from '../BackgroundAudio'
import AccountButton from './AccountButton'
import ExploreButton from './ExploreButton'
import FollowingButton from './FollowingButton'
import HomeButton from './HomeButton'
import MessagesButton from './MessagesButton'
import NotificationsButton from './NotificationsButton'

export default function BottomNavigationBar() {
  return (
    <div
      className={cn('fixed bottom-0 z-40 w-full border-t bg-background')}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <BackgroundAudio className="rounded-none border-x-0 border-b border-t-0 bg-background" />
      <div className="flex w-full items-center justify-around [&_svg]:size-4 [&_svg]:shrink-0">
        <HomeButton />
        {!IS_COMMUNITY_MODE && <ExploreButton />}
        {IS_COMMUNITY_MODE && <FollowingButton />}
        <NotificationsButton />
        <MessagesButton />
        <AccountButton />
      </div>
    </div>
  )
}
