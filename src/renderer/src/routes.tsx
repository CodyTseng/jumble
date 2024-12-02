import { match } from 'path-to-regexp'
import { isValidElement } from 'react'
import FollowingListPage from './pages/secondary/FollowingListPage'
import HomePage from './pages/secondary/HomePage'
import NoteListPage from './pages/secondary/NoteListPage'
import NotePage from './pages/secondary/NotePage'
import ProfileListPage from './pages/secondary/ProfileListPage'
import ProfilePage from './pages/secondary/ProfilePage'
import RelaySettingsPage from './pages/secondary/RelaySettingsPage'

const ROUTES = [
  { path: '/', element: <HomePage /> },
  { path: '/note', element: <NoteListPage /> },
  { path: '/note/:id', element: <NotePage /> },
  { path: '/user', element: <ProfileListPage /> },
  { path: '/user/:id', element: <ProfilePage /> },
  { path: '/user/:id/following', element: <FollowingListPage /> },
  { path: '/relay-settings', element: <RelaySettingsPage /> }
]

export const routes = ROUTES.map(({ path, element }) => ({
  path,
  element: isValidElement(element) ? element : null,
  matcher: match(path)
}))
