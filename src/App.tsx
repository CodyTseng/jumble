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
import { ReplyProvider } from '@/providers/ReplyProvider'
import { ScreenSizeProvider } from '@/providers/ScreenSizeProvider'
import { SparkWalletProvider } from '@/providers/SparkWalletProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { TranslationServiceProvider } from '@/providers/TranslationServiceProvider'
import { UserPreferencesProvider } from '@/providers/UserPreferencesProvider'
import { UserTrustProvider } from '@/providers/UserTrustProvider'
import { ZapProvider } from '@/providers/ZapProvider'
import { PageManager } from './PageManager'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <ContentPolicyProvider>
        <ScreenSizeProvider>
          <DeletedEventProvider>
            <NostrProvider>
              <SparkWalletProvider>
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
                                    <KindFilterProvider>
                                      <UserPreferencesProvider>
                                        <PageManager />
                                        <Toaster />
                                      </UserPreferencesProvider>
                                    </KindFilterProvider>
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
              </SparkWalletProvider>
            </NostrProvider>
          </DeletedEventProvider>
        </ScreenSizeProvider>
      </ContentPolicyProvider>
    </ThemeProvider>
  )
}
