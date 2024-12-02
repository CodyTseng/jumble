import 'yet-another-react-lightbox/styles.css'
import './assets/main.css'

import { Toaster } from '@renderer/components/ui/toaster'
import { ThemeProvider } from '@renderer/providers/ThemeProvider'
import { PageManager } from './PageManager'
import NoteListPage from './pages/primary/NoteListPage'
import { FollowListProvider } from './providers/FollowListProvider'
import { NostrProvider } from './providers/NostrProvider'
import { NoteStatsProvider } from './providers/NoteStatsProvider'
import { RelaySettingsProvider } from './providers/RelaySettingsProvider'
import { ScreenSizeProvider } from './providers/ScreenSizeProvider'

export default function App(): JSX.Element {
  return (
    <div className="h-screen">
      <ThemeProvider>
        <ScreenSizeProvider>
          <RelaySettingsProvider>
            <NostrProvider>
              <FollowListProvider>
                <NoteStatsProvider>
                  <PageManager>
                    <NoteListPage />
                  </PageManager>
                  <Toaster />
                </NoteStatsProvider>
              </FollowListProvider>
            </NostrProvider>
          </RelaySettingsProvider>
        </ScreenSizeProvider>
      </ThemeProvider>
    </div>
  )
}
