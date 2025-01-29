import NotificationList from '@/components/NotificationList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { Bell } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const NotificationListPage = forwardRef((_, ref) => {
  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="notifications"
      titlebar={<NotificationListPageTitlebar />}
      displayScrollToTopButton
    >
      <div className="px-4">
        <NotificationList />
      </div>
    </PrimaryPageLayout>
  )
})
NotificationListPage.displayName = 'NotificationListPage'
export default NotificationListPage

function NotificationListPageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <Bell />
      <div className="text-lg font-semibold">{t('Notifications')}</div>
    </div>
  )
}
