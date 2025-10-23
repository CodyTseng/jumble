import BookmarkList from '@/components/BookmarkList'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const BookmarkPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout index={index} title={t('Bookmarks')} displayScrollToTopButton ref={ref}>
      <BookmarkList />
    </SecondaryPageLayout>
  )
})
BookmarkPage.displayName = 'BookmarkPage'
export default BookmarkPage
