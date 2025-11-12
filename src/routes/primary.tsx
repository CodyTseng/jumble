import BookmarkPage from '@/pages/primary/BookmarkPage'
import ExplorePage from '@/pages/primary/ExplorePage'
import MePage from '@/pages/primary/MePage'
import NoteListPage from '@/pages/primary/NoteListPage'
import NotificationListPage from '@/pages/primary/NotificationListPage'
import ProfilePage from '@/pages/primary/ProfilePage'
import RelayPage from '@/pages/primary/RelayPage'
import SearchPage from '@/pages/primary/SearchPage'
import SettingsPage from '@/pages/primary/SettingsPage'
import { TPageRef } from '@/types'
import { createRef, ForwardRefExoticComponent, RefAttributes } from 'react'

type RouteConfig = {
  key: string
  component: ForwardRefExoticComponent<RefAttributes<TPageRef>>
}

const PRIMARY_ROUTE_CONFIGS: RouteConfig[] = [
  { key: 'home', component: NoteListPage },
  { key: 'explore', component: ExplorePage },
  { key: 'notifications', component: NotificationListPage },
  { key: 'me', component: MePage },
  { key: 'profile', component: ProfilePage },
  { key: 'relay', component: RelayPage },
  { key: 'search', component: SearchPage },
  { key: 'bookmark', component: BookmarkPage },
  { key: 'settings', component: SettingsPage }
]

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
  {} as Record<string, JSX.Element>
)

export type TPrimaryPageName = keyof typeof PRIMARY_PAGE_MAP
