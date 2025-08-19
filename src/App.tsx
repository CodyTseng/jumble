import 'yet-another-react-lightbox/styles.css'
import './index.css'

import { ThemeProvider } from '@/providers/ThemeProvider'
import { Toaster } from './components/ui/sonner'
import { PageManager } from './PageManager'
import { BookmarksProvider } from './providers/BookmarksProvider'
import { ContentPolicyProvider } from './providers/ContentPolicyProvider'
import { FavoriteRelaysProvider } from './providers/FavoriteRelaysProvider'
import { FeedProvider } from './providers/FeedProvider'
import { FollowListProvider } from './providers/FollowListProvider'
import { MediaUploadServiceProvider } from './providers/MediaUploadServiceProvider'
import { MuteListProvider } from './providers/MuteListProvider'
import { NostrProvider } from './providers/NostrProvider'
import { ReplyProvider } from './providers/ReplyProvider'
import { ScreenSizeProvider } from './providers/ScreenSizeProvider'
import { TranslationServiceProvider } from './providers/TranslationServiceProvider'
import { UserTrustProvider } from './providers/UserTrustProvider'
import { ZapProvider } from './providers/ZapProvider'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <ContentPolicyProvider>
        <ScreenSizeProvider>
          <NostrProvider>
            <ZapProvider>
              <TranslationServiceProvider>
                <FavoriteRelaysProvider>
                  <FollowListProvider>
                    <MuteListProvider>
                      <UserTrustProvider>
                        <BookmarksProvider>
                          <FeedProvider>
                            <ReplyProvider>
                              <MediaUploadServiceProvider>
                                <PageManager />
                                <Toaster />
                              </MediaUploadServiceProvider>
                            </ReplyProvider>
                          </FeedProvider>
                        </BookmarksProvider>
                      </UserTrustProvider>
                    </MuteListProvider>
                  </FollowListProvider>
                </FavoriteRelaysProvider>
              </TranslationServiceProvider>
            </ZapProvider>
          </NostrProvider>
        </ScreenSizeProvider>
      </ContentPolicyProvider>
    </ThemeProvider>
  )
}
