import 'yet-another-react-lightbox/styles.css'
import './index.css'

import { Toaster } from '@/components/ui/sonner'
import { BookmarksProvider } from '@/providers/BookmarksProvider'
import { ContentPolicyProvider } from '@/providers/ContentPolicyProvider'
import { DeletedEventProvider } from '@/providers/DeletedEventProvider'
import { FavoriteRelaysProvider } from '@/providers/FavoriteRelaysProvider'
import { FeedProvider } from '@/providers/FeedProvider'
import { FollowListProvider } from '@/providers/FollowListProvider'
import { KindFilterProvider } from '@/providers/KindFilterProvider'
import { MediaUploadServiceProvider } from '@/providers/MediaUploadServiceProvider'
import { MuteListProvider } from '@/providers/MuteListProvider'
import { NostrProvider } from '@/providers/NostrProvider'
import { PinListProvider } from '@/providers/PinListProvider'
import { ReplyProvider } from '@/providers/ReplyProvider'
import { ScreenSizeProvider } from '@/providers/ScreenSizeProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { TranslationServiceProvider } from '@/providers/TranslationServiceProvider'
import { UserPreferencesProvider } from '@/providers/UserPreferencesProvider'
import { UserTrustProvider } from '@/providers/UserTrustProvider'
import { ZapProvider } from '@/providers/ZapProvider'
import { PageManager } from './PageManager'

export default function App(): JSX.Element {
  return (
    <ScreenSizeProvider>
      <UserPreferencesProvider>
        <ThemeProvider>
          <ContentPolicyProvider>
            <DeletedEventProvider>
              <NostrProvider>
                <ZapProvider>
                  <TranslationServiceProvider>
                    <FavoriteRelaysProvider>
                      <FollowListProvider>
                        <MuteListProvider>
                          <UserTrustProvider>
                            <BookmarksProvider>
                              <PinListProvider>
                                <FeedProvider>
                                  <ReplyProvider>
                                    <MediaUploadServiceProvider>
                                      <KindFilterProvider>
                                        <PageManager />
                                        <Toaster />
                                      </KindFilterProvider>
                                    </MediaUploadServiceProvider>
                                  </ReplyProvider>
                                </FeedProvider>
                              </PinListProvider>
                            </BookmarksProvider>
                          </UserTrustProvider>
                        </MuteListProvider>
                      </FollowListProvider>
                    </FavoriteRelaysProvider>
                  </TranslationServiceProvider>
                </ZapProvider>
              </NostrProvider>
            </DeletedEventProvider>
          </ContentPolicyProvider>
        </ThemeProvider>
      </UserPreferencesProvider>
    </ScreenSizeProvider>
  )
}
