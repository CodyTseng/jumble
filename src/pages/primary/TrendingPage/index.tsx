import PostButton from '@/components/PostButton'
import SearchButton from '@/components/SearchButton'
import TrendingNoteList from '@/components/TrendingNoteList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Flame } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const TrendingPage = forwardRef((_, ref) => {
  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="trending"
      titlebar={<TrendingPageTitlebar />}
      displayScrollToTopButton
    >
      <TrendingNoteList />
    </PrimaryPageLayout>
  )
})
TrendingPage.displayName = 'TrendingPage'
export default TrendingPage

function TrendingPageTitlebar() {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  return (
    <div className="flex gap-1 items-center h-full justify-between">
      <div className="flex gap-2 items-center h-full pl-3">
        <Flame />
        <div className="text-lg font-semibold">{t('Trending')}</div>
      </div>
      <div className="shrink-0">
        <SearchButton />
        {isSmallScreen && <PostButton />}
      </div>
    </div>
  )
}
