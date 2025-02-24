import { cn } from '@/lib/utils'
import AccountButton from './AccountButton'
import ExploreButton from './ExploreButton'
import HomeButton from './HomeButton'
import NotificationsButton from './NotificationsButton'

export default function BottomNavigationBar() {
  return (
    <div
      className={cn(
        'fixed bottom-0 w-full z-40 bg-background/80 backdrop-blur-xl flex items-center justify-around [&_svg]:size-4 [&_svg]:shrink-0'
      )}
      style={{
        height: 'calc(3rem + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <HomeButton />
      <ExploreButton />
      <NotificationsButton />
      <AccountButton />
    </div>
  )
}
