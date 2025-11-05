import 'yet-another-react-lightbox/styles.css'
import './index.css'

import { Toaster } from '@/components/ui/sonner'
import { AIProvider } from '@/providers/AIProvider'
import { BookmarksProvider } from '@/providers/BookmarksProvider'
import { ButtonRadiusProvider } from '@/providers/ButtonRadiusProvider'
import { CardRadiusProvider } from '@/providers/CardRadiusProvider'
import { CompactSidebarProvider } from '@/providers/CompactSidebarProvider'
import { LogoStyleProvider } from '@/providers/LogoStyleProvider'
import { WidgetSidebarTitleProvider } from '@/providers/WidgetSidebarTitleProvider'
import { ContentPolicyProvider } from '@/providers/ContentPolicyProvider'
import { DeckViewProvider } from '@/providers/DeckViewProvider'
import { CustomFeedsProvider } from '@/providers/CustomFeedsProvider'
import { DeletedEventProvider } from '@/providers/DeletedEventProvider'
import { DistractionFreeModeProvider } from '@/providers/DistractionFreeModeProvider'
import { FavoriteRelaysProvider } from '@/providers/FavoriteRelaysProvider'
import { FeedProvider } from '@/providers/FeedProvider'
import { FollowListProvider } from '@/providers/FollowListProvider'
import { FontFamilyProvider } from '@/providers/FontFamilyProvider'
import { FontSizeProvider } from '@/providers/FontSizeProvider'
import { TitleFontSizeProvider } from '@/providers/TitleFontSizeProvider'
import { KindFilterProvider } from '@/providers/KindFilterProvider'
import { LayoutModeProvider } from '@/providers/LayoutModeProvider'
import { MediaStyleProvider } from '@/providers/MediaStyleProvider'
import { MediaUploadServiceProvider } from '@/providers/MediaUploadServiceProvider'
import { MuteListProvider } from '@/providers/MuteListProvider'
import { NostrProvider } from '@/providers/NostrProvider'
import { PageThemeProvider } from '@/providers/PageThemeProvider'
import { PinListProvider } from '@/providers/PinListProvider'
import { PostButtonStyleProvider } from '@/providers/PostButtonStyleProvider'
import { PrimaryColorProvider } from '@/providers/PrimaryColorProvider'
import { ReadsVisibilityProvider } from '@/providers/ReadsVisibilityProvider'
import { ListsVisibilityProvider } from '@/providers/ListsVisibilityProvider'
import { ListsProvider } from '@/providers/ListsProvider'
import { ReplyProvider } from '@/providers/ReplyProvider'
import { ScreenSizeProvider } from '@/providers/ScreenSizeProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ColorPaletteProvider } from '@/providers/ColorPaletteProvider'
import { TranslationServiceProvider } from '@/providers/TranslationServiceProvider'
import { TrendingNotesDismissedProvider } from '@/providers/TrendingNotesDismissedProvider'
import { UserPreferencesProvider } from '@/providers/UserPreferencesProvider'
import { UserTrustProvider } from '@/providers/UserTrustProvider'
import { WidgetsProvider } from '@/providers/WidgetsProvider'
import { WidgetSidebarDismissedProvider } from '@/providers/WidgetSidebarDismissedProvider'
import { ZapProvider } from '@/providers/ZapProvider'
import { RTLProvider } from '@/providers/RTLProvider'
import { PageManager } from './PageManager'
import { AppWithListPreview } from './components/AppWithListPreview'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <ColorPaletteProvider>
        <PageThemeProvider>
          <PrimaryColorProvider>
          <FontSizeProvider>
            <TitleFontSizeProvider>
              <FontFamilyProvider>
                <RTLProvider>
                <ButtonRadiusProvider>
                <PostButtonStyleProvider>
                  <CardRadiusProvider>
                    <LayoutModeProvider>
                      <MediaStyleProvider>
                        <DeckViewProvider>
                          <CompactSidebarProvider>
                            <LogoStyleProvider>
                              <WidgetSidebarTitleProvider>
                          <DistractionFreeModeProvider>
                            <ContentPolicyProvider>
                              <ReadsVisibilityProvider>
                                <ListsVisibilityProvider>
                                  <ScreenSizeProvider>
                                    <DeletedEventProvider>
                              <NostrProvider>
                                <ListsProvider>
                                  <ZapProvider>
                                    <TranslationServiceProvider>
                                      <AIProvider>
                                        <FavoriteRelaysProvider>
                                          <FollowListProvider>
                                            <MuteListProvider>
                                              <UserTrustProvider>
                                                <BookmarksProvider>
                                                  <PinListProvider>
                                                    <CustomFeedsProvider>
                                                      <FeedProvider>
                                                        <ReplyProvider>
                                                          <MediaUploadServiceProvider>
                                                            <KindFilterProvider>
                                                              <UserPreferencesProvider>
                                                                <TrendingNotesDismissedProvider>
                                                                  <WidgetsProvider>
                                                                    <WidgetSidebarDismissedProvider>
                                                                      <AppWithListPreview />
                                                                      <Toaster />
                                                                    </WidgetSidebarDismissedProvider>
                                                                  </WidgetsProvider>
                                                                </TrendingNotesDismissedProvider>
                                                              </UserPreferencesProvider>
                                                            </KindFilterProvider>
                                                          </MediaUploadServiceProvider>
                                                        </ReplyProvider>
                                                      </FeedProvider>
                                                    </CustomFeedsProvider>
                                                  </PinListProvider>
                                                </BookmarksProvider>
                                              </UserTrustProvider>
                                            </MuteListProvider>
                                          </FollowListProvider>
                                        </FavoriteRelaysProvider>
                                      </AIProvider>
                                    </TranslationServiceProvider>
                                  </ZapProvider>
                                </ListsProvider>
                              </NostrProvider>
                                </DeletedEventProvider>
                              </ScreenSizeProvider>
                            </ListsVisibilityProvider>
                          </ReadsVisibilityProvider>
                        </ContentPolicyProvider>
                      </DistractionFreeModeProvider>
                              </WidgetSidebarTitleProvider>
                            </LogoStyleProvider>
                          </CompactSidebarProvider>
                        </DeckViewProvider>
                      </MediaStyleProvider>
                    </LayoutModeProvider>
                  </CardRadiusProvider>
                </PostButtonStyleProvider>
                </ButtonRadiusProvider>
                </RTLProvider>
              </FontFamilyProvider>
            </TitleFontSizeProvider>
          </FontSizeProvider>
          </PrimaryColorProvider>
        </PageThemeProvider>
      </ColorPaletteProvider>
    </ThemeProvider>
  )
}
