import NotificationList from '@/components/NotificationList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function NotificationListPage() {
  return (
    <PrimaryPageLayout
      pageName="notifications"
      titlebar={<NotificationListPageTitlebar />}
      displayScrollToTopButton
    >
      <div className="px-4">
        <NotificationList />
      </div>
    </PrimaryPageLayout>
  )
}

function NotificationListPageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <Bell />
      <div className="text-lg font-semibold">{t('Notifications')}</div>
    </div>
  )
}
