import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const SearchPage = forwardRef((_, ref) => {
  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="search"
      titlebar={<SearchPageTitlebar />}
      displayScrollToTopButton
    ></PrimaryPageLayout>
  )
})
SearchPage.displayName = 'SearchPage'
export default SearchPage

function SearchPageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <div className="text-lg font-semibold">{t('Search')}</div>
    </div>
  )
}
