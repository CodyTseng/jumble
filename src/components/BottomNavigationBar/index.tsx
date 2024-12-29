import { cn } from '@/lib/utils'
import HomeButton from './HomeButton'
import NotificationsButton from './NotificationsButton'
import PostButton from './PostButton'
import AccountButton from './AccountButton'

export default function BottomNavigationBar({ visible = true }: { visible?: boolean }) {
  return (
    <div
      className={cn(
        'fixed bottom-0 w-full pb-4 h-16 z-20 bg-background/90 backdrop-blur-xl duration-700 transition-transform flex items-center justify-around [&_svg]:size-4 [&_svg]:shrink-0',
        visible ? '' : 'translate-y-full'
      )}
    >
      <HomeButton />
      <PostButton />
      <NotificationsButton />
      <AccountButton />
    </div>
  )
}
