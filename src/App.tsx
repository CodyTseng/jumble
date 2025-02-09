import 'yet-another-react-lightbox/styles.css'
import './index.css'

import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { PageManager } from './PageManager'
import { FeedProvider } from './providers/FeedProvider'
import { FollowListProvider } from './providers/FollowListProvider'
import { MuteListProvider } from './providers/MuteListProvider'
import { NostrProvider } from './providers/NostrProvider'
import { NoteStatsProvider } from './providers/NoteStatsProvider'
import { RelaySetsProvider } from './providers/RelaySetsProvider'
import { ScreenSizeProvider } from './providers/ScreenSizeProvider'
import { ZapProvider } from './providers/ZapProvider'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <ScreenSizeProvider>
        <NostrProvider>
          <ZapProvider>
            <RelaySetsProvider>
              <FollowListProvider>
                <MuteListProvider>
                  <FeedProvider>
                    <NoteStatsProvider>
                      <PageManager />
                      <Toaster />
                    </NoteStatsProvider>
                  </FeedProvider>
                </MuteListProvider>
              </FollowListProvider>
            </RelaySetsProvider>
          </ZapProvider>
        </NostrProvider>
      </ScreenSizeProvider>
    </ThemeProvider>
  )
}
