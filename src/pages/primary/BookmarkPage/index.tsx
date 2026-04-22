import BookmarkList from '@/components/BookmarkList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { TPageRef } from '@/types'
import { BookmarkSimpleIcon } from '@phosphor-icons/react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const BookmarkPage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  return (
    <PrimaryPageLayout
      pageName="bookmark"
      ref={ref}
      icon={<BookmarkSimpleIcon />}
      title={t('Bookmarks')}
      displayScrollToTopButton
    >
      <BookmarkList />
    </PrimaryPageLayout>
  )
})
BookmarkPage.displayName = 'BookmarkPage'
export default BookmarkPage
