import FollowingListPage from './pages/secondary/FollowingListPage'
import HashtagPage from './pages/secondary/HashtagPage'
import NotePage from './pages/secondary/NotePage'
import ProfilePage from './pages/secondary/ProfilePage'

export const ROUTES = [
  { path: 'note/:eventId', element: <NotePage /> },
  { path: 'user/:pubkey', element: <ProfilePage /> },
  { path: 'user/:pubkey/following', element: <FollowingListPage /> },
  { path: 'hashtag/:hashtag', element: <HashtagPage /> }
]
