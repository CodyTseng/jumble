import { cn } from '@/lib/utils'
import HomeButton from './HomeButton'
import NotificationsButton from './NotificationsButton'
import PostButton from './PostButton'
import AccountButton from './AccountButton'

export default function BottomNavigationBar({ visible = true }: { visible?: boolean }) {
  return (
    <div
      className={cn(
        'fixed bottom-0 w-full z-20 bg-background/90 backdrop-blur-xl duration-700 transition-transform flex items-center justify-around [&_svg]:size-4 [&_svg]:shrink-0',
        visible ? '' : 'translate-y-full'
      )}
      style={{
        height: 'calc(3rem + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <HomeButton />
      <PostButton />
      <NotificationsButton />
      <AccountButton />
    </div>
  )
}
