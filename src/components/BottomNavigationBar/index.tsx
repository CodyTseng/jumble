import { cn } from '@/lib/utils'
import BackgroundAudio from '../BackgroundAudio'
import HomeButton from './HomeButton'
import MessagesButton from './MessagesButton'
import NotificationsButton from './NotificationsButton'
import PostButton from './PostButton'
import SearchButton from './SearchButton'

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
        <SearchButton />
        <PostButton />
        <MessagesButton />
        <NotificationsButton />
      </div>
    </div>
  )
}
