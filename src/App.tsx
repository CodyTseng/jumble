import 'yet-another-react-lightbox/styles.css'
import './index.css'

import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { PageManager } from './PageManager'
import NoteListPage from './pages/primary/NoteListPage'
import { FollowListProvider } from './providers/FollowListProvider'
import { NostrProvider } from './providers/NostrProvider'
import { NoteStatsProvider } from './providers/NoteStatsProvider'
import { RelaySettingsProvider } from './providers/RelaySettingsProvider'
import { ScreenSizeProvider } from './providers/ScreenSizeProvider'

export default function App(): JSX.Element {
  return (
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
  )
}
