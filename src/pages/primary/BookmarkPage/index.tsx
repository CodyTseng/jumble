import BookmarkList from '@/components/BookmarkList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { TPageRef } from '@/types'
import { BookmarkIcon } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const BookmarkPage = forwardRef<TPageRef>((_, ref) => (
  <PrimaryPageLayout
    pageName="bookmark"
    ref={ref}
    titlebar={<BookmarkPageTitlebar />}
    displayScrollToTopButton
  >
    <BookmarkList />
  </PrimaryPageLayout>
))
BookmarkPage.displayName = 'BookmarkPage'
export default BookmarkPage

function BookmarkPageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <BookmarkIcon />
      <div className="text-lg font-semibold">{t('Bookmarks')}</div>
    </div>
  )
}
