import 'yet-another-react-lightbox/styles.css'
import './assets/main.css'

import { Toaster } from '@renderer/components/ui/toaster'
import { ThemeProvider } from '@renderer/providers/ThemeProvider'
import { PageManager } from './PageManager'
import NoteListPage from './pages/primary/NoteListPage'
import HashtagPage from './pages/secondary/HashtagPage'
import NotePage from './pages/secondary/NotePage'
import ProfilePage from './pages/secondary/ProfilePage'
import { NostrProvider } from './providers/NostrProvider'
import { NoteStatsProvider } from './providers/NoteStatsProvider'
import { RelaySettingsProvider } from './providers/RelaySettingsProvider'

const routes = [
  { pageName: 'note', element: <NotePage /> },
  { pageName: 'profile', element: <ProfilePage /> },
  { pageName: 'hashtag', element: <HashtagPage /> }
]

export default function App(): JSX.Element {
  return (
    <div className="h-screen">
      <ThemeProvider>
        <NostrProvider>
          <RelaySettingsProvider>
            <NoteStatsProvider>
              <PageManager routes={routes}>
                <NoteListPage />
              </PageManager>
              <Toaster />
            </NoteStatsProvider>
          </RelaySettingsProvider>
        </NostrProvider>
      </ThemeProvider>
    </div>
  )
}
