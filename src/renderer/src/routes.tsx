import { match } from 'path-to-regexp'
import { isValidElement } from 'react'
import FollowingListPage from './pages/secondary/FollowingListPage'
import HashtagPage from './pages/secondary/HashtagPage'
import HomePage from './pages/secondary/HomePage'
import NotePage from './pages/secondary/NotePage'
import ProfilePage from './pages/secondary/ProfilePage'

const ROUTES = [
  { path: '/', element: <HomePage /> },
  { path: '/note/:id', element: <NotePage /> },
  { path: '/user/:id', element: <ProfilePage /> },
  { path: '/user/:id/following', element: <FollowingListPage /> },
  { path: '/hashtag/:id', element: <HashtagPage /> }
]

export const routes = ROUTES.map(({ path, element }) => ({
  path,
  element: isValidElement(element) ? element : null,
  matcher: match(path)
}))
