import 'yet-another-react-lightbox/styles.css'
import './index.css'

import KeySyncRequestHandler from '@/components/KeySyncRequestDialog'
import { Toaster } from '@/components/ui/sonner'
import { BookmarksProvider } from '@/providers/BookmarksProvider'
import { ContentPolicyProvider } from '@/providers/ContentPolicyProvider'
import { DeletedEventProvider } from '@/providers/DeletedEventProvider'
import { EmojiPackProvider } from '@/providers/EmojiPackProvider'
import { FavoriteRelaysProvider } from '@/providers/FavoriteRelaysProvider'
import { FeedProvider } from '@/providers/FeedProvider'
import { FollowListProvider } from '@/providers/FollowListProvider'
import { KindFilterProvider } from '@/providers/KindFilterProvider'
import { MediaUploadServiceProvider } from '@/providers/MediaUploadServiceProvider'
import { MuteListProvider } from '@/providers/MuteListProvider'
import { NostrProvider } from '@/providers/NostrProvider'
import { PinListProvider } from '@/providers/PinListProvider'
import { PinnedUsersProvider } from '@/providers/PinnedUsersProvider'
import { ScreenSizeProvider } from '@/providers/ScreenSizeProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { TranslationServiceProvider } from '@/providers/TranslationServiceProvider'
import { UserPreferencesProvider } from '@/providers/UserPreferencesProvider'
import { UserTrustProvider } from '@/providers/UserTrustProvider'
import { ZapProvider } from '@/providers/ZapProvider'
import { DirectionProvider } from '@radix-ui/react-direction'
import { useTranslation } from 'react-i18next'
import { PageManager } from './PageManager'

function RadixDirectionProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  return <DirectionProvider dir={i18n.dir()}>{children}</DirectionProvider>
}

export default function App(): JSX.Element {
  return (
    <RadixDirectionProvider>
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
                              <EmojiPackProvider>
                                <PinListProvider>
                                  <PinnedUsersProvider>
                                    <FeedProvider>
                                      <MediaUploadServiceProvider>
                                        <KindFilterProvider>
                                          <PageManager />
                                          <KeySyncRequestHandler />
                                          <Toaster />
                                        </KindFilterProvider>
                                      </MediaUploadServiceProvider>
                                    </FeedProvider>
                                  </PinnedUsersProvider>
                                </PinListProvider>
                              </EmojiPackProvider>
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
    </RadixDirectionProvider>
  )
}
