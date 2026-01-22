import BookmarkPage from '@/pages/primary/BookmarkPage'
import DmPage from '@/pages/primary/DmPage'
import ExplorePage from '@/pages/primary/ExplorePage'
import FollowingPage from '@/pages/primary/FollowingPage'
import MePage from '@/pages/primary/MePage'
import NoteListPage from '@/pages/primary/NoteListPage'
import NotificationListPage from '@/pages/primary/NotificationListPage'
import ProfilePage from '@/pages/primary/ProfilePage'
import RelayPage from '@/pages/primary/RelayPage'
import SearchPage from '@/pages/primary/SearchPage'
import SettingsPage from '@/pages/primary/SettingsPage'
import { TPageRef } from '@/types'
import { createRef } from 'react'

const PRIMARY_ROUTE_CONFIGS = [
  { key: 'home', component: NoteListPage },
  { key: 'explore', component: ExplorePage },
  { key: 'following', component: FollowingPage },
  { key: 'notifications', component: NotificationListPage },
  { key: 'dms', component: DmPage },
  { key: 'me', component: MePage },
  { key: 'profile', component: ProfilePage },
  { key: 'relay', component: RelayPage },
  { key: 'search', component: SearchPage },
  { key: 'bookmark', component: BookmarkPage },
  { key: 'settings', component: SettingsPage }
] as const

export const PRIMARY_PAGE_REF_MAP = PRIMARY_ROUTE_CONFIGS.reduce(
  (acc, { key }) => {
    acc[key] = createRef<TPageRef>()
    return acc
  },
  {} as Record<string, React.RefObject<TPageRef>>
)

export const PRIMARY_PAGE_MAP = PRIMARY_ROUTE_CONFIGS.reduce(
  (acc, { key, component: Component }) => {
    acc[key] = <Component ref={PRIMARY_PAGE_REF_MAP[key]} />
    return acc
  },
  {} as Record<(typeof PRIMARY_ROUTE_CONFIGS)[number]['key'], JSX.Element>
)

export type TPrimaryPageName = keyof typeof PRIMARY_PAGE_MAP
