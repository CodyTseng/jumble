import 'yet-another-react-lightbox/styles.css'
import './index.css'

import { ThemeProvider } from '@/providers/ThemeProvider'
import { Toaster } from './components/ui/sonner'
import { PageManager } from './PageManager'
import { AutoplayProvider } from './providers/AutoplayProvider'
import { BookmarksProvider } from './providers/BookmarksProvider'
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
import { ShowPostsProvider } from './providers/ShowPostsProvider'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AutoplayProvider>
        <ShowPostsProvider>
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
        </ShowPostsProvider>
      </AutoplayProvider>
    </ThemeProvider>
  )
}
