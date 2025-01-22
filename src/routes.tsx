import { match } from 'path-to-regexp'
import { isValidElement } from 'react'
import FollowingListPage from './pages/secondary/FollowingListPage'
import MuteListPage from './pages/secondary/MuteListPage'
import NoteListPage from './pages/secondary/NoteListPage'
import NotePage from './pages/secondary/NotePage'
import OthersRelaySettingsPage from './pages/secondary/OthersRelaySettingsPage'
import ProfileEditorPage from './pages/secondary/ProfileEditorPage'
import ProfileListPage from './pages/secondary/ProfileListPage'
import ProfilePage from './pages/secondary/ProfilePage'
import RelayPage from './pages/secondary/RelayPage'
import RelaySettingsPage from './pages/secondary/RelaySettingsPage'
import SettingsPage from './pages/secondary/SettingsPage'

const ROUTES = [
  { path: '/notes', element: <NoteListPage /> },
  { path: '/notes/:id', element: <NotePage /> },
  { path: '/users', element: <ProfileListPage /> },
  { path: '/users/:id', element: <ProfilePage /> },
  { path: '/users/:id/following', element: <FollowingListPage /> },
  { path: '/users/:id/relays', element: <OthersRelaySettingsPage /> },
  { path: '/relay-settings', element: <RelaySettingsPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/profile-editor', element: <ProfileEditorPage /> },
  { path: '/relays/:url', element: <RelayPage /> },
  { path: '/mutes', element: <MuteListPage /> }
]

export const routes = ROUTES.map(({ path, element }) => ({
  path,
  element: isValidElement(element) ? element : null,
  matcher: match(path)
}))
