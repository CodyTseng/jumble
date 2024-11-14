import 'yet-another-react-lightbox/styles.css'
import './assets/main.css'

import { Toaster } from '@renderer/components/ui/toaster'
import { ThemeProvider } from '@renderer/providers/ThemeProvider'
import { PageManager } from './PageManager'
import NoteListPage from './pages/primary/NoteListPage'
import FollowingListPage from './pages/secondary/FollowingListPage'
import HashtagPage from './pages/secondary/HashtagPage'
import NotePage from './pages/secondary/NotePage'
import ProfilePage from './pages/secondary/ProfilePage'
import { FollowListProvider } from './providers/FollowListProvider'
import { NostrProvider } from './providers/NostrProvider'
import { NoteStatsProvider } from './providers/NoteStatsProvider'
import { RelaySettingsProvider } from './providers/RelaySettingsProvider'

export const routes = [
  { path: 'note/:eventId', element: <NotePage /> },
  { path: 'user/:pubkey', element: <ProfilePage /> },
  { path: 'user/:pubkey/following', element: <FollowingListPage /> },
  { path: 'hashtag/:hashtag', element: <HashtagPage /> }
]

export default function App(): JSX.Element {
  return (
    <div className="h-screen">
      <ThemeProvider>
        <NostrProvider>
          <FollowListProvider>
            <RelaySettingsProvider>
              <NoteStatsProvider>
                <PageManager routes={routes}>
                  <NoteListPage />
                </PageManager>
                <Toaster />
              </NoteStatsProvider>
            </RelaySettingsProvider>
          </FollowListProvider>
        </NostrProvider>
      </ThemeProvider>
    </div>
  )
}
