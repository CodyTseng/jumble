import 'yet-another-react-lightbox/styles.css'
import './index.css'

import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/providers/ThemeProvider'
import Snowfall from './components/Snowfall'
import { PageManager } from './PageManager'
import NoteListPage from './pages/primary/NoteListPage'
import { ChristmasProvider } from './providers/ChristmasProvider'
import { FollowListProvider } from './providers/FollowListProvider'
import { NostrProvider } from './providers/NostrProvider'
import { NoteStatsProvider } from './providers/NoteStatsProvider'
import { RelaySettingsProvider } from './providers/RelaySettingsProvider'
import { ScreenSizeProvider } from './providers/ScreenSizeProvider'

export default function App(): JSX.Element {
  return (
    <div className="h-screen">
      <ThemeProvider>
        <ChristmasProvider>
          <ScreenSizeProvider>
            <RelaySettingsProvider>
              <NostrProvider>
                <FollowListProvider>
                  <NoteStatsProvider>
                    <Snowfall />
                    <PageManager>
                      <NoteListPage />
                    </PageManager>
                    <Toaster />
                  </NoteStatsProvider>
                </FollowListProvider>
              </NostrProvider>
            </RelaySettingsProvider>
          </ScreenSizeProvider>
        </ChristmasProvider>
      </ThemeProvider>
    </div>
  )
}
