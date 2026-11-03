import { observeNativeKeyboard } from '@/lib/native-appearance'
import { useEffect, useState } from 'react'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import HomeButton from './HomeButton'
import MessagesButton from './MessagesButton'
import NotificationsButton from './NotificationsButton'
import PostButton from './PostButton'
import ProfileButton from './ProfileButton'
import SearchButton from './SearchButton'

export default function BottomNavigationBar() {
  const { enableDm } = useUserPreferences()
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  useEffect(() => observeNativeKeyboard(setKeyboardVisible), [])

  return (
    <div
      data-bottom-navigation
      hidden={keyboardVisible}
      // Scroll locks reserve the removed scrollbar on the body's physical right
      // edge. Match that gap so the fixed bar keeps its width in both LTR and RTL.
      className="safe-area-x bg-background fixed right-[var(--removed-body-scroll-bar-size,0px)] bottom-0 left-0 z-40 border-t"
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
